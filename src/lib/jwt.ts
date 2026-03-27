// ==========================================
// JWT 工具 - 使用 Web Crypto API（Node.js 原生支持）
// 不依赖第三方库，HS256 算法
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET || 'resume-talent-mgr-secret-2024'
const JWT_EXPIRES = 7 * 24 * 60 * 60 // 7天，单位秒

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str: string): string {
  const pad = str.length % 4
  const padded = str + (pad ? '='.repeat(4 - pad) : '')
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Buffer.from(sig).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret)
  return expected === signature
}

export interface JwtPayload {
  id: number
  username: string
  role: string
  iat?: number
  exp?: number
}

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = base64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRES }))
  const sig = await hmacSign(`${header}.${body}`, JWT_SECRET)
  return `${header}.${body}.${sig}`
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const valid = await hmacVerify(`${header}.${body}`, sig, JWT_SECRET)
    if (!valid) return null
    const payload = JSON.parse(base64urlDecode(body)) as JwtPayload
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
