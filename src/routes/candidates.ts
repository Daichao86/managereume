// ==========================================
// 候选人管理API路由
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import type { Candidate, SearchParams } from '../types'

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

export default candidates
