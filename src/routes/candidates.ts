// ==========================================
// 候选人管理API路由
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import type { Candidate, SearchParams } from '../types'

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

type Bindings = {
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

const candidates = new Hono<{ Bindings: Bindings }>()

// GET /api/candidates - 获取候选人列表（支持搜索筛选）
candidates.get('/', (c) => {
  const query = c.req.query()
  
  const params: SearchParams = {
    keyword: query.keyword,
    candidateStatus: query.candidateStatus,
    highestEducation: query.highestEducation,
    sourceChannel: query.sourceChannel,
    skillKeyword: query.skillKeyword,
    minExperience: query.minExperience ? parseFloat(query.minExperience) : undefined,
    maxExperience: query.maxExperience ? parseFloat(query.maxExperience) : undefined,
    isBlacklist: query.isBlacklist === 'true' ? true : query.isBlacklist === 'false' ? false : undefined,
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 10,
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder || 'desc'
  }

  const { list, total } = db.getCandidates(params)
  
  return c.json({
    success: true,
    data: list,
    total,
    page: params.page,
    pageSize: params.pageSize
  })
})

// GET /api/candidates/:id - 获取候选人详情
candidates.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  const candidate = db.getCandidateById(id)
  
  if (!candidate) {
    return c.json({ success: false, message: '候选人不存在' }, 404)
  }
  
  return c.json({ success: true, data: candidate })
})

// POST /api/candidates - 创建候选人
candidates.post('/', async (c) => {
  try {
    const body = await c.req.json() as Candidate
    
    if (!body.name || body.name.trim() === '') {
      return c.json({ success: false, message: '姓名不能为空' }, 400)
    }
    
    const candidate = db.createCandidate(body)
    return c.json({ success: true, data: candidate, message: '候选人创建成功' }, 201)
  } catch (e) {
    return c.json({ success: false, message: `创建失败: ${e}` }, 500)
  }
})

// PUT /api/candidates/:id - 更新候选人
candidates.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json() as Partial<Candidate>
    
    const updated = db.updateCandidate(id, body)
    if (!updated) {
      return c.json({ success: false, message: '候选人不存在' }, 404)
    }
    
    return c.json({ success: true, data: updated, message: '更新成功' })
  } catch (e) {
    return c.json({ success: false, message: `更新失败: ${e}` }, 500)
  }
})

// PATCH /api/candidates/:id/status - 更新状态
candidates.patch('/:id/status', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { candidateStatus } = await c.req.json() as { candidateStatus: string }
    
    const validStatuses = ['active', 'interviewing', 'hired', 'rejected', 'blacklist']
    if (!validStatuses.includes(candidateStatus)) {
      return c.json({ success: false, message: '无效的状态值' }, 400)
    }
    
    const updated = db.updateCandidate(id, { 
      candidateStatus,
      isBlacklist: candidateStatus === 'blacklist'
    })
    if (!updated) {
      return c.json({ success: false, message: '候选人不存在' }, 404)
    }
    
    return c.json({ success: true, data: updated, message: '状态更新成功' })
  } catch (e) {
    return c.json({ success: false, message: `状态更新失败: ${e}` }, 500)
  }
})

// PATCH /api/candidates/:id/notes - 更新HR备注
candidates.patch('/:id/notes', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { hrNotes } = await c.req.json() as { hrNotes: string }
    
    const updated = db.updateCandidate(id, { hrNotes })
    if (!updated) {
      return c.json({ success: false, message: '候选人不存在' }, 404)
    }
    
    return c.json({ success: true, message: '备注更新成功' })
  } catch (e) {
    return c.json({ success: false, message: `备注更新失败: ${e}` }, 500)
  }
})

// DELETE /api/candidates/:id - 删除候选人
candidates.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  const deleted = db.deleteCandidate(id)
  
  if (!deleted) {
    return c.json({ success: false, message: '候选人不存在' }, 404)
  }
  
  return c.json({ success: true, message: '删除成功' })
})

// POST /api/candidates/:id/interviews - 添加面试记录
candidates.post('/:id/interviews', async (c) => {
  try {
    const candidateId = parseInt(c.req.param('id'))
    const body = await c.req.json()
    
    const record = db.addInterviewRecord(candidateId, { ...body, candidateId })
    return c.json({ success: true, data: record, message: '面试记录添加成功' }, 201)
  } catch (e) {
    return c.json({ success: false, message: `添加失败: ${e}` }, 500)
  }
})

// GET /api/candidates/stats/overview - 统计数据
candidates.get('/stats/overview', (c) => {
  const stats = db.getStatistics()
  return c.json({ success: true, data: stats })
})

// ==========================================
// 简历文件相关 API
// ==========================================

// GET /api/candidates/:id/resume - 获取简历文件（Base64流，用于预览/下载）
candidates.get('/:id/resume', (c) => {
  const id = parseInt(c.req.param('id'))
  const candidate = db.getCandidateById(id)
  if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)
  
  const file = db.getResumeFile(id)
  if (!file) return c.json({ success: false, message: '该候选人暂无上传的简历文件' }, 404)
  
  // 判断是否请求下载（?download=1）
  const download = c.req.query('download') === '1'
  
  // 将 Base64 解码为二进制
  const binaryStr = atob(file.fileData)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  
  const disposition = download
    ? `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    : `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  
  return new Response(bytes.buffer, {
    status: 200,
    headers: {
      'Content-Type': file.fileType || 'application/octet-stream',
      'Content-Disposition': disposition,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-cache'
    }
  })
})

// GET /api/candidates/:id/resume/info - 获取简历文件元信息（不含内容）
candidates.get('/:id/resume/info', (c) => {
  const id = parseInt(c.req.param('id'))
  const candidate = db.getCandidateById(id)
  if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)
  
  const file = db.getResumeFile(id)
  if (!file) return c.json({ success: false, hasFile: false, message: '暂无简历文件' })
  
  return c.json({
    success: true,
    hasFile: true,
    data: {
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt
    }
  })
})

// POST /api/candidates/:id/resume - 替换上传简历文件
candidates.post('/:id/resume', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const candidate = db.getCandidateById(id)
    if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)
    
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ success: false, message: '请选择要上传的文件' }, 400)
    
    const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExts.includes(fileExt)) {
      return c.json({ success: false, message: '仅支持 PDF、Word、JPG、PNG 格式' }, 400)
    }
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, message: '文件大小不能超过 10MB' }, 400)
    }
    
    const fileBuffer = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(fileBuffer)
    
    db.saveResumeFile(id, {
      fileName: file.name,
      fileType: file.type || `application/${fileExt}`,
      fileSize: file.size,
      fileData: base64
    })
    
    return c.json({
      success: true,
      message: '简历文件上传成功',
      data: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      }
    })
  } catch (e: any) {
    return c.json({ success: false, message: `上传失败: ${e.message}` }, 500)
  }
})

// DELETE /api/candidates/:id/resume - 删除简历文件
candidates.delete('/:id/resume', (c) => {
  const id = parseInt(c.req.param('id'))
  const deleted = db.deleteResumeFile(id)
  if (!deleted) return c.json({ success: false, message: '文件不存在' }, 404)
  return c.json({ success: true, message: '简历文件已删除' })
})

export default candidates
