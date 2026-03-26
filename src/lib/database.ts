// ==========================================
// 数据存储层 - 使用内存存储（可替换为MySQL）
// 提供与MySQL兼容的接口
// ==========================================
import type { 
  Candidate, Education, WorkExperience, Project, 
  Skill, Certification, CandidateTag, InterviewRecord, ParseTask 
} from '../types'

// ==========================================
// 内存数据库（演示用）
// 生产环境替换为MySQL连接
// ==========================================
// 用户角色与状态
export type UserRole = 'admin' | 'hr' | 'interviewer' | 'viewer'
export type UserStatus = 'active' | 'disabled'

export interface SystemUser {
  id?: number
  username: string        // 登录名
  realName: string        // 真实姓名
  email: string
  phone?: string
  role: UserRole          // admin/hr/interviewer/viewer
  department?: string     // 所属部门
  status: UserStatus      // active/disabled
  password?: string       // 明文存储（演示用，生产应哈希）
  avatar?: string         // 头像首字母色
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
}

// 文件存储结构（独立存储，不混入候选人基础数据，避免列表查询时传输大体积数据）
interface ResumeFile {
  candidateId: number
  fileName: string
  fileType: string       // MIME 类型
  fileSize: number
  fileData: string       // Base64 编码的文件内容
  uploadedAt: string
}

class MemoryDatabase {
  private candidates: Map<number, Candidate> = new Map()
  private educations: Map<number, Education> = new Map()
  private workExperiences: Map<number, WorkExperience> = new Map()
  private projects: Map<number, Project> = new Map()
  private skills: Map<number, Skill> = new Map()
  private certifications: Map<number, Certification> = new Map()
  private tags: Map<number, CandidateTag> = new Map()
  private interviews: Map<number, InterviewRecord> = new Map()
  private parseTasks: Map<number, ParseTask> = new Map()
  // 简历文件独立存储（key = candidateId）
  private resumeFiles: Map<number, ResumeFile> = new Map()
  // 系统用户
  private users: Map<number, SystemUser> = new Map()
  private userIdCounter = 1

  private candidateIdCounter = 1
  private subIdCounter = 100

  constructor() {
    this.seedDemoData()
    this.seedDemoUsers()
  }

  private seedDemoData() {
    const demoData: Omit<Candidate, 'id'>[] = [
      {
        name: '张伟',
        gender: '男',
        age: 28,
        phone: '13800138001',
        email: 'zhangwei@email.com',
        location: '北京市朝阳区',
        hometown: '山东省济南市',
        highestEducation: '本科',
        yearsOfExperience: 5,
        expectedPosition: '高级Java工程师',
        expectedSalaryMin: 25000,
        expectedSalaryMax: 35000,
        expectedCity: '北京',
        currentStatus: '在职',
        candidateStatus: 'active',
        sourceChannel: 'BOSS直聘',
        matchScore: 92.5,
        selfEvaluation: '5年Java开发经验，熟练掌握Spring Boot、MyBatis、Redis、MySQL等技术栈，有良好的代码规范和团队协作能力。',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: '李娜',
        gender: '女',
        age: 26,
        phone: '13900139002',
        email: 'lina@email.com',
        location: '上海市浦东新区',
        hometown: '浙江省杭州市',
        highestEducation: '硕士',
        yearsOfExperience: 3,
        expectedPosition: '产品经理',
        expectedSalaryMin: 20000,
        expectedSalaryMax: 30000,
        expectedCity: '上海',
        currentStatus: '在职',
        candidateStatus: 'interviewing',
        sourceChannel: '智联招聘',
        matchScore: 88.0,
        selfEvaluation: '3年互联网产品经验，擅长用户研究、数据分析，有成熟的产品思维和项目管理能力。',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: '王强',
        gender: '男',
        age: 32,
        phone: '13700137003',
        email: 'wangqiang@email.com',
        location: '深圳市南山区',
        hometown: '广东省广州市',
        highestEducation: '本科',
        yearsOfExperience: 8,
        expectedPosition: '技术总监',
        expectedSalaryMin: 40000,
        expectedSalaryMax: 60000,
        expectedCity: '深圳',
        currentStatus: '离职',
        candidateStatus: 'active',
        sourceChannel: '猎头推荐',
        matchScore: 95.0,
        selfEvaluation: '8年研发经验，曾带领50人技术团队，主导多个百万级用户产品从0到1的落地，擅长技术架构设计和团队管理。',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: '陈晓雨',
        gender: '女',
        age: 24,
        phone: '13600136004',
        email: 'chenxiaoyu@email.com',
        location: '北京市海淀区',
        hometown: '四川省成都市',
        highestEducation: '本科',
        yearsOfExperience: 1,
        expectedPosition: '前端工程师',
        expectedSalaryMin: 12000,
        expectedSalaryMax: 18000,
        expectedCity: '北京/上海',
        currentStatus: '应届',
        candidateStatus: 'active',
        sourceChannel: '校园招聘',
        matchScore: 75.5,
        selfEvaluation: '985高校计算机专业应届生，熟练掌握Vue.js、React、TypeScript，有多个实习和项目经验。',
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: '刘明',
        gender: '男',
        age: 30,
        phone: '13500135005',
        email: 'liuming@email.com',
        location: '杭州市西湖区',
        hometown: '江苏省南京市',
        highestEducation: '硕士',
        yearsOfExperience: 6,
        expectedPosition: '算法工程师',
        expectedSalaryMin: 35000,
        expectedSalaryMax: 50000,
        expectedCity: '杭州/北京',
        currentStatus: '在职',
        candidateStatus: 'active',
        sourceChannel: 'LinkedIn',
        matchScore: 89.0,
        selfEvaluation: '6年机器学习/深度学习经验，发表SCI论文3篇，在推荐系统、NLP领域有丰富的工程实践经验。',
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    const demoEducations: Record<number, Education[]> = {
      1: [{ candidateId: 1, schoolName: '山东大学', degree: '本科', major: '计算机科学与技术', startDate: '2014-09', endDate: '2018-07', is985: true, is211: true, sortOrder: 0 }],
      2: [
        { candidateId: 2, schoolName: '复旦大学', degree: '硕士', major: '工商管理', startDate: '2019-09', endDate: '2021-07', is985: true, is211: true, sortOrder: 0 },
        { candidateId: 2, schoolName: '上海交通大学', degree: '本科', major: '工业工程', startDate: '2015-09', endDate: '2019-07', is985: true, is211: true, sortOrder: 1 }
      ],
      3: [{ candidateId: 3, schoolName: '华南理工大学', degree: '本科', major: '软件工程', startDate: '2010-09', endDate: '2014-07', is985: true, is211: true, sortOrder: 0 }],
      4: [{ candidateId: 4, schoolName: '北京航空航天大学', degree: '本科', major: '计算机科学', startDate: '2020-09', endDate: '2024-07', is985: true, is211: true, sortOrder: 0 }],
      5: [
        { candidateId: 5, schoolName: '浙江大学', degree: '硕士', major: '计算机应用技术', startDate: '2017-09', endDate: '2020-07', is985: true, is211: true, sortOrder: 0 },
        { candidateId: 5, schoolName: '南京大学', degree: '本科', major: '数学与应用数学', startDate: '2013-09', endDate: '2017-07', is985: true, is211: true, sortOrder: 1 }
      ]
    }

    const demoWorkExps: Record<number, WorkExperience[]> = {
      1: [
        { candidateId: 1, companyName: '字节跳动', position: 'Java工程师', industry: '互联网', companySize: '2000+', companyType: '上市公司', startDate: '2021-06', endDate: undefined, isCurrent: true, description: '负责抖音电商平台后端开发，主导设计订单系统微服务架构，QPS从1000提升至10000+', sortOrder: 0 },
        { candidateId: 1, companyName: '滴滴出行', position: 'Java开发工程师', industry: '互联网', companySize: '2000+', companyType: '上市公司', startDate: '2018-07', endDate: '2021-05', isCurrent: false, description: '负责出行订单系统开发，优化数据库查询性能，响应时间降低40%', sortOrder: 1 }
      ],
      2: [
        { candidateId: 2, companyName: '阿里巴巴', position: '高级产品经理', industry: '互联网电商', companySize: '2000+', companyType: '上市公司', startDate: '2022-03', endDate: undefined, isCurrent: true, description: '负责淘宝商家运营产品线，管理DAU百万级产品，带领3人产品团队', sortOrder: 0 },
        { candidateId: 2, companyName: '腾讯', position: '产品经理', industry: '互联网', companySize: '2000+', companyType: '上市公司', startDate: '2021-07', endDate: '2022-02', isCurrent: false, description: '负责微信小程序商业化产品设计，推动上线3个核心功能', sortOrder: 1 }
      ],
      3: [
        { candidateId: 3, companyName: '华为技术', position: '技术总监', industry: '通信/互联网', companySize: '2000+', companyType: '上市公司', startDate: '2020-03', endDate: undefined, isCurrent: true, description: '带领30人研发团队，负责云计算平台核心模块研发', sortOrder: 0 },
        { candidateId: 3, companyName: '百度', position: '高级研发工程师', industry: '互联网', companySize: '2000+', companyType: '上市公司', startDate: '2016-07', endDate: '2020-02', isCurrent: false, description: '负责搜索引擎索引构建系统，日处理数据量100TB+', sortOrder: 1 }
      ],
      4: [
        { candidateId: 4, companyName: '美团', position: '前端实习生', industry: '互联网', companySize: '2000+', companyType: '上市公司', startDate: '2023-07', endDate: '2023-12', isCurrent: false, description: '参与美团外卖商家端小程序开发，独立完成2个功能模块', sortOrder: 0 }
      ],
      5: [
        { candidateId: 5, companyName: '网易', position: '算法工程师', industry: '互联网', companySize: '2000+', companyType: '上市公司', startDate: '2020-07', endDate: undefined, isCurrent: true, description: '负责游戏推荐系统算法优化，CTR提升15%，用户留存率提升8%', sortOrder: 0 },
        { candidateId: 5, companyName: '京东', position: '算法实习生', industry: '互联网电商', companySize: '2000+', companyType: '上市公司', startDate: '2019-07', endDate: '2020-06', isCurrent: false, description: '参与商品推荐系统建设，实现协同过滤推荐算法优化', sortOrder: 1 }
      ]
    }

    const demoSkills: Record<number, Skill[]> = {
      1: [
        { candidateId: 1, skillName: 'Java', proficiency: '精通', yearsUsed: 5, category: '编程语言' },
        { candidateId: 1, skillName: 'Spring Boot', proficiency: '精通', yearsUsed: 4, category: '框架' },
        { candidateId: 1, skillName: 'MySQL', proficiency: '熟练', yearsUsed: 5, category: '数据库' },
        { candidateId: 1, skillName: 'Redis', proficiency: '熟练', yearsUsed: 3, category: '中间件' },
        { candidateId: 1, skillName: 'Kafka', proficiency: '了解', yearsUsed: 2, category: '中间件' },
      ],
      2: [
        { candidateId: 2, skillName: 'Axure', proficiency: '精通', yearsUsed: 3, category: '工具' },
        { candidateId: 2, skillName: 'SQL', proficiency: '熟练', yearsUsed: 3, category: '数据库' },
        { candidateId: 2, skillName: '数据分析', proficiency: '熟练', yearsUsed: 3, category: '技能' },
        { candidateId: 2, skillName: 'Python', proficiency: '了解', yearsUsed: 2, category: '编程语言' },
      ],
      3: [
        { candidateId: 3, skillName: 'Java', proficiency: '精通', yearsUsed: 8, category: '编程语言' },
        { candidateId: 3, skillName: '微服务架构', proficiency: '精通', yearsUsed: 5, category: '架构' },
        { candidateId: 3, skillName: 'Kubernetes', proficiency: '熟练', yearsUsed: 4, category: '运维' },
        { candidateId: 3, skillName: '团队管理', proficiency: '精通', yearsUsed: 6, category: '软技能' },
      ],
      4: [
        { candidateId: 4, skillName: 'Vue.js', proficiency: '熟练', yearsUsed: 2, category: '框架' },
        { candidateId: 4, skillName: 'React', proficiency: '熟练', yearsUsed: 1, category: '框架' },
        { candidateId: 4, skillName: 'TypeScript', proficiency: '熟练', yearsUsed: 2, category: '编程语言' },
        { candidateId: 4, skillName: 'CSS/Tailwind', proficiency: '精通', yearsUsed: 2, category: '前端' },
      ],
      5: [
        { candidateId: 5, skillName: 'Python', proficiency: '精通', yearsUsed: 6, category: '编程语言' },
        { candidateId: 5, skillName: 'TensorFlow', proficiency: '精通', yearsUsed: 4, category: '框架' },
        { candidateId: 5, skillName: 'PyTorch', proficiency: '熟练', yearsUsed: 3, category: '框架' },
        { candidateId: 5, skillName: '推荐系统', proficiency: '精通', yearsUsed: 4, category: '领域' },
        { candidateId: 5, skillName: 'NLP', proficiency: '熟练', yearsUsed: 3, category: '领域' },
      ]
    }

    const demoTags: Record<number, CandidateTag[]> = {
      1: [
        { candidateId: 1, tagName: 'Java开发', tagType: 'skill', tagSource: 'ai', confidence: 98 },
        { candidateId: 1, tagName: '微服务', tagType: 'skill', tagSource: 'ai', confidence: 90 },
        { candidateId: 1, tagName: '大厂背景', tagType: 'trait', tagSource: 'ai', confidence: 95 },
        { candidateId: 1, tagName: '985高校', tagType: 'education', tagSource: 'ai', confidence: 100 },
      ],
      2: [
        { candidateId: 2, tagName: '产品思维', tagType: 'trait', tagSource: 'ai', confidence: 92 },
        { candidateId: 2, tagName: '数据驱动', tagType: 'trait', tagSource: 'ai', confidence: 88 },
        { candidateId: 2, tagName: '985高校', tagType: 'education', tagSource: 'ai', confidence: 100 },
        { candidateId: 2, tagName: '阿里系', tagType: 'industry', tagSource: 'ai', confidence: 100 },
      ],
      3: [
        { candidateId: 3, tagName: '技术管理', tagType: 'trait', tagSource: 'ai', confidence: 95 },
        { candidateId: 3, tagName: '架构设计', tagType: 'skill', tagSource: 'ai', confidence: 92 },
        { candidateId: 3, tagName: '大厂背景', tagType: 'trait', tagSource: 'ai', confidence: 100 },
        { candidateId: 3, tagName: '高潜力', tagType: 'trait', tagSource: 'ai', confidence: 88 },
      ],
      4: [
        { candidateId: 4, tagName: '应届生', tagType: 'education', tagSource: 'ai', confidence: 100 },
        { candidateId: 4, tagName: '前端开发', tagType: 'skill', tagSource: 'ai', confidence: 90 },
        { candidateId: 4, tagName: '985高校', tagType: 'education', tagSource: 'ai', confidence: 100 },
      ],
      5: [
        { candidateId: 5, tagName: '算法专家', tagType: 'skill', tagSource: 'ai', confidence: 95 },
        { candidateId: 5, tagName: '机器学习', tagType: 'skill', tagSource: 'ai', confidence: 98 },
        { candidateId: 5, tagName: '发表论文', tagType: 'trait', tagSource: 'ai', confidence: 100 },
        { candidateId: 5, tagName: '985高校', tagType: 'education', tagSource: 'ai', confidence: 100 },
      ]
    }

    // 存储演示数据
    demoData.forEach((data) => {
      const id = this.candidateIdCounter++
      const candidate: Candidate = { ...data, id, createdAt: data.createdAt, updatedAt: data.updatedAt }
      this.candidates.set(id, candidate)
    })

    // 存储关联数据
    Object.entries(demoEducations).forEach(([cidStr, edus]) => {
      const cid = parseInt(cidStr)
      edus.forEach(edu => {
        const id = this.subIdCounter++
        this.educations.set(id, { ...edu, id, candidateId: cid })
      })
    })

    Object.entries(demoWorkExps).forEach(([cidStr, exps]) => {
      const cid = parseInt(cidStr)
      exps.forEach(exp => {
        const id = this.subIdCounter++
        this.workExperiences.set(id, { ...exp, id, candidateId: cid })
      })
    })

    Object.entries(demoSkills).forEach(([cidStr, skls]) => {
      const cid = parseInt(cidStr)
      skls.forEach(skill => {
        const id = this.subIdCounter++
        this.skills.set(id, { ...skill, id, candidateId: cid })
      })
    })

    Object.entries(demoTags).forEach(([cidStr, tgs]) => {
      const cid = parseInt(cidStr)
      tgs.forEach(tag => {
        const id = this.subIdCounter++
        this.tags.set(id, { ...tag, id, candidateId: cid })
      })
    })
  }

  // ==========================================
  // 演示用户初始化
  // ==========================================
  private seedDemoUsers() {
    const demoUsers: Omit<SystemUser, 'id'>[] = [
      {
        username: 'admin',
        realName: '系统管理员',
        email: 'admin@company.com',
        phone: '13800000001',
        role: 'admin',
        department: '技术部',
        status: 'active',
        password: 'admin123',
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        username: 'hr_zhang',
        realName: '张招聘',
        email: 'zhang.hr@company.com',
        phone: '13800000002',
        role: 'hr',
        department: '人力资源部',
        status: 'active',
        password: 'hr123456',
        createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        username: 'interviewer_li',
        realName: '李面试官',
        email: 'li.interview@company.com',
        phone: '13800000003',
        role: 'interviewer',
        department: '研发部',
        status: 'active',
        password: 'inter123',
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        username: 'viewer_wang',
        realName: '王只读',
        email: 'wang.view@company.com',
        phone: '13800000004',
        role: 'viewer',
        department: '业务部',
        status: 'disabled',
        password: 'view1234',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
    demoUsers.forEach(u => {
      const id = this.userIdCounter++
      this.users.set(id, { ...u, id })
    })
  }

  // ==========================================
  // 用户管理 CRUD
  // ==========================================

  getUsers(params: { keyword?: string; role?: string; status?: string; page?: number; pageSize?: number } = {}): { list: SystemUser[], total: number } {
    let list = Array.from(this.users.values()).map(u => {
      // 返回时不含密码
      const { password: _, ...safe } = u
      return safe as SystemUser
    })
    if (params.keyword) {
      const kw = params.keyword.toLowerCase()
      list = list.filter(u =>
        u.username.toLowerCase().includes(kw) ||
        u.realName.toLowerCase().includes(kw) ||
        u.email.toLowerCase().includes(kw) ||
        (u.department || '').toLowerCase().includes(kw)
      )
    }
    if (params.role) list = list.filter(u => u.role === params.role)
    if (params.status) list = list.filter(u => u.status === params.status)
    // 按创建时间倒序
    list.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1)
    const total = list.length
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    list = list.slice((page - 1) * pageSize, page * pageSize)
    return { list, total }
  }

  getUserById(id: number): SystemUser | undefined {
    const u = this.users.get(id)
    if (!u) return undefined
    const { password: _, ...safe } = u
    return safe as SystemUser
  }

  getUserByUsername(username: string): SystemUser | undefined {
    return Array.from(this.users.values()).find(u => u.username === username)
  }

  createUser(data: SystemUser): { user?: SystemUser; error?: string } {
    // 检查用户名唯一
    if (this.getUserByUsername(data.username)) {
      return { error: `登录名 "${data.username}" 已存在` }
    }
    // 检查邮箱唯一
    if (Array.from(this.users.values()).some(u => u.email === data.email)) {
      return { error: `邮箱 "${data.email}" 已被使用` }
    }
    const id = this.userIdCounter++
    const now = new Date().toISOString()
    const user: SystemUser = { ...data, id, status: data.status || 'active', createdAt: now, updatedAt: now }
    this.users.set(id, user)
    const { password: _, ...safe } = user
    return { user: safe as SystemUser }
  }

  updateUser(id: number, data: Partial<SystemUser>): { user?: SystemUser; error?: string } {
    const existing = this.users.get(id)
    if (!existing) return { error: '用户不存在' }
    // 检查用户名唯一（排除自身）
    if (data.username && data.username !== existing.username && this.getUserByUsername(data.username)) {
      return { error: `登录名 "${data.username}" 已存在` }
    }
    // 检查邮箱唯一（排除自身）
    if (data.email && data.email !== existing.email &&
        Array.from(this.users.values()).some(u => u.id !== id && u.email === data.email)) {
      return { error: `邮箱 "${data.email}" 已被使用` }
    }
    const updated: SystemUser = { ...existing, ...data, id, updatedAt: new Date().toISOString() }
    // 如果没传新密码，保留旧密码
    if (!data.password) updated.password = existing.password
    this.users.set(id, updated)
    const { password: _, ...safe } = updated
    return { user: safe as SystemUser }
  }

  toggleUserStatus(id: number): { user?: SystemUser; error?: string } {
    const u = this.users.get(id)
    if (!u) return { error: '用户不存在' }
    return this.updateUser(id, { status: u.status === 'active' ? 'disabled' : 'active' })
  }

  deleteUser(id: number): boolean {
    return this.users.delete(id)
  }

  getUserCount(): number {
    return this.users.size
  }

  // ==========================================
  // 候选人操作
  // ==========================================
  
  getCandidates(params: any = {}): { list: Candidate[], total: number } {
    let list = Array.from(this.candidates.values())
    
    // 关键词搜索（全文，覆盖姓名/邮箱/电话/职位/自评/城市/备注）
    if (params.keyword) {
      const kw = params.keyword.toLowerCase()
      list = list.filter(c => 
        c.name?.toLowerCase().includes(kw) ||
        c.email?.toLowerCase().includes(kw) ||
        c.phone?.includes(kw) ||
        c.expectedPosition?.toLowerCase().includes(kw) ||
        c.selfEvaluation?.toLowerCase().includes(kw) ||
        c.location?.toLowerCase().includes(kw) ||
        c.hrNotes?.toLowerCase().includes(kw)
      )
    }

    // 姓名精确/模糊
    if (params.name) {
      const kw = params.name.toLowerCase()
      list = list.filter(c => c.name?.toLowerCase().includes(kw))
    }

    // 手机号
    if (params.phone) {
      list = list.filter(c => c.phone?.includes(params.phone))
    }

    // 邮箱
    if (params.email) {
      const kw = params.email.toLowerCase()
      list = list.filter(c => c.email?.toLowerCase().includes(kw))
    }

    // 性别
    if (params.gender) {
      list = list.filter(c => c.gender === params.gender)
    }

    // 年龄区间
    if (params.minAge !== undefined && params.minAge !== '') {
      list = list.filter(c => (c.age || 0) >= Number(params.minAge))
    }
    if (params.maxAge !== undefined && params.maxAge !== '') {
      list = list.filter(c => (c.age || 0) <= Number(params.maxAge))
    }

    // 现居城市（模糊）
    if (params.location) {
      const kw = params.location.toLowerCase()
      list = list.filter(c => c.location?.toLowerCase().includes(kw))
    }

    // 求职意向职位（模糊）
    if (params.expectedPosition) {
      const kw = params.expectedPosition.toLowerCase()
      list = list.filter(c => c.expectedPosition?.toLowerCase().includes(kw))
    }

    // 期望城市（模糊）
    if (params.expectedCity) {
      const kw = params.expectedCity.toLowerCase()
      list = list.filter(c => c.expectedCity?.toLowerCase().includes(kw))
    }

    // 当前求职状态
    if (params.currentStatus) {
      list = list.filter(c => c.currentStatus === params.currentStatus)
    }

    // 状态筛选
    if (params.candidateStatus) {
      list = list.filter(c => c.candidateStatus === params.candidateStatus)
    }
    
    // 学历筛选
    if (params.highestEducation) {
      list = list.filter(c => c.highestEducation === params.highestEducation)
    }
    
    // 渠道筛选
    if (params.sourceChannel) {
      list = list.filter(c => c.sourceChannel === params.sourceChannel)
    }
    
    // 工作年限
    if (params.minExperience !== undefined && params.minExperience !== '') {
      list = list.filter(c => (c.yearsOfExperience || 0) >= Number(params.minExperience))
    }
    if (params.maxExperience !== undefined && params.maxExperience !== '') {
      list = list.filter(c => (c.yearsOfExperience || 0) <= Number(params.maxExperience))
    }

    // 期望薪资区间（单位：元/月）
    if (params.minSalary !== undefined && params.minSalary !== '') {
      list = list.filter(c => c.expectedSalaryMax === undefined || (c.expectedSalaryMax || 0) >= Number(params.minSalary))
    }
    if (params.maxSalary !== undefined && params.maxSalary !== '') {
      list = list.filter(c => (c.expectedSalaryMin || 0) <= Number(params.maxSalary))
    }

    // 匹配分数下限
    if (params.minMatchScore !== undefined && params.minMatchScore !== '') {
      list = list.filter(c => (c.matchScore || 0) >= Number(params.minMatchScore))
    }

    // 是否有简历原件
    if (params.hasResume === 'true' || params.hasResume === true) {
      const idsWithResume = new Set(Array.from(this.resumeFiles.keys()))
      list = list.filter(c => c.id !== undefined && idsWithResume.has(c.id))
    } else if (params.hasResume === 'false' || params.hasResume === false) {
      const idsWithResume = new Set(Array.from(this.resumeFiles.keys()))
      list = list.filter(c => c.id !== undefined && !idsWithResume.has(c.id))
    }
    
    // 黑名单
    if (params.isBlacklist !== undefined && params.isBlacklist !== '') {
      const val = params.isBlacklist === 'true' || params.isBlacklist === true
      list = list.filter(c => !!c.isBlacklist === val)
    }

    // 技能搜索（支持多个技能逗号分隔，AND逻辑）
    if (params.skillKeyword) {
      const skillKws = params.skillKeyword.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      skillKws.forEach((skillKw: string) => {
        const candidateIdsWithSkill = new Set<number>()
        this.skills.forEach(skill => {
          if (skill.skillName.toLowerCase().includes(skillKw) && skill.candidateId) {
            candidateIdsWithSkill.add(skill.candidateId)
          }
        })
        list = list.filter(c => c.id && candidateIdsWithSkill.has(c.id))
      })
    }

    // 公司名称（工作经历中搜索）
    if (params.companyKeyword) {
      const kw = params.companyKeyword.toLowerCase()
      const candidateIdsWithCompany = new Set<number>()
      this.workExperiences.forEach(w => {
        if (w.companyName?.toLowerCase().includes(kw) && w.candidateId) {
          candidateIdsWithCompany.add(w.candidateId)
        }
      })
      list = list.filter(c => c.id && candidateIdsWithCompany.has(c.id))
    }

    // 学校名称（教育经历中搜索）
    if (params.schoolKeyword) {
      const kw = params.schoolKeyword.toLowerCase()
      const candidateIdsWithSchool = new Set<number>()
      this.educations.forEach(e => {
        if (e.schoolName?.toLowerCase().includes(kw) && e.candidateId) {
          candidateIdsWithSchool.add(e.candidateId)
        }
      })
      list = list.filter(c => c.id && candidateIdsWithSchool.has(c.id))
    }

    // 专业名称（教育经历中搜索）
    if (params.majorKeyword) {
      const kw = params.majorKeyword.toLowerCase()
      const candidateIdsWithMajor = new Set<number>()
      this.educations.forEach(e => {
        if (e.major?.toLowerCase().includes(kw) && e.candidateId) {
          candidateIdsWithMajor.add(e.candidateId)
        }
      })
      list = list.filter(c => c.id && candidateIdsWithMajor.has(c.id))
    }

    // 行业（工作经历中）
    if (params.industryKeyword) {
      const kw = params.industryKeyword.toLowerCase()
      const candidateIdsWithIndustry = new Set<number>()
      this.workExperiences.forEach(w => {
        if (w.industry?.toLowerCase().includes(kw) && w.candidateId) {
          candidateIdsWithIndustry.add(w.candidateId)
        }
      })
      list = list.filter(c => c.id && candidateIdsWithIndustry.has(c.id))
    }

    // HR备注关键词
    if (params.hrNotesKeyword) {
      const kw = params.hrNotesKeyword.toLowerCase()
      list = list.filter(c => c.hrNotes?.toLowerCase().includes(kw))
    }
    
    // 排序
    const sortBy = params.sortBy || 'createdAt'
    const sortOrder = params.sortOrder || 'desc'
    list.sort((a, b) => {
      let aVal: any = a[sortBy as keyof Candidate]
      let bVal: any = b[sortBy as keyof Candidate]
      if (aVal === undefined) aVal = ''
      if (bVal === undefined) bVal = ''
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      return sortOrder === 'desc' ? -cmp : cmp
    })
    
    const total = list.length
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    list = list.slice(start, start + pageSize)
    
    // 附加轻量关联数据（tags 用于列表展示，skills 用于技能筛选展示）
    list = list.map(c => ({
      ...c,
      tags: Array.from(this.tags.values()).filter(t => t.candidateId === c.id),
      skills: Array.from(this.skills.values()).filter(s => s.candidateId === c.id)
    }))
    
    return { list, total }
  }

  getCandidateById(id: number): Candidate | undefined {
    const candidate = this.candidates.get(id)
    if (!candidate) return undefined
    
    // 附加关联数据
    return {
      ...candidate,
      educations: Array.from(this.educations.values()).filter(e => e.candidateId === id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      workExperiences: Array.from(this.workExperiences.values()).filter(w => w.candidateId === id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      projects: Array.from(this.projects.values()).filter(p => p.candidateId === id),
      skills: Array.from(this.skills.values()).filter(s => s.candidateId === id),
      certifications: Array.from(this.certifications.values()).filter(c => c.candidateId === id),
      tags: Array.from(this.tags.values()).filter(t => t.candidateId === id),
      interviewRecords: Array.from(this.interviews.values()).filter(i => i.candidateId === id)
    }
  }

  createCandidate(data: Candidate): Candidate {
    const id = this.candidateIdCounter++
    const now = new Date().toISOString()
    const candidate: Candidate = { 
      ...data, 
      id, 
      createdAt: now, 
      updatedAt: now,
      candidateStatus: data.candidateStatus || 'active'
    }
    this.candidates.set(id, candidate)
    
    // 保存关联数据
    if (data.educations) this.saveEducations(id, data.educations)
    if (data.workExperiences) this.saveWorkExperiences(id, data.workExperiences)
    if (data.projects) this.saveProjects(id, data.projects)
    if (data.skills) this.saveSkills(id, data.skills)
    if (data.certifications) this.saveCertifications(id, data.certifications)
    if (data.tags) this.saveTags(id, data.tags)
    
    return this.getCandidateById(id)!
  }

  updateCandidate(id: number, data: Partial<Candidate>): Candidate | undefined {
    const existing = this.candidates.get(id)
    if (!existing) return undefined
    
    const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() }
    this.candidates.set(id, updated)
    
    // 更新关联数据
    if (data.educations !== undefined) {
      this.clearEducations(id)
      this.saveEducations(id, data.educations)
    }
    if (data.workExperiences !== undefined) {
      this.clearWorkExperiences(id)
      this.saveWorkExperiences(id, data.workExperiences)
    }
    if (data.skills !== undefined) {
      this.clearSkills(id)
      this.saveSkills(id, data.skills)
    }
    if (data.tags !== undefined) {
      this.clearTags(id)
      this.saveTags(id, data.tags)
    }
    
    return this.getCandidateById(id)
  }

  deleteCandidate(id: number): boolean {
    if (!this.candidates.has(id)) return false
    this.candidates.delete(id)
    // 删除关联数据
    this.clearEducations(id)
    this.clearWorkExperiences(id)
    this.clearSkills(id)
    this.clearTags(id)
    Array.from(this.projects.entries()).forEach(([k, v]) => { if (v.candidateId === id) this.projects.delete(k) })
    Array.from(this.certifications.entries()).forEach(([k, v]) => { if (v.candidateId === id) this.certifications.delete(k) })
    Array.from(this.interviews.entries()).forEach(([k, v]) => { if (v.candidateId === id) this.interviews.delete(k) })
    // 删除简历文件
    this.resumeFiles.delete(id)
    return true
  }

  private clearEducations(candidateId: number) { Array.from(this.educations.entries()).forEach(([k, v]) => { if (v.candidateId === candidateId) this.educations.delete(k) }) }
  private clearWorkExperiences(candidateId: number) { Array.from(this.workExperiences.entries()).forEach(([k, v]) => { if (v.candidateId === candidateId) this.workExperiences.delete(k) }) }
  private clearSkills(candidateId: number) { Array.from(this.skills.entries()).forEach(([k, v]) => { if (v.candidateId === candidateId) this.skills.delete(k) }) }
  private clearTags(candidateId: number) { Array.from(this.tags.entries()).forEach(([k, v]) => { if (v.candidateId === candidateId) this.tags.delete(k) }) }

  private saveEducations(candidateId: number, items: Education[]) { items.forEach((item, i) => { const id = this.subIdCounter++; this.educations.set(id, { ...item, id, candidateId, sortOrder: i }) }) }
  private saveWorkExperiences(candidateId: number, items: WorkExperience[]) { items.forEach((item, i) => { const id = this.subIdCounter++; this.workExperiences.set(id, { ...item, id, candidateId, sortOrder: i }) }) }
  private saveProjects(candidateId: number, items: Project[]) { items.forEach((item, i) => { const id = this.subIdCounter++; this.projects.set(id, { ...item, id, candidateId, sortOrder: i }) }) }
  private saveSkills(candidateId: number, items: Skill[]) { items.forEach(item => { const id = this.subIdCounter++; this.skills.set(id, { ...item, id, candidateId }) }) }
  private saveCertifications(candidateId: number, items: Certification[]) { items.forEach(item => { const id = this.subIdCounter++; this.certifications.set(id, { ...item, id, candidateId }) }) }
  private saveTags(candidateId: number, items: CandidateTag[]) { items.forEach(item => { const id = this.subIdCounter++; this.tags.set(id, { ...item, id, candidateId }) }) }

  // 面试记录
  addInterviewRecord(candidateId: number, data: InterviewRecord): InterviewRecord {
    const id = this.subIdCounter++
    const record = { ...data, id, candidateId, createdAt: new Date().toISOString() }
    this.interviews.set(id, record)
    return record
  }

  // 解析任务
  createParseTask(data: ParseTask): ParseTask {
    const id = this.subIdCounter++
    const task = { ...data, id, createdAt: new Date().toISOString() }
    this.parseTasks.set(id, task)
    return task
  }

  updateParseTask(id: number, data: Partial<ParseTask>): void {
    const existing = this.parseTasks.get(id)
    if (existing) {
      this.parseTasks.set(id, { ...existing, ...data, updatedAt: new Date().toISOString() })
    }
  }

  getParseTask(id: number): ParseTask | undefined {
    return this.parseTasks.get(id)
  }

  // ==========================================
  // 简历文件操作
  // ==========================================

  /** 保存或替换候选人的简历文件（Base64） */
  saveResumeFile(candidateId: number, file: Omit<ResumeFile, 'candidateId' | 'uploadedAt'>): ResumeFile {
    const record: ResumeFile = {
      ...file,
      candidateId,
      uploadedAt: new Date().toISOString()
    }
    this.resumeFiles.set(candidateId, record)
    // 同步更新候选人的元数据字段
    const candidate = this.candidates.get(candidateId)
    if (candidate) {
      this.candidates.set(candidateId, {
        ...candidate,
        resumeFileName: file.fileName,
        resumeFileType: file.fileType,
        resumeFileSize: file.fileSize,
        resumeUploadedAt: record.uploadedAt,
        updatedAt: record.uploadedAt
      })
    }
    return record
  }

  /** 获取候选人简历文件（含 Base64 数据） */
  getResumeFile(candidateId: number): ResumeFile | undefined {
    return this.resumeFiles.get(candidateId)
  }

  /** 删除候选人简历文件 */
  deleteResumeFile(candidateId: number): boolean {
    if (!this.resumeFiles.has(candidateId)) return false
    this.resumeFiles.delete(candidateId)
    const candidate = this.candidates.get(candidateId)
    if (candidate) {
      const c = { ...candidate }
      delete c.resumeFileName
      delete c.resumeFileType
      delete c.resumeFileSize
      delete c.resumeUploadedAt
      this.candidates.set(candidateId, { ...c, updatedAt: new Date().toISOString() })
    }
    return true
  }

  // 统计数据
  getStatistics() {
    const allCandidates = Array.from(this.candidates.values())
    const total = allCandidates.length
    
    const byStatus: Record<string, number> = {}
    const byEducation: Record<string, number> = {}
    const byChannel: Record<string, number> = {}
    const byExperience: Record<string, number> = { '0-2年': 0, '2-5年': 0, '5-10年': 0, '10年+': 0 }
    
    allCandidates.forEach(c => {
      // 状态统计
      const status = c.candidateStatus || 'active'
      byStatus[status] = (byStatus[status] || 0) + 1
      
      // 学历统计
      const edu = c.highestEducation || '未知'
      byEducation[edu] = (byEducation[edu] || 0) + 1
      
      // 渠道统计
      const channel = c.sourceChannel || '其他'
      byChannel[channel] = (byChannel[channel] || 0) + 1
      
      // 工作年限统计
      const exp = c.yearsOfExperience || 0
      if (exp < 2) byExperience['0-2年']++
      else if (exp < 5) byExperience['2-5年']++
      else if (exp < 10) byExperience['5-10年']++
      else byExperience['10年+']++
    })

    // 技能统计
    const skillCount: Record<string, number> = {}
    Array.from(this.skills.values()).forEach(s => {
      skillCount[s.skillName] = (skillCount[s.skillName] || 0) + 1
    })
    const topSkills = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    // 近30天新增
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const recentAdded = allCandidates.filter(c => (c.createdAt || '') > thirtyDaysAgo).length

    return {
      total,
      recentAdded,
      byStatus,
      byEducation,
      byChannel,
      byExperience,
      topSkills,
      avgMatchScore: total > 0 ? Math.round(allCandidates.reduce((sum, c) => sum + (c.matchScore || 0), 0) / total * 10) / 10 : 0
    }
  }
}

// 单例
export const db = new MemoryDatabase()
