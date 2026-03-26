// ==========================================
// 数据存储层 - SQLite 持久化存储
// 使用 better-sqlite3，数据保存在 data/resume.db
// ==========================================
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type {
  Candidate, Education, WorkExperience, Project,
  Skill, Certification, CandidateTag, InterviewRecord, ParseTask
} from '../types'

// ==========================================
// 用户角色与状态
// ==========================================
export type UserRole = 'admin' | 'hr' | 'interviewer' | 'viewer'
export type UserStatus = 'active' | 'disabled'

export interface SystemUser {
  id?: number
  username: string
  realName: string
  email: string
  phone?: string
  role: UserRole
  department?: string
  status: UserStatus
  password?: string
  avatar?: string
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
}

// ==========================================
// 数据库初始化
// ==========================================
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'resume.db')

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const sqliteDb = new Database(DB_PATH)

// 启用 WAL 模式（提升写性能和并发读性能）
sqliteDb.pragma('journal_mode = WAL')
sqliteDb.pragma('foreign_keys = ON')

// ==========================================
// 建表 DDL
// ==========================================
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT,
    age INTEGER,
    birth_date TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    hometown TEXT,
    avatar_url TEXT,
    current_status TEXT,
    years_of_experience REAL,
    highest_education TEXT,
    expected_salary_min INTEGER,
    expected_salary_max INTEGER,
    expected_position TEXT,
    expected_city TEXT,
    self_evaluation TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    source_channel TEXT,
    candidate_status TEXT DEFAULT 'active',
    is_blacklist INTEGER DEFAULT 0,
    hr_notes TEXT,
    match_score REAL,
    raw_resume_text TEXT,
    resume_file_name TEXT,
    resume_file_type TEXT,
    resume_file_size INTEGER,
    resume_uploaded_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS educations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    school_name TEXT NOT NULL,
    degree TEXT NOT NULL,
    major TEXT,
    start_date TEXT,
    end_date TEXT,
    gpa REAL,
    description TEXT,
    is_985 INTEGER DEFAULT 0,
    is_211 INTEGER DEFAULT 0,
    is_overseas INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS work_experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    company_size TEXT,
    company_type TEXT,
    industry TEXT,
    position TEXT NOT NULL,
    job_level TEXT,
    department TEXT,
    start_date TEXT,
    end_date TEXT,
    is_current INTEGER DEFAULT 0,
    salary INTEGER,
    description TEXT,
    achievements TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    role TEXT,
    start_date TEXT,
    end_date TEXT,
    tech_stack TEXT,
    description TEXT,
    achievements TEXT,
    project_url TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    skill_name TEXT NOT NULL,
    proficiency TEXT,
    years_used REAL,
    category TEXT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    cert_name TEXT NOT NULL,
    issuing_org TEXT,
    issue_date TEXT,
    cert_type TEXT,
    description TEXT,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS candidate_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    tag_name TEXT NOT NULL,
    tag_type TEXT,
    tag_source TEXT,
    confidence REAL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interview_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    interview_type TEXT,
    interview_round TEXT,
    interview_date TEXT,
    interviewer TEXT,
    result TEXT,
    score REAL,
    feedback TEXT,
    next_step TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS parse_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER,
    file_name TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    status TEXT DEFAULT 'pending',
    parse_result TEXT,
    error_msg TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS resume_files (
    candidate_id INTEGER PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_data TEXT NOT NULL,
    uploaded_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    real_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    department TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    password TEXT,
    avatar TEXT,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
`)

// ==========================================
// 行转对象辅助函数
// ==========================================
function rowToCandidate(row: any): Candidate {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    age: row.age,
    birthDate: row.birth_date,
    phone: row.phone,
    email: row.email,
    location: row.location,
    hometown: row.hometown,
    avatarUrl: row.avatar_url,
    currentStatus: row.current_status,
    yearsOfExperience: row.years_of_experience,
    highestEducation: row.highest_education,
    expectedSalaryMin: row.expected_salary_min,
    expectedSalaryMax: row.expected_salary_max,
    expectedPosition: row.expected_position,
    expectedCity: row.expected_city,
    selfEvaluation: row.self_evaluation,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    portfolioUrl: row.portfolio_url,
    sourceChannel: row.source_channel,
    candidateStatus: row.candidate_status,
    isBlacklist: !!row.is_blacklist,
    hrNotes: row.hr_notes,
    matchScore: row.match_score,
    rawResumeText: row.raw_resume_text,
    resumeFileName: row.resume_file_name,
    resumeFileType: row.resume_file_type,
    resumeFileSize: row.resume_file_size,
    resumeUploadedAt: row.resume_uploaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToEducation(row: any): Education {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    schoolName: row.school_name,
    degree: row.degree,
    major: row.major,
    startDate: row.start_date,
    endDate: row.end_date,
    gpa: row.gpa,
    description: row.description,
    is985: !!row.is_985,
    is211: !!row.is_211,
    isOverseas: !!row.is_overseas,
    sortOrder: row.sort_order,
  }
}

function rowToWorkExp(row: any): WorkExperience {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    companyName: row.company_name,
    companySize: row.company_size,
    companyType: row.company_type,
    industry: row.industry,
    position: row.position,
    jobLevel: row.job_level,
    department: row.department,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: !!row.is_current,
    salary: row.salary,
    description: row.description,
    achievements: row.achievements,
    sortOrder: row.sort_order,
  }
}

function rowToSkill(row: any): Skill {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    skillName: row.skill_name,
    proficiency: row.proficiency,
    yearsUsed: row.years_used,
    category: row.category,
  }
}

function rowToTag(row: any): CandidateTag {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    tagName: row.tag_name,
    tagType: row.tag_type,
    tagSource: row.tag_source,
    confidence: row.confidence,
  }
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    projectName: row.project_name,
    role: row.role,
    startDate: row.start_date,
    endDate: row.end_date,
    techStack: row.tech_stack,
    description: row.description,
    achievements: row.achievements,
    projectUrl: row.project_url,
    sortOrder: row.sort_order,
  }
}

function rowToCertification(row: any): Certification {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    certName: row.cert_name,
    issuingOrg: row.issuing_org,
    issueDate: row.issue_date,
    certType: row.cert_type,
    description: row.description,
  }
}

function rowToInterview(row: any): InterviewRecord {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    interviewType: row.interview_type,
    interviewRound: row.interview_round,
    interviewDate: row.interview_date,
    interviewer: row.interviewer,
    result: row.result,
    score: row.score,
    feedback: row.feedback,
    nextStep: row.next_step,
    createdAt: row.created_at,
  }
}

function rowToUser(row: any, includePassword = false): SystemUser {
  const u: SystemUser = {
    id: row.id,
    username: row.username,
    realName: row.real_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    department: row.department,
    status: row.status,
    avatar: row.avatar,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (includePassword) u.password = row.password
  return u
}

// ==========================================
// 种子数据（仅首次运行时插入）
// ==========================================
function seedIfEmpty() {
  const count = (sqliteDb.prepare('SELECT COUNT(*) as c FROM candidates').get() as any).c
  if (count > 0) return  // 已有数据，跳过

  console.log('📦 首次运行，写入演示数据...')

  const insertCandidate = sqliteDb.prepare(`
    INSERT INTO candidates (name,gender,age,phone,email,location,hometown,highest_education,
      years_of_experience,expected_position,expected_salary_min,expected_salary_max,
      expected_city,current_status,candidate_status,source_channel,match_score,
      self_evaluation,created_at,updated_at)
    VALUES (@name,@gender,@age,@phone,@email,@location,@hometown,@highestEducation,
      @yearsOfExperience,@expectedPosition,@expectedSalaryMin,@expectedSalaryMax,
      @expectedCity,@currentStatus,@candidateStatus,@sourceChannel,@matchScore,
      @selfEvaluation,@createdAt,@updatedAt)
  `)

  const demoSeed = sqliteDb.transaction(() => {
    const c1 = insertCandidate.run({ name:'张伟',gender:'男',age:28,phone:'13800138001',email:'zhangwei@email.com',location:'北京市朝阳区',hometown:'山东省济南市',highestEducation:'本科',yearsOfExperience:5,expectedPosition:'高级Java工程师',expectedSalaryMin:25000,expectedSalaryMax:35000,expectedCity:'北京',currentStatus:'在职',candidateStatus:'active',sourceChannel:'BOSS直聘',matchScore:92.5,selfEvaluation:'5年Java开发经验，熟练掌握Spring Boot、MyBatis、Redis、MySQL等技术栈，有良好的代码规范和团队协作能力。',createdAt:new Date(Date.now()-86400000*2).toISOString(),updatedAt:new Date().toISOString() })
    const c2 = insertCandidate.run({ name:'李娜',gender:'女',age:26,phone:'13900139002',email:'lina@email.com',location:'上海市浦东新区',hometown:'浙江省杭州市',highestEducation:'硕士',yearsOfExperience:3,expectedPosition:'产品经理',expectedSalaryMin:20000,expectedSalaryMax:30000,expectedCity:'上海',currentStatus:'在职',candidateStatus:'interviewing',sourceChannel:'智联招聘',matchScore:88.0,selfEvaluation:'3年互联网产品经验，擅长用户研究、数据分析，有成熟的产品思维和项目管理能力。',createdAt:new Date(Date.now()-86400000*5).toISOString(),updatedAt:new Date().toISOString() })
    const c3 = insertCandidate.run({ name:'王强',gender:'男',age:32,phone:'13700137003',email:'wangqiang@email.com',location:'深圳市南山区',hometown:'广东省广州市',highestEducation:'本科',yearsOfExperience:8,expectedPosition:'技术总监',expectedSalaryMin:40000,expectedSalaryMax:60000,expectedCity:'深圳',currentStatus:'离职',candidateStatus:'active',sourceChannel:'猎头推荐',matchScore:95.0,selfEvaluation:'8年研发经验，曾带领50人技术团队，主导多个百万级用户产品从0到1的落地，擅长技术架构设计和团队管理。',createdAt:new Date(Date.now()-86400000*1).toISOString(),updatedAt:new Date().toISOString() })
    const c4 = insertCandidate.run({ name:'陈晓雨',gender:'女',age:24,phone:'13600136004',email:'chenxiaoyu@email.com',location:'北京市海淀区',hometown:'四川省成都市',highestEducation:'本科',yearsOfExperience:1,expectedPosition:'前端工程师',expectedSalaryMin:12000,expectedSalaryMax:18000,expectedCity:'北京/上海',currentStatus:'应届',candidateStatus:'active',sourceChannel:'校园招聘',matchScore:75.5,selfEvaluation:'985高校计算机专业应届生，熟练掌握Vue.js、React、TypeScript，有多个实习和项目经验。',createdAt:new Date(Date.now()-86400000*10).toISOString(),updatedAt:new Date().toISOString() })
    const c5 = insertCandidate.run({ name:'刘明',gender:'男',age:30,phone:'13500135005',email:'liuming@email.com',location:'杭州市西湖区',hometown:'江苏省南京市',highestEducation:'硕士',yearsOfExperience:6,expectedPosition:'算法工程师',expectedSalaryMin:35000,expectedSalaryMax:50000,expectedCity:'杭州/北京',currentStatus:'在职',candidateStatus:'active',sourceChannel:'LinkedIn',matchScore:89.0,selfEvaluation:'6年机器学习/深度学习经验，发表SCI论文3篇，在推荐系统、NLP领域有丰富的工程实践经验。',createdAt:new Date(Date.now()-86400000*7).toISOString(),updatedAt:new Date().toISOString() })

    const ids = [c1.lastInsertRowid, c2.lastInsertRowid, c3.lastInsertRowid, c4.lastInsertRowid, c5.lastInsertRowid]

    const insEdu = sqliteDb.prepare(`INSERT INTO educations (candidate_id,school_name,degree,major,start_date,end_date,is_985,is_211,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
    insEdu.run(ids[0],'山东大学','本科','计算机科学与技术','2014-09','2018-07',1,1,0)
    insEdu.run(ids[1],'复旦大学','硕士','工商管理','2019-09','2021-07',1,1,0)
    insEdu.run(ids[1],'上海交通大学','本科','工业工程','2015-09','2019-07',1,1,1)
    insEdu.run(ids[2],'华南理工大学','本科','软件工程','2010-09','2014-07',1,1,0)
    insEdu.run(ids[3],'北京航空航天大学','本科','计算机科学','2020-09','2024-07',1,1,0)
    insEdu.run(ids[4],'浙江大学','硕士','计算机应用技术','2017-09','2020-07',1,1,0)
    insEdu.run(ids[4],'南京大学','本科','数学与应用数学','2013-09','2017-07',1,1,1)

    const insWork = sqliteDb.prepare(`INSERT INTO work_experiences (candidate_id,company_name,position,industry,company_size,company_type,start_date,end_date,is_current,description,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    insWork.run(ids[0],'字节跳动','Java工程师','互联网','2000+','上市公司','2021-06',null,1,'负责抖音电商平台后端开发，主导设计订单系统微服务架构，QPS从1000提升至10000+',0)
    insWork.run(ids[0],'滴滴出行','Java开发工程师','互联网','2000+','上市公司','2018-07','2021-05',0,'负责出行订单系统开发，优化数据库查询性能，响应时间降低40%',1)
    insWork.run(ids[1],'阿里巴巴','高级产品经理','互联网电商','2000+','上市公司','2022-03',null,1,'负责淘宝商家运营产品线，管理DAU百万级产品，带领3人产品团队',0)
    insWork.run(ids[1],'腾讯','产品经理','互联网','2000+','上市公司','2021-07','2022-02',0,'负责微信小程序商业化产品设计，推动上线3个核心功能',1)
    insWork.run(ids[2],'华为技术','技术总监','通信/互联网','2000+','上市公司','2020-03',null,1,'带领30人研发团队，负责云计算平台核心模块研发',0)
    insWork.run(ids[2],'百度','高级研发工程师','互联网','2000+','上市公司','2016-07','2020-02',0,'负责搜索引擎索引构建系统，日处理数据量100TB+',1)
    insWork.run(ids[3],'美团','前端实习生','互联网','2000+','上市公司','2023-07','2023-12',0,'参与美团外卖商家端小程序开发，独立完成2个功能模块',0)
    insWork.run(ids[4],'网易','算法工程师','互联网','2000+','上市公司','2020-07',null,1,'负责游戏推荐系统算法优化，CTR提升15%，用户留存率提升8%',0)
    insWork.run(ids[4],'京东','算法实习生','互联网电商','2000+','上市公司','2019-07','2020-06',0,'参与商品推荐系统建设，实现协同过滤推荐算法优化',1)

    const insSkill = sqliteDb.prepare(`INSERT INTO skills (candidate_id,skill_name,proficiency,years_used,category) VALUES (?,?,?,?,?)`)
    insSkill.run(ids[0],'Java','精通',5,'编程语言'); insSkill.run(ids[0],'Spring Boot','精通',4,'框架'); insSkill.run(ids[0],'MySQL','熟练',5,'数据库'); insSkill.run(ids[0],'Redis','熟练',3,'中间件'); insSkill.run(ids[0],'Kafka','了解',2,'中间件')
    insSkill.run(ids[1],'Axure','精通',3,'工具'); insSkill.run(ids[1],'SQL','熟练',3,'数据库'); insSkill.run(ids[1],'数据分析','熟练',3,'技能'); insSkill.run(ids[1],'Python','了解',2,'编程语言')
    insSkill.run(ids[2],'Java','精通',8,'编程语言'); insSkill.run(ids[2],'微服务架构','精通',5,'架构'); insSkill.run(ids[2],'Kubernetes','熟练',4,'运维'); insSkill.run(ids[2],'团队管理','精通',6,'软技能')
    insSkill.run(ids[3],'Vue.js','熟练',2,'框架'); insSkill.run(ids[3],'React','熟练',1,'框架'); insSkill.run(ids[3],'TypeScript','熟练',2,'编程语言'); insSkill.run(ids[3],'CSS/Tailwind','精通',2,'前端')
    insSkill.run(ids[4],'Python','精通',6,'编程语言'); insSkill.run(ids[4],'TensorFlow','精通',4,'框架'); insSkill.run(ids[4],'PyTorch','熟练',3,'框架'); insSkill.run(ids[4],'推荐系统','精通',4,'领域'); insSkill.run(ids[4],'NLP','熟练',3,'领域')

    const insTag = sqliteDb.prepare(`INSERT INTO candidate_tags (candidate_id,tag_name,tag_type,tag_source,confidence) VALUES (?,?,?,?,?)`)
    insTag.run(ids[0],'Java开发','skill','ai',98); insTag.run(ids[0],'微服务','skill','ai',90); insTag.run(ids[0],'大厂背景','trait','ai',95); insTag.run(ids[0],'985高校','education','ai',100)
    insTag.run(ids[1],'产品思维','trait','ai',92); insTag.run(ids[1],'数据驱动','trait','ai',88); insTag.run(ids[1],'985高校','education','ai',100); insTag.run(ids[1],'阿里系','industry','ai',100)
    insTag.run(ids[2],'技术管理','trait','ai',95); insTag.run(ids[2],'架构设计','skill','ai',92); insTag.run(ids[2],'大厂背景','trait','ai',100); insTag.run(ids[2],'高潜力','trait','ai',88)
    insTag.run(ids[3],'应届生','education','ai',100); insTag.run(ids[3],'前端开发','skill','ai',90); insTag.run(ids[3],'985高校','education','ai',100)
    insTag.run(ids[4],'算法专家','skill','ai',95); insTag.run(ids[4],'机器学习','skill','ai',98); insTag.run(ids[4],'发表论文','trait','ai',100); insTag.run(ids[4],'985高校','education','ai',100)
  })

  demoSeed()

  // 种子用户
  const userCount = (sqliteDb.prepare('SELECT COUNT(*) as c FROM system_users').get() as any).c
  if (userCount === 0) {
    const insUser = sqliteDb.prepare(`INSERT INTO system_users (username,real_name,email,phone,role,department,status,password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    const now = new Date().toISOString()
    insUser.run('admin','系统管理员','admin@company.com','13800000001','admin','技术部','active','admin123',new Date(Date.now()-86400000*30).toISOString(),now)
    insUser.run('hr_zhang','张招聘','zhang.hr@company.com','13800000002','hr','人力资源部','active','hr123456',new Date(Date.now()-86400000*20).toISOString(),now)
    insUser.run('interviewer_li','李面试官','li.interview@company.com','13800000003','interviewer','研发部','active','inter123',new Date(Date.now()-86400000*10).toISOString(),now)
    insUser.run('viewer_wang','王只读','wang.view@company.com','13800000004','viewer','业务部','disabled','view1234',new Date(Date.now()-86400000*5).toISOString(),now)
  }

  console.log('✅ 演示数据写入完成')
}

seedIfEmpty()

// ==========================================
// SQLiteDatabase 类（与原 MemoryDatabase 接口完全兼容）
// ==========================================
class SQLiteDatabase {

  // ==========================================
  // 用户管理 CRUD
  // ==========================================
  getUsers(params: { keyword?: string; role?: string; status?: string; page?: number; pageSize?: number } = {}): { list: SystemUser[], total: number } {
    let sql = 'SELECT * FROM system_users WHERE 1=1'
    const args: any[] = []
    if (params.keyword) {
      sql += ' AND (username LIKE ? OR real_name LIKE ? OR email LIKE ? OR department LIKE ?)'
      const kw = `%${params.keyword}%`
      args.push(kw, kw, kw, kw)
    }
    if (params.role) { sql += ' AND role = ?'; args.push(params.role) }
    if (params.status) { sql += ' AND status = ?'; args.push(params.status) }
    sql += ' ORDER BY created_at DESC'

    const all = (sqliteDb.prepare(sql).all(...args) as any[]).map(r => rowToUser(r))
    const total = all.length
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const list = all.slice((page - 1) * pageSize, page * pageSize)
    return { list, total }
  }

  getUserById(id: number): SystemUser | undefined {
    const row = sqliteDb.prepare('SELECT * FROM system_users WHERE id = ?').get(id) as any
    return row ? rowToUser(row) : undefined
  }

  getUserByUsername(username: string): SystemUser | undefined {
    const row = sqliteDb.prepare('SELECT * FROM system_users WHERE username = ?').get(username) as any
    return row ? rowToUser(row, true) : undefined
  }

  createUser(data: SystemUser): { user?: SystemUser; error?: string } {
    const existing = sqliteDb.prepare('SELECT id FROM system_users WHERE username = ?').get(data.username)
    if (existing) return { error: `登录名 "${data.username}" 已存在` }
    const emailExists = sqliteDb.prepare('SELECT id FROM system_users WHERE email = ?').get(data.email)
    if (emailExists) return { error: `邮箱 "${data.email}" 已被使用` }
    const now = new Date().toISOString()
    const result = sqliteDb.prepare(`
      INSERT INTO system_users (username,real_name,email,phone,role,department,status,password,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(data.username, data.realName, data.email, data.phone||null, data.role, data.department||null, data.status||'active', data.password||null, now, now)
    return { user: this.getUserById(result.lastInsertRowid as number) }
  }

  updateUser(id: number, data: Partial<SystemUser>): { user?: SystemUser; error?: string } {
    const existing = sqliteDb.prepare('SELECT * FROM system_users WHERE id = ?').get(id) as any
    if (!existing) return { error: '用户不存在' }
    if (data.username && data.username !== existing.username) {
      const dup = sqliteDb.prepare('SELECT id FROM system_users WHERE username = ? AND id != ?').get(data.username, id)
      if (dup) return { error: `登录名 "${data.username}" 已存在` }
    }
    if (data.email && data.email !== existing.email) {
      const dup = sqliteDb.prepare('SELECT id FROM system_users WHERE email = ? AND id != ?').get(data.email, id)
      if (dup) return { error: `邮箱 "${data.email}" 已被使用` }
    }
    const now = new Date().toISOString()
    sqliteDb.prepare(`
      UPDATE system_users SET
        username=COALESCE(?,username), real_name=COALESCE(?,real_name),
        email=COALESCE(?,email), phone=COALESCE(?,phone),
        role=COALESCE(?,role), department=COALESCE(?,department),
        status=COALESCE(?,status), password=COALESCE(?,password),
        updated_at=?
      WHERE id=?
    `).run(
      data.username||null, data.realName||null, data.email||null, data.phone||null,
      data.role||null, data.department||null, data.status||null,
      data.password||null, now, id
    )
    return { user: this.getUserById(id) }
  }

  toggleUserStatus(id: number): { user?: SystemUser; error?: string } {
    const u = sqliteDb.prepare('SELECT status FROM system_users WHERE id=?').get(id) as any
    if (!u) return { error: '用户不存在' }
    return this.updateUser(id, { status: u.status === 'active' ? 'disabled' : 'active' })
  }

  deleteUser(id: number): boolean {
    const result = sqliteDb.prepare('DELETE FROM system_users WHERE id=?').run(id)
    return result.changes > 0
  }

  getUserCount(): number {
    return ((sqliteDb.prepare('SELECT COUNT(*) as c FROM system_users').get() as any).c)
  }

  // ==========================================
  // 候选人列表查询（多条件过滤）
  // ==========================================
  getCandidates(params: any = {}): { list: Candidate[], total: number } {
    // 先在 candidates 表上过滤主字段
    let sql = 'SELECT DISTINCT c.* FROM candidates c'
    const joins: string[] = []
    const where: string[] = ['1=1']
    const args: any[] = []

    // 需要 JOIN 的条件
    const needSkill = !!params.skillKeyword
    const needWork = !!params.companyKeyword || !!params.industryKeyword
    const needEdu = !!params.schoolKeyword || !!params.majorKeyword

    if (needSkill) {
      joins.push('LEFT JOIN skills sk ON sk.candidate_id = c.id')
    }
    if (needWork) {
      joins.push('LEFT JOIN work_experiences we ON we.candidate_id = c.id')
    }
    if (needEdu) {
      joins.push('LEFT JOIN educations ed ON ed.candidate_id = c.id')
    }

    if (joins.length) sql += ' ' + joins.join(' ')

    // 全文关键词
    if (params.keyword) {
      const kw = `%${params.keyword}%`
      where.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.expected_position LIKE ? OR c.self_evaluation LIKE ? OR c.location LIKE ? OR c.hr_notes LIKE ?)')
      args.push(kw, kw, kw, kw, kw, kw, kw)
    }
    if (params.name) { where.push('c.name LIKE ?'); args.push(`%${params.name}%`) }
    if (params.phone) { where.push('c.phone LIKE ?'); args.push(`%${params.phone}%`) }
    if (params.email) { where.push('c.email LIKE ?'); args.push(`%${params.email}%`) }
    if (params.gender) { where.push('c.gender = ?'); args.push(params.gender) }
    if (params.minAge) { where.push('c.age >= ?'); args.push(Number(params.minAge)) }
    if (params.maxAge) { where.push('c.age <= ?'); args.push(Number(params.maxAge)) }
    if (params.location) { where.push('c.location LIKE ?'); args.push(`%${params.location}%`) }
    if (params.expectedPosition) { where.push('c.expected_position LIKE ?'); args.push(`%${params.expectedPosition}%`) }
    if (params.expectedCity) { where.push('c.expected_city LIKE ?'); args.push(`%${params.expectedCity}%`) }
    if (params.currentStatus) { where.push('c.current_status = ?'); args.push(params.currentStatus) }
    if (params.candidateStatus) { where.push('c.candidate_status = ?'); args.push(params.candidateStatus) }
    if (params.highestEducation) { where.push('c.highest_education = ?'); args.push(params.highestEducation) }
    if (params.sourceChannel) { where.push('c.source_channel = ?'); args.push(params.sourceChannel) }
    if (params.minExperience !== undefined && params.minExperience !== '') { where.push('c.years_of_experience >= ?'); args.push(Number(params.minExperience)) }
    if (params.maxExperience !== undefined && params.maxExperience !== '') { where.push('c.years_of_experience <= ?'); args.push(Number(params.maxExperience)) }
    if (params.minSalary !== undefined && params.minSalary !== '') { where.push('c.expected_salary_max >= ?'); args.push(Number(params.minSalary)) }
    if (params.maxSalary !== undefined && params.maxSalary !== '') { where.push('c.expected_salary_min <= ?'); args.push(Number(params.maxSalary)) }
    if (params.minMatchScore !== undefined && params.minMatchScore !== '') { where.push('c.match_score >= ?'); args.push(Number(params.minMatchScore)) }
    if (params.isBlacklist !== undefined && params.isBlacklist !== '') { where.push('c.is_blacklist = ?'); args.push(params.isBlacklist === 'true' || params.isBlacklist === true ? 1 : 0) }
    if (params.hrNotesKeyword) { where.push('c.hr_notes LIKE ?'); args.push(`%${params.hrNotesKeyword}%`) }

    // hasResume
    if (params.hasResume === 'true' || params.hasResume === true) {
      where.push('EXISTS (SELECT 1 FROM resume_files rf WHERE rf.candidate_id = c.id)')
    } else if (params.hasResume === 'false' || params.hasResume === false) {
      where.push('NOT EXISTS (SELECT 1 FROM resume_files rf WHERE rf.candidate_id = c.id)')
    }

    // 多技能 AND 逻辑
    if (needSkill) {
      const skillKws = (params.skillKeyword as string).split(',').map((s: string) => s.trim()).filter(Boolean)
      skillKws.forEach(kw => {
        where.push('EXISTS (SELECT 1 FROM skills sk2 WHERE sk2.candidate_id = c.id AND sk2.skill_name LIKE ?)')
        args.push(`%${kw}%`)
      })
    }
    if (params.companyKeyword) { where.push('we.company_name LIKE ?'); args.push(`%${params.companyKeyword}%`) }
    if (params.industryKeyword) { where.push('we.industry LIKE ?'); args.push(`%${params.industryKeyword}%`) }
    if (params.schoolKeyword) { where.push('ed.school_name LIKE ?'); args.push(`%${params.schoolKeyword}%`) }
    if (params.majorKeyword) { where.push('ed.major LIKE ?'); args.push(`%${params.majorKeyword}%`) }

    sql += ' WHERE ' + where.join(' AND ')

    // 排序
    const sortMap: Record<string, string> = {
      createdAt: 'c.created_at', matchScore: 'c.match_score',
      yearsOfExperience: 'c.years_of_experience', name: 'c.name', age: 'c.age'
    }
    const sortCol = sortMap[params.sortBy] || 'c.created_at'
    const sortDir = params.sortOrder === 'asc' ? 'ASC' : 'DESC'
    sql += ` ORDER BY ${sortCol} ${sortDir}`

    const allRows = sqliteDb.prepare(sql).all(...args) as any[]
    const total = allRows.length
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const pageRows = allRows.slice((page - 1) * pageSize, page * pageSize)

    const list = pageRows.map(row => {
      const c = rowToCandidate(row)
      c.tags = (sqliteDb.prepare('SELECT * FROM candidate_tags WHERE candidate_id=? ORDER BY id').all(c.id) as any[]).map(rowToTag)
      c.skills = (sqliteDb.prepare('SELECT * FROM skills WHERE candidate_id=? ORDER BY id').all(c.id) as any[]).map(rowToSkill)
      return c
    })

    return { list, total }
  }

  getCandidateById(id: number): Candidate | undefined {
    const row = sqliteDb.prepare('SELECT * FROM candidates WHERE id=?').get(id) as any
    if (!row) return undefined
    const c = rowToCandidate(row)
    c.educations = (sqliteDb.prepare('SELECT * FROM educations WHERE candidate_id=? ORDER BY sort_order').all(id) as any[]).map(rowToEducation)
    c.workExperiences = (sqliteDb.prepare('SELECT * FROM work_experiences WHERE candidate_id=? ORDER BY sort_order').all(id) as any[]).map(rowToWorkExp)
    c.projects = (sqliteDb.prepare('SELECT * FROM projects WHERE candidate_id=? ORDER BY sort_order').all(id) as any[]).map(rowToProject)
    c.skills = (sqliteDb.prepare('SELECT * FROM skills WHERE candidate_id=? ORDER BY id').all(id) as any[]).map(rowToSkill)
    c.certifications = (sqliteDb.prepare('SELECT * FROM certifications WHERE candidate_id=? ORDER BY id').all(id) as any[]).map(rowToCertification)
    c.tags = (sqliteDb.prepare('SELECT * FROM candidate_tags WHERE candidate_id=? ORDER BY id').all(id) as any[]).map(rowToTag)
    c.interviewRecords = (sqliteDb.prepare('SELECT * FROM interview_records WHERE candidate_id=? ORDER BY created_at DESC').all(id) as any[]).map(rowToInterview)
    return c
  }

  createCandidate(data: Candidate): Candidate {
    const now = new Date().toISOString()
    const result = sqliteDb.prepare(`
      INSERT INTO candidates (name,gender,age,birth_date,phone,email,location,hometown,
        avatar_url,current_status,years_of_experience,highest_education,
        expected_salary_min,expected_salary_max,expected_position,expected_city,
        self_evaluation,linkedin_url,github_url,portfolio_url,source_channel,
        candidate_status,is_blacklist,hr_notes,match_score,raw_resume_text,
        created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      data.name, data.gender||null, data.age||null, data.birthDate||null,
      data.phone||null, data.email||null, data.location||null, data.hometown||null,
      data.avatarUrl||null, data.currentStatus||null, data.yearsOfExperience||null,
      data.highestEducation||null, data.expectedSalaryMin||null, data.expectedSalaryMax||null,
      data.expectedPosition||null, data.expectedCity||null, data.selfEvaluation||null,
      data.linkedinUrl||null, data.githubUrl||null, data.portfolioUrl||null,
      data.sourceChannel||null, data.candidateStatus||'active',
      data.isBlacklist ? 1 : 0, data.hrNotes||null, data.matchScore||null,
      data.rawResumeText||null, now, now
    )
    const id = result.lastInsertRowid as number
    if (data.educations?.length) this._saveEducations(id, data.educations)
    if (data.workExperiences?.length) this._saveWorkExperiences(id, data.workExperiences)
    if (data.projects?.length) this._saveProjects(id, data.projects)
    if (data.skills?.length) this._saveSkills(id, data.skills)
    if (data.certifications?.length) this._saveCertifications(id, data.certifications)
    if (data.tags?.length) this._saveTags(id, data.tags)
    return this.getCandidateById(id)!
  }

  updateCandidate(id: number, data: Partial<Candidate>): Candidate | undefined {
    const existing = sqliteDb.prepare('SELECT id FROM candidates WHERE id=?').get(id)
    if (!existing) return undefined
    const now = new Date().toISOString()
    sqliteDb.prepare(`
      UPDATE candidates SET
        name=COALESCE(?,name), gender=COALESCE(?,gender), age=COALESCE(?,age),
        phone=COALESCE(?,phone), email=COALESCE(?,email), location=COALESCE(?,location),
        hometown=COALESCE(?,hometown), current_status=COALESCE(?,current_status),
        years_of_experience=COALESCE(?,years_of_experience),
        highest_education=COALESCE(?,highest_education),
        expected_salary_min=COALESCE(?,expected_salary_min),
        expected_salary_max=COALESCE(?,expected_salary_max),
        expected_position=COALESCE(?,expected_position),
        expected_city=COALESCE(?,expected_city),
        self_evaluation=COALESCE(?,self_evaluation),
        source_channel=COALESCE(?,source_channel),
        candidate_status=COALESCE(?,candidate_status),
        is_blacklist=COALESCE(?,is_blacklist),
        hr_notes=COALESCE(?,hr_notes),
        match_score=COALESCE(?,match_score),
        raw_resume_text=COALESCE(?,raw_resume_text),
        updated_at=?
      WHERE id=?
    `).run(
      data.name||null, data.gender||null, data.age||null,
      data.phone||null, data.email||null, data.location||null,
      data.hometown||null, data.currentStatus||null, data.yearsOfExperience||null,
      data.highestEducation||null, data.expectedSalaryMin||null, data.expectedSalaryMax||null,
      data.expectedPosition||null, data.expectedCity||null, data.selfEvaluation||null,
      data.sourceChannel||null, data.candidateStatus||null,
      data.isBlacklist !== undefined ? (data.isBlacklist ? 1 : 0) : null,
      data.hrNotes||null, data.matchScore||null, data.rawResumeText||null,
      now, id
    )
    if (data.educations !== undefined) { sqliteDb.prepare('DELETE FROM educations WHERE candidate_id=?').run(id); this._saveEducations(id, data.educations) }
    if (data.workExperiences !== undefined) { sqliteDb.prepare('DELETE FROM work_experiences WHERE candidate_id=?').run(id); this._saveWorkExperiences(id, data.workExperiences) }
    if (data.skills !== undefined) { sqliteDb.prepare('DELETE FROM skills WHERE candidate_id=?').run(id); this._saveSkills(id, data.skills) }
    if (data.tags !== undefined) { sqliteDb.prepare('DELETE FROM candidate_tags WHERE candidate_id=?').run(id); this._saveTags(id, data.tags) }
    return this.getCandidateById(id)
  }

  deleteCandidate(id: number): boolean {
    // CASCADE 会自动删除关联表数据
    const result = sqliteDb.prepare('DELETE FROM candidates WHERE id=?').run(id)
    return result.changes > 0
  }

  // ==========================================
  // 关联数据写入
  // ==========================================
  private _saveEducations(candidateId: number, items: Education[]) {
    const ins = sqliteDb.prepare(`INSERT INTO educations (candidate_id,school_name,degree,major,start_date,end_date,gpa,description,is_985,is_211,is_overseas,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    items.forEach((e, i) => ins.run(candidateId, e.schoolName, e.degree, e.major||null, e.startDate||null, e.endDate||null, e.gpa||null, e.description||null, e.is985?1:0, e.is211?1:0, e.isOverseas?1:0, i))
  }
  private _saveWorkExperiences(candidateId: number, items: WorkExperience[]) {
    const ins = sqliteDb.prepare(`INSERT INTO work_experiences (candidate_id,company_name,company_size,company_type,industry,position,job_level,department,start_date,end_date,is_current,salary,description,achievements,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    items.forEach((w, i) => ins.run(candidateId, w.companyName, w.companySize||null, w.companyType||null, w.industry||null, w.position, w.jobLevel||null, w.department||null, w.startDate||null, w.endDate||null, w.isCurrent?1:0, w.salary||null, w.description||null, w.achievements||null, i))
  }
  private _saveProjects(candidateId: number, items: Project[]) {
    const ins = sqliteDb.prepare(`INSERT INTO projects (candidate_id,project_name,role,start_date,end_date,tech_stack,description,achievements,project_url,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    items.forEach((p, i) => ins.run(candidateId, p.projectName, p.role||null, p.startDate||null, p.endDate||null, p.techStack||null, p.description||null, p.achievements||null, p.projectUrl||null, i))
  }
  private _saveSkills(candidateId: number, items: Skill[]) {
    const ins = sqliteDb.prepare(`INSERT INTO skills (candidate_id,skill_name,proficiency,years_used,category) VALUES (?,?,?,?,?)`)
    items.forEach(s => ins.run(candidateId, s.skillName, s.proficiency||null, s.yearsUsed||null, s.category||null))
  }
  private _saveCertifications(candidateId: number, items: Certification[]) {
    const ins = sqliteDb.prepare(`INSERT INTO certifications (candidate_id,cert_name,issuing_org,issue_date,cert_type,description) VALUES (?,?,?,?,?,?)`)
    items.forEach(c => ins.run(candidateId, c.certName, c.issuingOrg||null, c.issueDate||null, c.certType||null, c.description||null))
  }
  private _saveTags(candidateId: number, items: CandidateTag[]) {
    const ins = sqliteDb.prepare(`INSERT INTO candidate_tags (candidate_id,tag_name,tag_type,tag_source,confidence) VALUES (?,?,?,?,?)`)
    items.forEach(t => ins.run(candidateId, t.tagName, t.tagType||null, t.tagSource||null, t.confidence||null))
  }

  // ==========================================
  // 面试记录
  // ==========================================
  addInterviewRecord(candidateId: number, data: InterviewRecord): InterviewRecord {
    const now = new Date().toISOString()
    const result = sqliteDb.prepare(`
      INSERT INTO interview_records (candidate_id,interview_type,interview_round,interview_date,interviewer,result,score,feedback,next_step,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(candidateId, data.interviewType||null, data.interviewRound||null, data.interviewDate||null, data.interviewer||null, data.result||null, data.score||null, data.feedback||null, data.nextStep||null, now)
    return { ...data, id: result.lastInsertRowid as number, candidateId, createdAt: now }
  }

  // ==========================================
  // 解析任务
  // ==========================================
  createParseTask(data: ParseTask): ParseTask {
    const now = new Date().toISOString()
    const result = sqliteDb.prepare(`
      INSERT INTO parse_tasks (candidate_id,file_name,file_url,file_type,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(data.candidateId||null, data.fileName, data.fileUrl||null, data.fileType||null, data.status||'pending', now, now)
    return { ...data, id: result.lastInsertRowid as number, createdAt: now }
  }

  updateParseTask(id: number, data: Partial<ParseTask>): void {
    sqliteDb.prepare(`
      UPDATE parse_tasks SET status=COALESCE(?,status), parse_result=COALESCE(?,parse_result),
        error_msg=COALESCE(?,error_msg), candidate_id=COALESCE(?,candidate_id),
        updated_at=? WHERE id=?
    `).run(data.status||null, data.parseResult||null, data.errorMsg||null, data.candidateId||null, new Date().toISOString(), id)
  }

  getParseTask(id: number): ParseTask | undefined {
    const row = sqliteDb.prepare('SELECT * FROM parse_tasks WHERE id=?').get(id) as any
    if (!row) return undefined
    return { id: row.id, candidateId: row.candidate_id, fileName: row.file_name, fileUrl: row.file_url, fileType: row.file_type, status: row.status, parseResult: row.parse_result, errorMsg: row.error_msg, createdAt: row.created_at, updatedAt: row.updated_at }
  }

  // ==========================================
  // 简历文件（Base64 存 SQLite BLOB TEXT）
  // ==========================================
  saveResumeFile(candidateId: number, file: { fileName: string; fileType: string; fileSize: number; fileData: string }): any {
    const now = new Date().toISOString()
    sqliteDb.prepare(`
      INSERT INTO resume_files (candidate_id,file_name,file_type,file_size,file_data,uploaded_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(candidate_id) DO UPDATE SET
        file_name=excluded.file_name, file_type=excluded.file_type,
        file_size=excluded.file_size, file_data=excluded.file_data,
        uploaded_at=excluded.uploaded_at
    `).run(candidateId, file.fileName, file.fileType, file.fileSize, file.fileData, now)
    // 同步更新候选人元数据
    sqliteDb.prepare(`
      UPDATE candidates SET resume_file_name=?,resume_file_type=?,resume_file_size=?,resume_uploaded_at=?,updated_at=? WHERE id=?
    `).run(file.fileName, file.fileType, file.fileSize, now, now, candidateId)
    return { candidateId, ...file, uploadedAt: now }
  }

  getResumeFile(candidateId: number): any {
    const row = sqliteDb.prepare('SELECT * FROM resume_files WHERE candidate_id=?').get(candidateId) as any
    if (!row) return undefined
    return { candidateId: row.candidate_id, fileName: row.file_name, fileType: row.file_type, fileSize: row.file_size, fileData: row.file_data, uploadedAt: row.uploaded_at }
  }

  deleteResumeFile(candidateId: number): boolean {
    const result = sqliteDb.prepare('DELETE FROM resume_files WHERE candidate_id=?').run(candidateId)
    if (result.changes > 0) {
      sqliteDb.prepare(`UPDATE candidates SET resume_file_name=NULL,resume_file_type=NULL,resume_file_size=NULL,resume_uploaded_at=NULL,updated_at=? WHERE id=?`).run(new Date().toISOString(), candidateId)
      return true
    }
    return false
  }

  // ==========================================
  // 统计数据
  // ==========================================
  getStatistics() {
    const total = ((sqliteDb.prepare('SELECT COUNT(*) as c FROM candidates').get() as any).c) as number

    const byStatus: Record<string, number> = {}
    ;(sqliteDb.prepare('SELECT candidate_status, COUNT(*) as c FROM candidates GROUP BY candidate_status').all() as any[]).forEach(r => { byStatus[r.candidate_status || 'active'] = r.c })

    const byEducation: Record<string, number> = {}
    ;(sqliteDb.prepare('SELECT highest_education, COUNT(*) as c FROM candidates GROUP BY highest_education').all() as any[]).forEach(r => { byEducation[r.highest_education || '未知'] = r.c })

    const byChannel: Record<string, number> = {}
    ;(sqliteDb.prepare('SELECT source_channel, COUNT(*) as c FROM candidates GROUP BY source_channel').all() as any[]).forEach(r => { byChannel[r.source_channel || '其他'] = r.c })

    const byExperience: Record<string, number> = { '0-2年': 0, '2-5年': 0, '5-10年': 0, '10年+': 0 }
    ;(sqliteDb.prepare('SELECT years_of_experience FROM candidates').all() as any[]).forEach(r => {
      const exp = r.years_of_experience || 0
      if (exp < 2) byExperience['0-2年']++
      else if (exp < 5) byExperience['2-5年']++
      else if (exp < 10) byExperience['5-10年']++
      else byExperience['10年+']++
    })

    const topSkills = (sqliteDb.prepare('SELECT skill_name, COUNT(*) as c FROM skills GROUP BY skill_name ORDER BY c DESC LIMIT 10').all() as any[]).map(r => ({ name: r.skill_name, count: r.c }))

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const recentAdded = ((sqliteDb.prepare('SELECT COUNT(*) as c FROM candidates WHERE created_at >= ?').get(thirtyDaysAgo) as any).c) as number

    const avgRow = sqliteDb.prepare('SELECT AVG(match_score) as avg FROM candidates').get() as any
    const avgMatchScore = avgRow.avg ? Math.round(avgRow.avg * 10) / 10 : 0

    return { total, recentAdded, byStatus, byEducation, byChannel, byExperience, topSkills, avgMatchScore }
  }
}

// 单例导出（与原代码接口完全兼容）
export const db = new SQLiteDatabase()
