// ==========================================
// 候选人管理API路由（MySQL + 本地文件存储版）
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import {
  uploadFile, deleteFile, generateFileKey,
  getFileBuffer, getFileStat, keyToAbsPath
} from '../lib/storage'
import type { Candidate } from '../types'

const candidates = new Hono()

// ==========================================
// 候选人 CRUD
// ==========================================

// GET /api/candidates - 列表（多条件过滤）
candidates.get('/', async (c) => {
  const q = c.req.query()
  const { list, total } = await db.getCandidates({
    ...q,
    page:          q.page          ? parseInt(q.page)          : 1,
    pageSize:      q.pageSize      ? parseInt(q.pageSize)      : 10,
    minExperience: q.minExperience ? parseFloat(q.minExperience) : undefined,
    maxExperience: q.maxExperience ? parseFloat(q.maxExperience) : undefined,
    minAge:        q.minAge        ? parseInt(q.minAge)        : undefined,
    maxAge:        q.maxAge        ? parseInt(q.maxAge)        : undefined,
    minSalary:     q.minSalary     ? parseInt(q.minSalary)     : undefined,
    maxSalary:     q.maxSalary     ? parseInt(q.maxSalary)     : undefined,
    minMatchScore: q.minMatchScore ? parseFloat(q.minMatchScore) : undefined,
    isBlacklist:   q.isBlacklist === 'true' ? true : q.isBlacklist === 'false' ? false : undefined,
  })
  return c.json({
    success: true, data: list, total,
    page: parseInt(q.page || '1'), pageSize: parseInt(q.pageSize || '10')
  })
})

// GET /api/candidates/stats/overview（须在 /:id 之前注册）
candidates.get('/stats/overview', async (c) => {
  const stats = await db.getStatistics()
  return c.json({ success: true, data: stats })
})

// GET /api/candidates/:id - 详情
candidates.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const candidate = await db.getCandidateById(id)
  if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)
  return c.json({ success: true, data: candidate })
})

// POST /api/candidates - 创建
candidates.post('/', async (c) => {
  try {
    const body = await c.req.json() as Candidate
    if (!body.name?.trim()) return c.json({ success: false, message: '姓名不能为空' }, 400)
    const candidate = await db.createCandidate(body)
    return c.json({ success: true, data: candidate, message: '候选人创建成功' }, 201)
  } catch (e: any) {
    return c.json({ success: false, message: `创建失败: ${e.message}` }, 500)
  }
})

// PUT /api/candidates/:id - 更新
candidates.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json() as Partial<Candidate>
    const updated = await db.updateCandidate(id, body)
    if (!updated) return c.json({ success: false, message: '候选人不存在' }, 404)
    return c.json({ success: true, data: updated, message: '更新成功' })
  } catch (e: any) {
    return c.json({ success: false, message: `更新失败: ${e.message}` }, 500)
  }
})

// PATCH /api/candidates/:id/status
candidates.patch('/:id/status', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { candidateStatus } = await c.req.json() as { candidateStatus: string }
    const validStatuses = ['active', 'interviewing', 'hired', 'rejected', 'blacklist', 'archived']
    if (!validStatuses.includes(candidateStatus))
      return c.json({ success: false, message: '无效的状态值' }, 400)
    const updated = await db.updateCandidate(id, {
      candidateStatus,
      isBlacklist: candidateStatus === 'blacklist'
    })
    if (!updated) return c.json({ success: false, message: '候选人不存在' }, 404)
    return c.json({ success: true, data: updated, message: '状态更新成功' })
  } catch (e: any) {
    return c.json({ success: false, message: `状态更新失败: ${e.message}` }, 500)
  }
})

// PATCH /api/candidates/:id/notes
candidates.patch('/:id/notes', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const { hrNotes } = await c.req.json() as { hrNotes: string }
    const updated = await db.updateCandidate(id, { hrNotes })
    if (!updated) return c.json({ success: false, message: '候选人不存在' }, 404)
    return c.json({ success: true, message: '备注更新成功' })
  } catch (e: any) {
    return c.json({ success: false, message: `备注更新失败: ${e.message}` }, 500)
  }
})

// DELETE /api/candidates/:id
candidates.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  // 先清理本地文件
  const fileKey = await db.getResumeFileKey(id)
  if (fileKey) {
    try { await deleteFile(fileKey) } catch {}
  }
  const deleted = await db.deleteCandidate(id)
  if (!deleted) return c.json({ success: false, message: '候选人不存在' }, 404)
  return c.json({ success: true, message: '删除成功' })
})

// POST /api/candidates/:id/interviews
candidates.post('/:id/interviews', async (c) => {
  try {
    const candidateId = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const record = await db.addInterviewRecord(candidateId, { ...body, candidateId })
    return c.json({ success: true, data: record, message: '面试记录添加成功' }, 201)
  } catch (e: any) {
    return c.json({ success: false, message: `添加失败: ${e.message}` }, 500)
  }
})

// ==========================================
// 简历文件 API（本地文件存储版）
// ==========================================

// GET /api/candidates/:id/resume/info - 文件元信息
candidates.get('/:id/resume/info', async (c) => {
  const id = parseInt(c.req.param('id'))
  const candidate = await db.getCandidateById(id)
  if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)

  if (!candidate.resumeFileKey) {
    return c.json({ success: true, hasFile: false, message: '暂无简历文件' })
  }

  // 从磁盘读取文件状态（实时大小）
  const stat = getFileStat(candidate.resumeFileKey)

  return c.json({
    success: true,
    hasFile: true,
    data: {
      fileName:   candidate.resumeFileName,
      fileType:   candidate.resumeFileType,
      fileSize:   stat?.size ?? candidate.resumeFileSize,
      uploadedAt: candidate.resumeUploadedAt,
      // 本地存储：预览和下载均走同一接口，通过 ?download=1 区分
      previewUrl:  `/api/candidates/${id}/resume`,
      downloadUrl: `/api/candidates/${id}/resume?download=1`,
    }
  })
})

// GET /api/candidates/:id/resume - 流式输出文件（预览 or 下载）
candidates.get('/:id/resume', async (c) => {
  const id = parseInt(c.req.param('id'))
  const candidate = await db.getCandidateById(id)
  if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)
  if (!candidate.resumeFileKey)
    return c.json({ success: false, message: '该候选人暂无上传的简历文件' }, 404)

  try {
    const download   = c.req.query('download') === '1'
    const fileBuffer = await getFileBuffer(candidate.resumeFileKey)
    const mimeType   = candidate.resumeFileType || 'application/octet-stream'
    const safeFileName = encodeURIComponent(candidate.resumeFileName || 'resume')

    const disposition = download
      ? `attachment; filename*=UTF-8''${safeFileName}`
      : `inline; filename*=UTF-8''${safeFileName}`

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type':        mimeType,
        'Content-Disposition': disposition,
        'Content-Length':      String(fileBuffer.length),
        'Cache-Control':       'private, no-cache',
      }
    })
  } catch (e: any) {
    return c.json({ success: false, message: `文件读取失败: ${e.message}` }, 500)
  }
})

// POST /api/candidates/:id/resume - 上传（替换）简历文件
candidates.post('/:id/resume', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const candidate = await db.getCandidateById(id)
    if (!candidate) return c.json({ success: false, message: '候选人不存在' }, 404)

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ success: false, message: '请选择要上传的文件' }, 400)

    const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp']
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExts.includes(fileExt))
      return c.json({ success: false, message: '仅支持 PDF、Word、JPG、PNG 格式' }, 400)
    if (file.size > 20 * 1024 * 1024)
      return c.json({ success: false, message: '文件大小不能超过 20MB' }, 400)

    // 删除旧文件
    if (candidate.resumeFileKey) {
      try { await deleteFile(candidate.resumeFileKey) } catch {}
    }

    // 保存新文件到本地
    const fileKey  = generateFileKey(id, file.name)
    const buffer   = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || `application/${fileExt}`
    await uploadFile(fileKey, buffer, mimeType)

    // 更新 MySQL 元数据
    await db.saveResumeFileMeta(id, {
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      fileKey,
    })

    return c.json({
      success: true,
      message: '简历文件上传成功',
      data: {
        fileName:   file.name,
        fileType:   mimeType,
        fileSize:   file.size,
        previewUrl: `/api/candidates/${id}/resume`,
      }
    })
  } catch (e: any) {
    return c.json({ success: false, message: `上传失败: ${e.message}` }, 500)
  }
})

// DELETE /api/candidates/:id/resume - 删除简历文件
candidates.delete('/:id/resume', async (c) => {
  const id = parseInt(c.req.param('id'))
  const fileKey = await db.getResumeFileKey(id)
  if (!fileKey) return c.json({ success: false, message: '文件不存在' }, 404)

  try { await deleteFile(fileKey) } catch {}
  await db.clearResumeFileMeta(id)
  return c.json({ success: true, message: '简历文件已删除' })
})

export default candidates
