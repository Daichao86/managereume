// ==========================================
// 简历上传与AI解析API路由
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import { parseResumeWithAI, extractTextFromFile, calculateProfileCompleteness } from '../lib/ai-parser'

// 安全的 ArrayBuffer → Base64 转换（分块处理，避免大文件栈溢出）
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let result = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    result += String.fromCharCode(...chunk)
  }
  return btoa(result)
}

const upload = new Hono()

// POST /api/upload/resume - 上传并AI解析简历
upload.post('/resume', async (c) => {
  try {
    // 获取API Key：优先从请求头，其次从环境变量
    const apiKey = c.req.header('X-OpenAI-Key') || process.env.OPENAI_API_KEY || ''
    const apiBaseUrl = c.req.header('X-OpenAI-Base-URL') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    
    if (!apiKey) {
      return c.json({ 
        success: false, 
        message: 'OpenAI API Key未配置，请在系统设置中配置API Key' 
      }, 400)
    }

    // 解析multipart表单
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const sourceChannel = formData.get('sourceChannel') as string || '手动上传'
    
    if (!file) {
      return c.json({ success: false, message: '请选择要上传的简历文件' }, 400)
    }

    // 验证文件类型
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/html',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
    
    const allowedExts = ['pdf', 'doc', 'docx', 'txt', 'html', 'htm', 'jpg', 'jpeg', 'png', 'webp']
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      return c.json({ 
        success: false, 
        message: `不支持的文件格式，请上传 PDF、Word、TXT、HTML 或图片格式的简历` 
      }, 400)
    }

    // 文件大小限制（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, message: '文件大小不能超过10MB' }, 400)
    }

    // 读取文件内容
    const fileBuffer = await file.arrayBuffer()
    
    // 创建解析任务记录
    const task = db.createParseTask({
      fileName: file.name,
      fileType: file.type || fileExt,
      status: 'processing',
      candidateId: undefined
    })
    
    try {
      // 提取文本内容（PDF/图片走 Vision，TXT 直接解码，DOCX 提取 XML 文本）
      const resumeText = await extractTextFromFile(
        fileBuffer,
        file.name,
        file.type,
        apiKey,
        apiBaseUrl
      )

      if (!resumeText || resumeText.trim().length < 10) {
        db.updateParseTask(task.id!, { status: 'failed', errorMsg: '无法提取文件文本内容' })
        return c.json({
          success: false,
          message: '无法从文件中提取有效内容。PDF请确保非扫描件或加密文件；图片请保证文字清晰。'
        }, 400)
      }

      // AI解析
      const parseResult = await parseResumeWithAI(resumeText, apiKey, apiBaseUrl)
      
      if (!parseResult.name) {
        parseResult.name = file.name.replace(/\.[^.]+$/, '').replace(/简历|_resume|resume/gi, '').trim() || '未知姓名'
      }
      
      // 创建候选人记录
      const candidate = db.createCandidate({
        ...parseResult,
        sourceChannel,
        rawResumeText: resumeText.slice(0, 5000),
        resumeFileName: file.name,
        resumeFileType: file.type || `application/${fileExt}`,
        resumeFileSize: file.size,
        candidateStatus: 'active',
        matchScore: calculateProfileCompleteness(parseResult)
      })
      
      // 保存原始文件（Base64，分块编码防止栈溢出）
      const base64 = arrayBufferToBase64(fileBuffer)
      db.saveResumeFile(candidate.id!, {
        fileName: file.name,
        fileType: file.type || `application/${fileExt}`,
        fileSize: file.size,
        fileData: base64
      })
      
      // 更新任务状态
      db.updateParseTask(task.id!, { 
        status: 'completed', 
        candidateId: candidate.id,
        parseResult: JSON.stringify(parseResult)
      })
      
      return c.json({
        success: true,
        data: {
          candidate,
          parseResult,
          taskId: task.id
        },
        message: `简历解析成功！已为 ${candidate.name} 创建候选人档案`
      })
      
    } catch (parseError: any) {
      db.updateParseTask(task.id!, { 
        status: 'failed', 
        errorMsg: parseError.message 
      })
      throw parseError
    }
    
  } catch (e: any) {
    console.error('简历解析错误:', e)
    const msg: string = e.message || '未知错误'
    let friendlyMsg = `简历解析失败: ${msg}`
    if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('Incorrect API key')) {
      friendlyMsg = 'API Key 无效或已过期，请在系统设置 → AI配置中重新填写正确的 OpenAI API Key。'
    } else if (msg.includes('429') || msg.includes('rate_limit')) {
      friendlyMsg = 'OpenAI 请求频率超限，请稍后再试（当前 API Key 配额不足）。'
    } else if (msg.includes('quota') || msg.includes('insufficient_quota')) {
      friendlyMsg = 'OpenAI API 余额不足，请充值后再试。'
    } else if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      friendlyMsg = '请求超时，请检查网络连接或 API Base URL 是否正确。'
    } else if (msg.includes('model') && msg.includes('not found')) {
      friendlyMsg = '模型不存在，当前使用 gpt-4o，请确认 API Key 有权限访问该模型。'
    }
    return c.json({ success: false, message: friendlyMsg }, 500)
  }
})

// POST /api/upload/text - 直接粘贴文本解析
upload.post('/text', async (c) => {
  try {
    const apiKey = c.req.header('X-OpenAI-Key') || process.env.OPENAI_API_KEY || ''
    const apiBaseUrl = c.req.header('X-OpenAI-Base-URL') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    
    if (!apiKey) {
      return c.json({ 
        success: false, 
        message: 'OpenAI API Key未配置' 
      }, 400)
    }
    
    const body = await c.req.json() as { text: string, sourceChannel?: string }
    
    if (!body.text || body.text.trim().length < 20) {
      return c.json({ success: false, message: '简历文本内容过短，请输入完整的简历信息' }, 400)
    }
    
    const parseResult = await parseResumeWithAI(body.text, apiKey, apiBaseUrl)
    
    if (!parseResult.name) {
      parseResult.name = '未知姓名'
    }
    
    const candidate = db.createCandidate({
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
    let friendlyMsg = `解析失败: ${msg}`
    if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('Incorrect API key')) {
      friendlyMsg = 'API Key 无效或已过期，请在系统设置 → AI配置中重新填写正确的 OpenAI API Key。'
    } else if (msg.includes('429') || msg.includes('rate_limit')) {
      friendlyMsg = 'OpenAI 请求频率超限，请稍后再试。'
    } else if (msg.includes('quota') || msg.includes('insufficient_quota')) {
      friendlyMsg = 'OpenAI API 余额不足，请充值后再试。'
    }
    return c.json({ success: false, message: friendlyMsg }, 500)
  }
})

// GET /api/upload/task/:id - 获取解析任务状态
upload.get('/task/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  const task = db.getParseTask(id)
  
  if (!task) {
    return c.json({ success: false, message: '任务不存在' }, 404)
  }
  
  return c.json({ success: true, data: task })
})

// POST /api/upload/config - 设置API Key（运行时）
upload.post('/config', async (c) => {
  try {
    const { openaiKey, openaiBaseUrl } = await c.req.json()
    
    if (!openaiKey) {
      return c.json({ success: false, message: 'API Key不能为空' }, 400)
    }
    
    // 在实际生产中，这会存储在 Cloudflare KV 或环境变量中
    // 这里模拟验证
    const testResponse = await fetch(`${openaiBaseUrl || 'https://api.openai.com/v1'}/models`, {
      headers: { 'Authorization': `Bearer ${openaiKey}` }
    })
    
    if (!testResponse.ok) {
      return c.json({ success: false, message: 'API Key无效，请检查后重试' }, 400)
    }
    
    return c.json({ success: true, message: 'API Key验证成功' })
  } catch (e: any) {
    return c.json({ success: false, message: `验证失败: ${e.message}` }, 500)
  }
})

export default upload
