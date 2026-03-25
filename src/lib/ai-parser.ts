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

export async function parseResumeWithAI(
  resumeText: string, 
  apiKey: string,
  apiBaseUrl: string = 'https://api.openai.com/v1'
): Promise<AIParseResult> {
  const truncatedText = resumeText.slice(0, 8000) // 限制输入长度
  
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
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
export async function extractTextFromFile(
  fileContent: ArrayBuffer,
  fileName: string,
  mimeType: string,
  apiKey: string,
  apiBaseUrl: string = 'https://api.openai.com/v1'
): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  
  // 如果是纯文本，直接解码
  if (['txt', 'html', 'htm'].includes(ext) || mimeType === 'text/plain') {
    return new TextDecoder('utf-8', { fatal: false }).decode(fileContent)
  }
  
  // 对于PDF、Word等文件，尝试提取可见文本
  // 在实际生产中，可以对接专业PDF解析服务
  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(fileContent)
  
  // 简单清洗：提取可读字符
  const cleanText = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // 如果提取的文本太少，使用GPT-4o Vision处理（对于图片类型）
  if (cleanText.length < 100 && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return await extractTextFromImageWithVision(fileContent, mimeType, apiKey, apiBaseUrl)
  }
  
  return cleanText
}

async function extractTextFromImageWithVision(
  imageData: ArrayBuffer,
  mimeType: string,
  apiKey: string,
  apiBaseUrl: string
): Promise<string> {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageData)))
  const dataUrl = `data:${mimeType};base64,${base64}`
  
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
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
