// ==========================================
// 文件存储服务 - 腾讯云 COS（对象存储）
// 依赖环境变量:
//   COS_SECRET_ID   - 腾讯云 SecretId
//   COS_SECRET_KEY  - 腾讯云 SecretKey
//   COS_BUCKET      - 存储桶名称，含 AppId，如 resumes-1234567890
//   COS_REGION      - 地域，如 ap-guangzhou / ap-shanghai / ap-beijing
// ==========================================
import COS from 'cos-nodejs-sdk-v5'

const BUCKET = process.env.COS_BUCKET  || 'resumes-1234567890'
const REGION = process.env.COS_REGION  || 'ap-guangzhou'

const cos = new COS({
  SecretId:  process.env.COS_SECRET_ID  || '',
  SecretKey: process.env.COS_SECRET_KEY || '',
  // 请求超时 30 秒
  Timeout: 30000,
})

// ==========================================
// 生成对象 Key（唯一路径）
// 格式: resumes/{candidateId}/{timestamp}-{filename}
// ==========================================
export function generateFileKey(candidateId: number, fileName: string): string {
  const ts = Date.now()
  // 清理文件名中的特殊字符，保留中文、字母、数字、点和横线
  const safeName = fileName.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
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
  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
        // 服务端加密（可选，推荐开启）
        // ServerSideEncryption: 'AES256',
      },
      (err) => {
        if (err) reject(new Error(`COS 上传失败: ${err.message || JSON.stringify(err)}`))
        else resolve()
      }
    )
  })
}

// ==========================================
// 获取预签名访问 URL（有效期默认 1 小时）
// 用于前端直接预览，无需经过 Node.js 中转
// ==========================================
export async function getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
  return new Promise((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Sign: true,
        Expires: expirySeconds,
      },
      (err, data) => {
        if (err) reject(new Error(`获取预签名URL失败: ${err.message || JSON.stringify(err)}`))
        else resolve(data.Url)
      }
    )
  })
}

// ==========================================
// 生成强制下载的预签名 URL
// ==========================================
export async function getDownloadUrl(key: string, fileName: string, expirySeconds = 3600): Promise<string> {
  return new Promise((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Sign: true,
        Expires: expirySeconds,
        Query: {
          'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      },
      (err, data) => {
        if (err) reject(new Error(`获取下载URL失败: ${err.message || JSON.stringify(err)}`))
        else resolve(data.Url)
      }
    )
  })
}

// ==========================================
// 删除文件
// ==========================================
export async function deleteFile(key: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    cos.deleteObject(
      { Bucket: BUCKET, Region: REGION, Key: key },
      (err) => {
        if (err) reject(new Error(`COS 删除失败: ${err.message || JSON.stringify(err)}`))
        else resolve()
      }
    )
  })
}

// ==========================================
// 获取文件 Buffer（Node.js 中转流式输出，备用）
// ==========================================
export async function getFileBuffer(key: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    cos.getObject(
      { Bucket: BUCKET, Region: REGION, Key: key },
      (err, data) => {
        if (err) reject(new Error(`COS 下载失败: ${err.message || JSON.stringify(err)}`))
        else resolve(data.Body as Buffer)
      }
    )
  })
}

// ==========================================
// 获取文件基本信息（大小、类型、最后修改时间）
// ==========================================
export async function getFileStat(key: string): Promise<{ size: number; contentType: string; lastModified: string }> {
  return new Promise((resolve, reject) => {
    cos.headObject(
      { Bucket: BUCKET, Region: REGION, Key: key },
      (err, data) => {
        if (err) reject(new Error(`COS 获取文件信息失败: ${err.message || JSON.stringify(err)}`))
        else resolve({
          size: parseInt(data.headers?.['content-length'] || '0'),
          contentType: data.headers?.['content-type'] || '',
          lastModified: data.headers?.['last-modified'] || '',
        })
      }
    )
  })
}

export { cos, BUCKET, REGION }
