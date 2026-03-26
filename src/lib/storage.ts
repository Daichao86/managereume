// ==========================================
// 文件存储服务 - MinIO / S3 兼容对象存储
// 依赖环境变量:
//   MINIO_ENDPOINT  - MinIO 服务地址 (如 192.168.1.100)
//   MINIO_PORT      - 端口 (默认 9000)
//   MINIO_USE_SSL   - 是否启用 SSL (默认 false)
//   MINIO_ACCESS_KEY
//   MINIO_SECRET_KEY
//   MINIO_BUCKET    - 存储桶名称 (默认 resumes)
// ==========================================
import { Client } from 'minio'

const BUCKET = process.env.MINIO_BUCKET || 'resumes'

const minioClient = new Client({
  endPoint:  process.env.MINIO_ENDPOINT  || '127.0.0.1',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

// ==========================================
// 初始化：确保 Bucket 存在
// ==========================================
async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET)
    if (!exists) {
      await minioClient.makeBucket(BUCKET, 'us-east-1')
      console.log(`✅ MinIO Bucket "${BUCKET}" 创建成功`)
    }
  } catch (err) {
    console.error('❌ MinIO 初始化失败，请检查连接配置:', err)
  }
}
ensureBucket()

// ==========================================
// 生成对象 Key（唯一路径）
// 格式: resumes/{candidateId}/{timestamp}-{filename}
// ==========================================
export function generateFileKey(candidateId: number, fileName: string): string {
  const ts = Date.now()
  // 清理文件名中的特殊字符
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_\u4e00-\u9fa5]/g, '_')
  return `resumes/${candidateId}/${ts}-${safeName}`
}

// ==========================================
// 上传文件（Buffer）
// ==========================================
export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': mimeType,
  })
}

// ==========================================
// 生成临时预签名访问 URL（有效期默认 1 小时）
// 用于前端直接预览/下载，无需经过 Node.js 中转
// ==========================================
export async function getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, key, expirySeconds)
}

// ==========================================
// 生成强制下载的预签名 URL
// ==========================================
export async function getDownloadUrl(key: string, fileName: string, expirySeconds = 3600): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, key, expirySeconds, {
    'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
  })
}

// ==========================================
// 删除文件
// ==========================================
export async function deleteFile(key: string): Promise<void> {
  await minioClient.removeObject(BUCKET, key)
}

// ==========================================
// 获取文件 Buffer（用于 Node.js 中转流式输出，可选）
// ==========================================
export async function getFileBuffer(key: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET, key)
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

// ==========================================
// 获取文件基本信息（大小、类型等）
// ==========================================
export async function getFileStat(key: string) {
  return minioClient.statObject(BUCKET, key)
}

export { minioClient, BUCKET }
