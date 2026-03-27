// ==========================================
// 简历上传与AI解析API路由（MySQL + 本地文件存储版）
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import { uploadFile, generateFileKey } from '../lib/storage'
import { parseResumeWithAI, extractTextFromFile, calculateProfileCompleteness } from '../lib/ai-parser'

const upload = new Hono()

// POST /api/upload/resume - 上传文件 + AI解析 + 保存到本地磁盘
upload.post('/resume', async (c) => {
  try {
    const apiKey = c.req.header('X-OpenAI-Key') || process.env.OPENAI_API_KEY || ''
    const apiBaseUrl = c.req.header('X-OpenAI-Base-URL') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

    if (!apiKey) {
      return c.json({ success: false, message: 'OpenAI API Key未配置，请在系统设置中配置API Key' }, 400)
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const sourceChannel = (formData.get('sourceChannel') as string) || '手动上传'

    if (!file) return c.json({ success: false, message: '请选择要上传的简历文件' }, 400)

    const allowedExts = ['pdf', 'doc', 'docx', 'txt', 'html', 'htm', 'jpg', 'jpeg', 'png', 'webp']
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExts.includes(fileExt)) {
      return c.json({ success: false, message: '不支持的文件格式，请上传 PDF、Word、TXT、HTML 或图片格式' }, 400)
    }
    if (file.size > 20 * 1024 * 1024) {
      return c.json({ success: false, message: '文件大小不能超过 20MB' }, 400)
    }

    const fileBuffer = await file.arrayBuffer()
    const nodeBuffer = Buffer.from(fileBuffer)
    const mimeType = file.type || `application/${fileExt}`

    // 创建解析任务
    const task = await db.createParseTask({ fileName: file.name, fileType: mimeType, status: 'processing' })

    try {
      // 提取文本（PDF/图片走Vision，DOCX提取XML，TXT直读）
      const resumeText = await extractTextFromFile(fileBuffer, file.name, file.type, apiKey, apiBaseUrl)

      if (!resumeText || resumeText.trim().length < 10) {
        await db.updateParseTask(task.id!, { status: 'failed', errorMsg: '无法提取文件文本内容' })
        return c.json({ success: false, message: '无法从文件中提取有效内容，PDF请确保非扫描件；图片请保证文字清晰' }, 400)
      }

      // AI解析结构化数据
      const parseResult = await parseResumeWithAI(resumeText, apiKey, apiBaseUrl)
      if (!parseResult.name) {
        parseResult.name = file.name.replace(/\.[^.]+$/, '').replace(/简历|_resume|resume/gi, '').trim() || '未知姓名'
      }

      // 创建候选人记录（先不含文件 key）
      const candidate = await db.createCandidate({
        ...parseResult,
        sourceChannel,
        rawResumeText: resumeText.slice(0, 5000),
        resumeFileName: file.name,
        resumeFileType: mimeType,
        resumeFileSize: file.size,
        candidateStatus: 'active',
        matchScore: calculateProfileCompleteness(parseResult)
      })

      // 保存原始文件到本地磁盘
      const fileKey = generateFileKey(candidate.id!, file.name)
      await uploadFile(fileKey, nodeBuffer, mimeType)

      // 更新 MySQL 简历元数据（fileKey 存的是相对路径）
      await db.saveResumeFileMeta(candidate.id!, {
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        fileKey,
      })

      // 本地存储：预览/下载 URL 均指向本系统 API
      const previewUrl = `/api/candidates/${candidate.id}/resume`

      // 更新任务状态
      await db.updateParseTask(task.id!, {
        status: 'completed',
        candidateId: candidate.id,
        parseResult: JSON.stringify(parseResult)
      })

      // 重新获取完整候选人信息（含文件元数据）
      const fullCandidate = await db.getCandidateById(candidate.id!)

      return c.json({
        success: true,
        data: { candidate: fullCandidate, parseResult, taskId: task.id, previewUrl },
        message: `简历解析成功！已为 ${candidate.name} 创建候选人档案`
      })

    } catch (parseError: any) {
      await db.updateParseTask(task.id!, { status: 'failed', errorMsg: parseError.message })
      throw parseError
    }

  } catch (e: any) {
    const msg: string = e.message || '未知错误'
    let friendlyMsg = `简历解析失败: ${msg}`
    if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('Incorrect API key')) {
      friendlyMsg = 'API Key 无效或已过期，请在系统设置 → AI配置中重新填写正确的 OpenAI API Key。'
    } else if (msg.includes('429') || msg.includes('rate_limit')) {
      friendlyMsg = 'OpenAI 请求频率超限，请稍后再试。'
    } else if (msg.includes('quota') || msg.includes('insufficient_quota')) {
      friendlyMsg = 'OpenAI API 余额不足，请充值后再试。'
    } else if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      friendlyMsg = '请求超时，请检查网络或 API Base URL 是否正确。'
    } else if (msg.includes('model') && msg.includes('not found')) {
      friendlyMsg = '模型不存在，请确认 API Key 有权限访问 gpt-4o。'
    } else if (msg.includes('404') || msg.includes('no Route matched') || msg.includes('Not Found')) {
      friendlyMsg = 'API地址错误(404)：请检查系统设置 → AI配置中的"API Base URL"。' +
        '正确格式为 https://api.openai.com/v1 或您的代理地址（以 /v1 结尾，不要多填路径）。'
    }
    return c.json({ success: false, message: friendlyMsg }, 500)
  }
})

// POST /api/upload/text - 粘贴文本解析（无需文件上传，直接解析文字简历）
upload.post('/text', async (c) => {
  try {
    const apiKey = c.req.header('X-OpenAI-Key') || process.env.OPENAI_API_KEY || ''
    const apiBaseUrl = c.req.header('X-OpenAI-Base-URL') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

    if (!apiKey) return c.json({ success: false, message: 'OpenAI API Key未配置' }, 400)

    const body = await c.req.json() as { text: string; sourceChannel?: string }
    if (!body.text || body.text.trim().length < 20) {
      return c.json({ success: false, message: '简历文本内容过短，请输入完整简历信息' }, 400)
    }

    const parseResult = await parseResumeWithAI(body.text, apiKey, apiBaseUrl)
    if (!parseResult.name) parseResult.name = '未知姓名'

    const candidate = await db.createCandidate({
      ...parseResult,
      sourceChannel: body.sourceChannel || '文本导入',
      rawResumeText: body.text.slice(0, 5000),
      candidateStatus: 'active',
      matchScore: calculateProfileCompleteness(parseResult)
    })

    return c.json({
      success: true,
      data: { candidate, parseResult },
      message: `简历解析成功！已为 ${candidate.name} 创建候选人档案`
    })
  } catch (e: any) {
    const msg: string = e.message || '未知错误'
    let friendlyMsg = '简历解析失败: ' + msg
    if (msg.includes('401') || msg.includes('invalid_api_key')) friendlyMsg = 'API Key 无效，请检查系统设置。'
    else if (msg.includes('429')) friendlyMsg = 'OpenAI 请求频率超限，请稍后再试。'
    else if (msg.includes('quota')) friendlyMsg = 'OpenAI API 余额不足，请充值后再试。'
    else if (msg.includes('404') || msg.includes('no Route matched') || msg.includes('Not Found')) {
      friendlyMsg = 'API地址错误(404)：请在系统设置→AI配置中检查"API Base URL"，正确格式为 https://api.openai.com/v1（以/v1结尾）。'
    }
    return c.json({ success: false, message: friendlyMsg }, 500)
  }
})

// GET /api/upload/task/:id - 查询解析任务状态
upload.get('/task/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const task = await db.getParseTask(id)
  if (!task) return c.json({ success: false, message: '任务不存在' }, 404)
  return c.json({ success: true, data: task })
})

// POST /api/upload/config - 验证并保存 OpenAI API Key
upload.post('/config', async (c) => {
  try {
    const { openaiKey, openaiBaseUrl } = await c.req.json()
    if (!openaiKey) return c.json({ success: false, message: 'API Key不能为空' }, 400)
    // 规范化 base URL：去除尾部斜杠，确保以 /v1 结尾
    let normalizedUrl = (openaiBaseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
    if (!normalizedUrl.match(/\/v\d+$/)) normalizedUrl = normalizedUrl + '/v1'
    const testRes = await fetch(`${normalizedUrl}/models`, {
      headers: { 'Authorization': `Bearer ${openaiKey}` }
    })
    if (!testRes.ok) {
      if (testRes.status === 401) return c.json({ success: false, message: 'API Key无效或已过期，请重新填写正确的Key。' }, 400)
      if (testRes.status === 404) return c.json({ success: false, message: 'API Base URL地址不存在(404)，请确认填写格式：https://api.openai.com/v1 或您的代理地址（需以/v1结尾）。当前地址：' + normalizedUrl }, 400)
      return c.json({ success: false, message: 'API验证失败(' + testRes.status + ')，请检查Key和Base URL后重试。' }, 400)
    }
    return c.json({ success: true, message: 'API Key验证成功，Base URL：' + normalizedUrl })
  } catch (e: any) {
    return c.json({ success: false, message: `验证失败: ${e.message}` }, 500)
  }
})

export default upload
