// ==========================================
// 文件存储服务 - 服务器本地文件系统
// 简历原件保存在服务器磁盘，通过 Node.js 流式输出给前端
//
// 目录结构:
//   {UPLOAD_DIR}/
//     resumes/
//       {candidateId}/
//         {timestamp}-{filename}   ← 简历原件
//
// 环境变量:
//   UPLOAD_DIR  - 文件根目录（默认 ./uploads，建议生产设为绝对路径）
// ==========================================
import fs   from 'fs'
import path from 'path'

// 文件根目录（可通过环境变量自定义）
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'uploads')

// 启动时确保目录存在
const RESUMES_DIR = path.join(UPLOAD_DIR, 'resumes')
if (!fs.existsSync(RESUMES_DIR)) {
  fs.mkdirSync(RESUMES_DIR, { recursive: true })
  console.log(`📁 创建文件存储目录: ${RESUMES_DIR}`)
}

// ==========================================
// 生成文件存储路径（含候选人子目录）
// 格式: resumes/{candidateId}/{timestamp}-{safeFilename}
// ==========================================
export function generateFileKey(candidateId: number, fileName: string): string {
  const ts = Date.now()
  // 清理文件名：保留中文、字母、数字、点和横线，其余替换为下划线
  const safeName = fileName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
  return path.join('resumes', String(candidateId), `${ts}-${safeName}`)
}

// 通过 key 得到绝对磁盘路径
export function keyToAbsPath(key: string): string {
  // 防路径穿越：确保 key 不包含 ../
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '')
  return path.join(UPLOAD_DIR, normalized)
}

// ==========================================
// 保存文件到本地磁盘
// ==========================================
export async function uploadFile(
  key: string,
  buffer: Buffer,
  _mimeType: string   // 本地存储不需要 MIME，保留参数兼容接口
): Promise<void> {
  const absPath = keyToAbsPath(key)
  // 确保候选人子目录存在
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  await fs.promises.writeFile(absPath, buffer)
}

// ==========================================
// 读取文件内容（Buffer）
// ==========================================
export async function getFileBuffer(key: string): Promise<Buffer> {
  const absPath = keyToAbsPath(key)
  if (!fs.existsSync(absPath)) {
    throw new Error(`文件不存在: ${key}`)
  }
  return fs.promises.readFile(absPath)
}

// ==========================================
// 删除文件
// ==========================================
export async function deleteFile(key: string): Promise<void> {
  const absPath = keyToAbsPath(key)
  if (fs.existsSync(absPath)) {
    await fs.promises.unlink(absPath)
    // 删除空的候选人子目录
    const dir = path.dirname(absPath)
    const remaining = fs.readdirSync(dir)
    if (remaining.length === 0) {
      fs.rmdirSync(dir)
    }
  }
}

// ==========================================
// 获取文件基本信息
// ==========================================
export function getFileStat(key: string): { size: number; mtime: Date } | undefined {
  const absPath = keyToAbsPath(key)
  if (!fs.existsSync(absPath)) return undefined
  const stat = fs.statSync(absPath)
  return { size: stat.size, mtime: stat.mtime }
}

// ==========================================
// 获取可读流（大文件流式输出，避免内存占用）
// ==========================================
export function getFileStream(key: string): fs.ReadStream {
  const absPath = keyToAbsPath(key)
  if (!fs.existsSync(absPath)) {
    throw new Error(`文件不存在: ${key}`)
  }
  return fs.createReadStream(absPath)
}

// ==========================================
// 本地存储没有"预签名URL"概念
// 统一通过 /api/candidates/:id/resume 接口输出
// 下面两个函数返回空字符串，让路由层统一处理
// ==========================================
export async function getPresignedUrl(_key: string, _expiry?: number): Promise<string> {
  return ''   // 本地模式：由 Node.js 接口直接输出文件流
}

export async function getDownloadUrl(_key: string, _fileName: string, _expiry?: number): Promise<string> {
  return ''   // 同上
}
