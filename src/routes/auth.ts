// ==========================================
// 认证 API 路由 - 登录 / 登出 / 当前用户
// ==========================================
import { Hono } from 'hono'
import { db } from '../lib/database'
import { signToken, verifyToken } from '../lib/jwt'
import { hashPassword, verifyPassword } from '../lib/crypto'

const auth = new Hono()

// POST /api/auth/login
auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()
    if (!username || !password) {
      return c.json({ success: false, message: '请输入用户名和密码' }, 400)
    }

    const user = await db.getUserByUsername(username)
    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }
    if (user.status === 'disabled') {
      return c.json({ success: false, message: '账号已被禁用，请联系管理员' }, 403)
    }

    // 验证密码（支持明文和 bcrypt 两种格式）
    const ok = await verifyPassword(password, user.password || '')
    if (!ok) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }

    // 更新最后登录时间
    await db.updateLastLogin(user.id!)

    // 签发 JWT
    const token = await signToken({ id: user.id, username: user.username, role: user.role })

    // 脱敏返回用户信息
    const { password: _pw, ...safeUser } = user as any
    return c.json({ success: true, token, user: safeUser, message: '登录成功' })

  } catch (e: any) {
    return c.json({ success: false, message: `登录失败: ${e.message}` }, 500)
  }
})

// GET /api/auth/me - 获取当前登录用户信息
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return c.json({ success: false, message: '未登录' }, 401)

    const payload = await verifyToken(token)
    if (!payload) return c.json({ success: false, message: 'token已过期，请重新登录' }, 401)

    const user = await db.getUserById(payload.id)
    if (!user) return c.json({ success: false, message: '用户不存在' }, 401)
    if (user.status === 'disabled') return c.json({ success: false, message: '账号已被禁用' }, 403)

    const { password: _pw, ...safeUser } = user as any
    return c.json({ success: true, user: safeUser })
  } catch (e: any) {
    return c.json({ success: false, message: '认证失败' }, 401)
  }
})

// POST /api/auth/logout（前端清除 token 即可，此接口仅做记录）
auth.post('/logout', (c) => {
  return c.json({ success: true, message: '已退出登录' })
})

// POST /api/auth/change-password - 修改密码
auth.post('/change-password', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const payload = await verifyToken(token)
    if (!payload) return c.json({ success: false, message: '未登录' }, 401)

    const { oldPassword, newPassword } = await c.req.json()
    if (!oldPassword || !newPassword) return c.json({ success: false, message: '请填写旧密码和新密码' }, 400)
    if (newPassword.length < 6) return c.json({ success: false, message: '新密码不能少于6位' }, 400)

    const user = await db.getUserByUsername(payload.username)
    if (!user) return c.json({ success: false, message: '用户不存在' }, 404)

    const ok = await verifyPassword(oldPassword, user.password || '')
    if (!ok) return c.json({ success: false, message: '旧密码错误' }, 400)

    const hashed = await hashPassword(newPassword)
    await db.updateUser(payload.id, { password: hashed })
    return c.json({ success: true, message: '密码修改成功' })
  } catch (e: any) {
    return c.json({ success: false, message: `修改失败: ${e.message}` }, 500)
  }
})

export default auth
