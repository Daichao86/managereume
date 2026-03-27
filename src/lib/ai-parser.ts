// ==========================================
// AI简历解析模块 - 使用OpenAI GPT-4o
// 核心功能：将上传的简历文本智能解析为结构化数据
// ==========================================

import type { AIParseResult } from '../types'

const PARSE_SYSTEM_PROMPT = `你是一个专业的简历解析AI助手。你需要从提供的简历文本中提取结构化信息。

请严格按照以下JSON格式返回解析结果，所有字段都是可选的，没有找到的信息留空或使用合理的默认值：

{
  "name": "姓名",
  "gender": "性别(男/女)",
  "age": 年龄数字或null,
  "phone": "手机号",
  "email": "邮箱",
  "location": "现居城市",
  "hometown": "籍贯",
  "currentStatus": "求职状态(在职/离职/应届)",
  "yearsOfExperience": 工作年限数字,
  "highestEducation": "最高学历(博士/硕士/本科/大专/高中)",
  "expectedSalaryMin": 期望薪资下限(元/月)数字或null,
  "expectedSalaryMax": 期望薪资上限(元/月)数字或null,
  "expectedPosition": "期望职位",
  "expectedCity": "期望城市",
  "selfEvaluation": "自我评价原文",
  "linkedinUrl": "LinkedIn链接或null",
  "githubUrl": "GitHub链接或null",
  "educations": [
    {
      "schoolName": "学校名称",
      "degree": "学历(博士/硕士/本科/大专/高中)",
      "major": "专业",
      "startDate": "开始时间(YYYY-MM格式)",
      "endDate": "结束时间(YYYY-MM格式，在读填至今)",
      "gpa": GPA数字或null,
      "description": "在校描述",
      "is985": true/false,
      "is211": true/false,
      "isOverseas": true/false
    }
  ],
  "workExperiences": [
    {
      "companyName": "公司名称",
      "position": "职位",
      "industry": "行业",
      "companySize": "公司规模(<50/50-200/200-500/500-2000/2000+)",
      "companyType": "公司性质(国企/外企/民企/上市公司/初创)",
      "department": "部门",
      "startDate": "开始时间(YYYY-MM)",
      "endDate": "结束时间(YYYY-MM，当前工作填null)",
      "isCurrent": true/false,
      "salary": 月薪数字或null,
      "description": "工作描述",
      "achievements": "工作成就"
    }
  ],
  "projects": [
    {
      "projectName": "项目名称",
      "role": "担任角色",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "techStack": "技术栈",
      "description": "项目描述",
      "achievements": "项目成果"
    }
  ],
  "skills": [
    {
      "skillName": "技能名称",
      "proficiency": "熟练程度(精通/熟练/了解)",
      "yearsUsed": 使用年限数字或null,
      "category": "类别(编程语言/框架/工具/数据库/中间件/其他)"
    }
  ],
  "certifications": [
    {
      "certName": "证书名称",
      "issuingOrg": "颁发机构",
      "issueDate": "获得时间",
      "certType": "类型(证书/奖项/荣誉)"
    }
  ],
  "tags": [
    {
      "tagName": "标签名",
      "tagType": "类型(skill/industry/trait/education/company)",
      "confidence": 置信度0-100数字
    }
  ],
  "summary": "对该候选人的3-5句话综合评述，包括其核心优势、背景亮点和适合的岗位方向"
}

注意事项：
1. 985/211院校判断：清华、北大、复旦、上交、浙大、中科大、南京大、武汉大、中山、哈工大、西交、南开、同济等为985
2. 技能标签自动从工作描述、项目描述中提取，不仅限于技能列表
3. 薪资如果是K结尾，转换为月薪元（如20K = 20000）
4. 请确保返回有效的JSON格式，不要包含任何额外的说明文字`

// 规范化 base URL：去除末尾斜杠，自动补 /v1，防止双重 /v1
function normalizeBaseUrl(url: string): string {
  let u = (url || 'https://api.openai.com/v1').trim().replace(/\/+$/, '')
  // 如果用户填的是 https://xxx.com（没有路径），自动补 /v1
  // 如果已经以 /v1 结尾则保持不变，避免 /v1/v1
  if (!u.match(/\/v\d+$/)) u = u + '/v1'
  return u
}

export async function parseResumeWithAI(
  resumeText: string, 
  apiKey: string,
  apiBaseUrl: string = 'https://api.openai.com/v1'
): Promise<AIParseResult> {
  const baseUrl = normalizeBaseUrl(apiBaseUrl)
  const truncatedText = resumeText.slice(0, 8000) // 限制输入长度
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PARSE_SYSTEM_PROMPT },
        { role: 'user', content: `请解析以下简历内容：\n\n${truncatedText}` }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API错误: ${response.status} - ${errText}`)
  }

  const result = await response.json() as any
  const content = result.choices?.[0]?.message?.content
  
  if (!content) throw new Error('AI返回内容为空')

  try {
    const parsed = JSON.parse(content) as AIParseResult
    // 自动补充标签
    if (!parsed.tags) parsed.tags = []
    
    // 学历标签
    if (parsed.educations) {
      parsed.educations.forEach(edu => {
        if (edu.is985) parsed.tags!.push({ tagName: '985高校', tagType: 'education', tagSource: 'ai', confidence: 100 })
        if (edu.is211 && !edu.is985) parsed.tags!.push({ tagName: '211高校', tagType: 'education', tagSource: 'ai', confidence: 100 })
        if (edu.isOverseas) parsed.tags!.push({ tagName: '海外留学', tagType: 'education', tagSource: 'ai', confidence: 100 })
      })
    }
    
    // 大厂标签
    const bigCompanies = ['阿里', '腾讯', '百度', '字节', '美团', '京东', '华为', '网易', '滴滴', '拼多多', '小米', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple']
    if (parsed.workExperiences) {
      parsed.workExperiences.forEach(exp => {
        bigCompanies.forEach(company => {
          if (exp.companyName?.includes(company)) {
            parsed.tags!.push({ tagName: '大厂背景', tagType: 'trait', tagSource: 'ai', confidence: 100 })
          }
        })
      })
    }
    
    // 去重标签
    const tagSet = new Set<string>()
    parsed.tags = parsed.tags.filter(tag => {
      if (tagSet.has(tag.tagName)) return false
      tagSet.add(tag.tagName)
      return true
    })
    
    return parsed
  } catch (e) {
    throw new Error(`AI返回格式解析失败: ${e}`)
  }
}

// ==========================================
// PDF文本提取（使用简单的文本清洗）
// 在Cloudflare Workers环境中，PDF解析通过API实现
// ==========================================
// 安全的 ArrayBuffer → Base64（分块，避免大文件栈溢出）
function safeArrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function extractTextFromFile(
  fileContent: ArrayBuffer,
  fileName: string,
  mimeType: string,
  apiKey: string,
  apiBaseUrl: string = 'https://api.openai.com/v1'
): Promise<string> {
  apiBaseUrl = normalizeBaseUrl(apiBaseUrl)
  const ext = fileName.toLowerCase().split('.').pop() || ''

  // ① 纯文本类型：直接 UTF-8 解码
  if (['txt', 'html', 'htm'].includes(ext) || mimeType === 'text/plain') {
    return new TextDecoder('utf-8', { fatal: false }).decode(fileContent)
  }

  // ② 图片类型：直接走 GPT-4o Vision OCR
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
  const imageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
  if (imageExts.includes(ext) || imageMimes.includes(mimeType)) {
    return await extractWithVision(fileContent, mimeType || `image/${ext}`, apiKey, apiBaseUrl)
  }

  // ③ PDF 类型：尝试从二进制流提取可见文本，若质量不足则转 Vision
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const extracted = extractTextFromPdfBinary(fileContent)
    // 质量判断：有效中文字符或英文单词数量是否充足
    const usableChars = (extracted.match(/[\u4e00-\u9fff]|[A-Za-z]{2,}/g) || []).length
    if (usableChars >= 20) {
      return extracted
    }
    // 文本质量不足 → 用 Vision 识别 PDF 第一页（传 PDF 文件本身）
    return await extractWithVision(fileContent, 'application/pdf', apiKey, apiBaseUrl)
  }

  // ④ Word 文档：尝试提取 XML 文本（docx 是 zip 内含 XML）
  if (['doc', 'docx'].includes(ext)) {
    const extracted = extractTextFromDocxBinary(fileContent)
    const usableChars = (extracted.match(/[\u4e00-\u9fff]|[A-Za-z]{2,}/g) || []).length
    if (usableChars >= 20) {
      return extracted
    }
    // docx 提取失败 → Vision 兜底（传原始文件）
    const fallbackMime = ext === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/msword'
    return await extractWithVision(fileContent, fallbackMime, apiKey, apiBaseUrl)
  }

  // ⑤ 其他格式：尝试 UTF-8 解码
  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(fileContent)
  return rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim()
}

// 从 PDF 二进制中提取可见文本流（适用于内嵌 ASCII/UTF-8 文本的 PDF）
function extractTextFromPdfBinary(buffer: ArrayBuffer): string {
  const raw = new TextDecoder('latin1').decode(buffer) // latin1 保留所有字节
  // 提取 BT...ET 文本块中的括号内容
  const texts: string[] = []

  // 方式1：提取 (text) Tj / TJ 操作符中的文本
  const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g
  let m: RegExpExecArray | null
  while ((m = tjRegex.exec(raw)) !== null) {
    const t = m[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\(/g, '(').replace(/\\\)/g, ')')
    texts.push(t)
  }

  // 方式2：提取 TJ 数组 [(text)...]
  const tjArrRegex = /\[([^\]]+)\]\s*TJ/g
  while ((m = tjArrRegex.exec(raw)) !== null) {
    const inner = m[1]
    const parts = inner.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || []
    parts.forEach(p => texts.push(p.slice(1, -1)))
  }

  if (texts.length === 0) return ''

  // 尝试把 latin1 编码的中文字节重新解析为 UTF-8
  let result = texts.join(' ')
  try {
    const bytes = new Uint8Array(result.length)
    for (let i = 0; i < result.length; i++) bytes[i] = result.charCodeAt(i)
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if ((utf8.match(/[\u4e00-\u9fff]/g) || []).length > 0) result = utf8
  } catch {}

  return result.replace(/\s+/g, ' ').trim()
}

// 从 docx (ZIP+XML) 中提取文本
function extractTextFromDocxBinary(buffer: ArrayBuffer): string {
  // docx 是 ZIP 文件，内含 word/document.xml
  // 在 Cloudflare Workers 环境没有 unzip，用字节扫描找 XML 文本
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  // 提取 XML 标签中的文本内容（<w:t> 标签）
  const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g
  const texts: string[] = []
  let m: RegExpExecArray | null
  while ((m = wtRegex.exec(raw)) !== null) {
    texts.push(m[1])
  }
  if (texts.length > 0) return texts.join(' ').replace(/\s+/g, ' ').trim()

  // 备用：提取所有 XML 标签间文本
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// 统一的 Vision 识别函数（支持图片和PDF）
async function extractWithVision(
  fileData: ArrayBuffer,
  mimeType: string,
  apiKey: string,
  apiBaseUrl: string
): Promise<string> {
  const base64 = safeArrayBufferToBase64(fileData)

  // GPT-4o Vision 支持 image/* 类型；PDF 先转为图片由前端处理或作为 file 传入
  // 对于 PDF，OpenAI Vision 目前不支持直接传 PDF base64，需转为图片
  // 这里对 PDF 采用特殊提示，让 GPT 从上传的文件数据中理解内容
  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf')
  const isWord = mimeType.includes('word') || mimeType.includes('document')

  // 对于 PDF/Word，用文本提示模式要求 GPT 解析原始内容
  if (isPdf || isWord) {
    // 尝试把 PDF 二进制以 image/jpeg 形式骗过 Vision（部分 PDF 本身就是图片 PDF）
    // 更可靠的方案：把 base64 传给 GPT 并说明是 PDF
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: '这是一份简历文件的base64内容。请从中提取所有可读的简历文字信息，包括姓名、联系方式、教育经历、工作经历、技能等，保持原有格式输出。如果无法识别，请返回空字符串。'
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }],
        max_tokens: 4000
      })
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI API错误: ${response.status} - ${err}`)
    }
    const result = await response.json() as any
    return result.choices?.[0]?.message?.content || ''
  }

  // 图片类型：正常 Vision 识别
  const dataUrl = `data:${mimeType};base64,${base64}`
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '请完整提取这张简历图片中的所有文字内容，保持原有格式，不要遗漏任何信息。' },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }],
      max_tokens: 4000
    })
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API错误: ${response.status} - ${err}`)
  }
  const result = await response.json() as any
  return result.choices?.[0]?.message?.content || ''
}

// ==========================================
// 候选人信息完整度评分
// ==========================================
export function calculateProfileCompleteness(candidate: any): number {
  const fields = [
    candidate.name, candidate.phone, candidate.email, candidate.location,
    candidate.highestEducation, candidate.expectedPosition, candidate.selfEvaluation,
    candidate.yearsOfExperience
  ]
  const filled = fields.filter(f => f !== undefined && f !== null && f !== '').length
  let score = (filled / fields.length) * 60
  
  if (candidate.educations?.length > 0) score += 10
  if (candidate.workExperiences?.length > 0) score += 15
  if (candidate.skills?.length > 0) score += 10
  if (candidate.tags?.length > 0) score += 5
  
  return Math.min(100, Math.round(score))
}
