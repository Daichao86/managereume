// ==========================================
// 密码哈希工具 - 使用 Node.js 原生 crypto
// PBKDF2 算法，不依赖 bcrypt 等第三方库
// 同时兼容旧版明文密码
// ==========================================
import { createHash, randomBytes, pbkdf2Sync } from 'crypto'

const ITERATIONS = 100000
const KEYLEN = 64
const DIGEST = 'sha512'
const PREFIX = '$pbkdf2$'

// 生成哈希密码
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(plain, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
  return `${PREFIX}${salt}$${hash}`
}

// 验证密码（兼容明文旧密码）
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false
  // 新格式：PBKDF2 哈希
  if (stored.startsWith(PREFIX)) {
    const parts = stored.split('$')
    // $pbkdf2$salt$hash → parts: ['', 'pbkdf2', salt, hash]
    if (parts.length < 4) return false
    const salt = parts[2]
    const hash = parts[3]
    const derived = pbkdf2Sync(plain, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
    return derived === hash
  }
  // 旧格式：明文直接比对（兼容旧数据库，登录成功后可升级）
  return plain === stored
}
