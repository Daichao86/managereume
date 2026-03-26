// ==========================================
// 用户管理 API 路由
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import type { SystemUser } from '../lib/database'

const users = new Hono()

// GET /api/users - 获取用户列表
users.get('/', (c) => {
  const q = c.req.query()
  const { list, total } = db.getUsers({
    keyword: q.keyword,
    role: q.role,
    status: q.status,
    page: q.page ? parseInt(q.page) : 1,
    pageSize: q.pageSize ? parseInt(q.pageSize) : 20
  })
  return c.json({ success: true, data: list, total })
})

// GET /api/users/:id - 获取单个用户
users.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  const user = db.getUserById(id)
  if (!user) return c.json({ success: false, message: '用户不存在' }, 404)
  return c.json({ success: true, data: user })
})

// POST /api/users - 新增用户
users.post('/', async (c) => {
  try {
    const body = await c.req.json() as SystemUser
    if (!body.username?.trim()) return c.json({ success: false, message: '登录名不能为空' }, 400)
    if (!body.realName?.trim()) return c.json({ success: false, message: '真实姓名不能为空' }, 400)
    if (!body.email?.trim()) return c.json({ success: false, message: '邮箱不能为空' }, 400)
    if (!body.password?.trim()) return c.json({ success: false, message: '密码不能为空' }, 400)
    if (body.password.length < 6) return c.json({ success: false, message: '密码不能少于6位' }, 400)

    const validRoles = ['admin', 'hr', 'interviewer', 'viewer']
    if (!validRoles.includes(body.role)) return c.json({ success: false, message: '无效的角色' }, 400)

    const result = db.createUser(body)
    if (result.error) return c.json({ success: false, message: result.error }, 409)
    return c.json({ success: true, data: result.user, message: '用户创建成功' }, 201)
  } catch (e: any) {
    return c.json({ success: false, message: `创建失败: ${e.message}` }, 500)
  }
})

// PUT /api/users/:id - 更新用户
users.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json() as Partial<SystemUser>
    // 如果传了密码，验证长度
    if (body.password !== undefined && body.password !== '' && body.password.length < 6) {
      return c.json({ success: false, message: '密码不能少于6位' }, 400)
    }
    const result = db.updateUser(id, body)
    if (result.error) return c.json({ success: false, message: result.error }, 409)
    return c.json({ success: true, data: result.user, message: '用户更新成功' })
  } catch (e: any) {
    return c.json({ success: false, message: `更新失败: ${e.message}` }, 500)
  }
})

// PATCH /api/users/:id/status - 启用/禁用切换
users.patch('/:id/status', (c) => {
  const id = parseInt(c.req.param('id'))
  const result = db.toggleUserStatus(id)
  if (result.error) return c.json({ success: false, message: result.error }, 404)
  const action = result.user?.status === 'active' ? '启用' : '禁用'
  return c.json({ success: true, data: result.user, message: `用户已${action}` })
})

// DELETE /api/users/:id - 删除用户
users.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  // 不允许删除 id=1 的超级管理员
  if (id === 1) return c.json({ success: false, message: '超级管理员不可删除' }, 403)
  const ok = db.deleteUser(id)
  if (!ok) return c.json({ success: false, message: '用户不存在' }, 404)
  return c.json({ success: true, message: '用户已删除' })
})

// GET /api/users/stats/overview - 用户统计
users.get('/stats/overview', (c) => {
  const { list } = db.getUsers({ pageSize: 9999 })
  const total = list.length
  const byRole = list.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc }, {} as Record<string, number>)
  const byStatus = list.reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc }, {} as Record<string, number>)
  return c.json({ success: true, data: { total, byRole, byStatus } })
})

export default users
