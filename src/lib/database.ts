// ==========================================
// 数据存储层 - MySQL 持久化
// 依赖环境变量: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
// ==========================================
import mysql from 'mysql2/promise'
import type {
  Candidate, Education, WorkExperience, Project,
  Skill, Certification, CandidateTag, InterviewRecord, ParseTask
} from '../types'

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
// 连接池（全局单例）
// ==========================================
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'resume_db',
  charset:  'utf8mb4',
  timezone: '+08:00',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
})

// 便捷查询函数
async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params)
  return rows[0]
}

async function execute(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params)
  return result as mysql.ResultSetHeader
}

// ==========================================
// 行转对象
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
    resumeFileKey: row.resume_file_key,   // MinIO 对象 key
    resumeUploadedAt: row.resume_uploaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToEducation(r: any): Education {
  return { id: r.id, candidateId: r.candidate_id, schoolName: r.school_name, degree: r.degree, major: r.major, startDate: r.start_date, endDate: r.end_date, gpa: r.gpa, description: r.description, is985: !!r.is_985, is211: !!r.is_211, isOverseas: !!r.is_overseas, sortOrder: r.sort_order }
}
function rowToWorkExp(r: any): WorkExperience {
  return { id: r.id, candidateId: r.candidate_id, companyName: r.company_name, companySize: r.company_size, companyType: r.company_type, industry: r.industry, position: r.position, jobLevel: r.job_level, department: r.department, startDate: r.start_date, endDate: r.end_date, isCurrent: !!r.is_current, salary: r.salary, description: r.description, achievements: r.achievements, sortOrder: r.sort_order }
}
function rowToSkill(r: any): Skill {
  return { id: r.id, candidateId: r.candidate_id, skillName: r.skill_name, proficiency: r.proficiency, yearsUsed: r.years_used, category: r.category }
}
function rowToTag(r: any): CandidateTag {
  return { id: r.id, candidateId: r.candidate_id, tagName: r.tag_name, tagType: r.tag_type, tagSource: r.tag_source, confidence: r.confidence }
}
function rowToProject(r: any): Project {
  return { id: r.id, candidateId: r.candidate_id, projectName: r.project_name, role: r.role, startDate: r.start_date, endDate: r.end_date, techStack: r.tech_stack, description: r.description, achievements: r.achievements, projectUrl: r.project_url, sortOrder: r.sort_order }
}
function rowToCertification(r: any): Certification {
  return { id: r.id, candidateId: r.candidate_id, certName: r.cert_name, issuingOrg: r.issuing_org, issueDate: r.issue_date, certType: r.cert_type, description: r.description }
}
function rowToInterview(r: any): InterviewRecord {
  return { id: r.id, candidateId: r.candidate_id, interviewType: r.interview_type, interviewRound: r.interview_round, interviewDate: r.interview_date, interviewer: r.interviewer, result: r.result, score: r.score, feedback: r.feedback, nextStep: r.next_step, createdAt: r.created_at }
}
function rowToUser(r: any, includePassword = false): SystemUser {
  const u: SystemUser = { id: r.id, username: r.username, realName: r.real_name, email: r.email, phone: r.phone, role: r.role, department: r.department, status: r.status, avatar: r.avatar, lastLoginAt: r.last_login_at, createdAt: r.created_at, updatedAt: r.updated_at }
  if (includePassword) u.password = r.password
  return u
}

// ==========================================
// MySQLDatabase 类
// ==========================================
class MySQLDatabase {

  // ==========================================
  // 用户管理
  // ==========================================
  async getUsers(params: { keyword?: string; role?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<{ list: SystemUser[], total: number }> {
    const wheres: string[] = ['1=1']
    const args: any[] = []
    if (params.keyword) {
      wheres.push('(username LIKE ? OR real_name LIKE ? OR email LIKE ? OR department LIKE ?)')
      const kw = `%${params.keyword}%`
      args.push(kw, kw, kw, kw)
    }
    if (params.role)   { wheres.push('role = ?');   args.push(params.role) }
    if (params.status) { wheres.push('status = ?'); args.push(params.status) }

    const where = wheres.join(' AND ')
    const total = ((await queryOne<any>(`SELECT COUNT(*) as c FROM system_users WHERE ${where}`, args))?.c || 0) as number
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const offset = (page - 1) * pageSize
    const rows = await query(`SELECT * FROM system_users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...args, pageSize, offset])
    return { list: rows.map(r => rowToUser(r)), total }
  }

  async getUserById(id: number): Promise<SystemUser | undefined> {
    const row = await queryOne('SELECT * FROM system_users WHERE id=?', [id])
    return row ? rowToUser(row) : undefined
  }

  async getUserByUsername(username: string): Promise<SystemUser | undefined> {
    const row = await queryOne('SELECT * FROM system_users WHERE username=?', [username])
    return row ? rowToUser(row, true) : undefined
  }

  async createUser(data: SystemUser): Promise<{ user?: SystemUser; error?: string }> {
    const dup = await queryOne('SELECT id FROM system_users WHERE username=?', [data.username])
    if (dup) return { error: `登录名 "${data.username}" 已存在` }
    const emailDup = await queryOne('SELECT id FROM system_users WHERE email=?', [data.email])
    if (emailDup) return { error: `邮箱 "${data.email}" 已被使用` }
    const result = await execute(
      'INSERT INTO system_users (username,real_name,email,phone,role,department,status,password) VALUES (?,?,?,?,?,?,?,?)',
      [data.username, data.realName, data.email, data.phone||null, data.role, data.department||null, data.status||'active', data.password||null]
    )
    return { user: await this.getUserById(result.insertId) }
  }

  async updateUser(id: number, data: Partial<SystemUser>): Promise<{ user?: SystemUser; error?: string }> {
    const existing = await queryOne<any>('SELECT * FROM system_users WHERE id=?', [id])
    if (!existing) return { error: '用户不存在' }
    if (data.username && data.username !== existing.username) {
      const dup = await queryOne('SELECT id FROM system_users WHERE username=? AND id!=?', [data.username, id])
      if (dup) return { error: `登录名 "${data.username}" 已存在` }
    }
    if (data.email && data.email !== existing.email) {
      const dup = await queryOne('SELECT id FROM system_users WHERE email=? AND id!=?', [data.email, id])
      if (dup) return { error: `邮箱 "${data.email}" 已被使用` }
    }
    await execute(`
      UPDATE system_users SET
        username=COALESCE(?,username), real_name=COALESCE(?,real_name),
        email=COALESCE(?,email), phone=COALESCE(?,phone),
        role=COALESCE(?,role), department=COALESCE(?,department),
        status=COALESCE(?,status), password=COALESCE(?,password)
      WHERE id=?`,
      [data.username||null, data.realName||null, data.email||null, data.phone||null,
       data.role||null, data.department||null, data.status||null, data.password||null, id]
    )
    return { user: await this.getUserById(id) }
  }

  async toggleUserStatus(id: number): Promise<{ user?: SystemUser; error?: string }> {
    const u = await queryOne<any>('SELECT status FROM system_users WHERE id=?', [id])
    if (!u) return { error: '用户不存在' }
    return this.updateUser(id, { status: u.status === 'active' ? 'disabled' : 'active' })
  }

  async deleteUser(id: number): Promise<boolean> {
    const r = await execute('DELETE FROM system_users WHERE id=?', [id])
    return r.affectedRows > 0
  }

  async getUserCount(): Promise<number> {
    return ((await queryOne<any>('SELECT COUNT(*) as c FROM system_users'))?.c || 0) as number
  }

  async updateLastLogin(id: number): Promise<void> {
    await execute('UPDATE system_users SET last_login_at=NOW() WHERE id=?', [id])
  }

  // ==========================================
  // 候选人列表（多条件过滤）
  // ==========================================
  async getCandidates(params: any = {}): Promise<{ list: Candidate[], total: number }> {
    const wheres: string[] = ['1=1']
    const args: any[] = []
    const joins: string[] = []

    // 全文关键词
    if (params.keyword) {
      wheres.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.expected_position LIKE ? OR c.self_evaluation LIKE ? OR c.location LIKE ? OR c.hr_notes LIKE ?)')
      const kw = `%${params.keyword}%`
      args.push(kw, kw, kw, kw, kw, kw, kw)
    }
    if (params.name)     { wheres.push('c.name LIKE ?');              args.push(`%${params.name}%`) }
    if (params.phone)    { wheres.push('c.phone LIKE ?');             args.push(`%${params.phone}%`) }
    if (params.email)    { wheres.push('c.email LIKE ?');             args.push(`%${params.email}%`) }
    if (params.gender)   { wheres.push('c.gender = ?');               args.push(params.gender) }
    if (params.minAge)   { wheres.push('c.age >= ?');                 args.push(Number(params.minAge)) }
    if (params.maxAge)   { wheres.push('c.age <= ?');                 args.push(Number(params.maxAge)) }
    if (params.location) { wheres.push('c.location LIKE ?');          args.push(`%${params.location}%`) }
    if (params.expectedPosition) { wheres.push('c.expected_position LIKE ?'); args.push(`%${params.expectedPosition}%`) }
    if (params.expectedCity)     { wheres.push('c.expected_city LIKE ?');     args.push(`%${params.expectedCity}%`) }
    if (params.currentStatus)    { wheres.push('c.current_status = ?');       args.push(params.currentStatus) }
    if (params.candidateStatus)  { wheres.push('c.candidate_status = ?');     args.push(params.candidateStatus) }
    if (params.highestEducation) { wheres.push('c.highest_education = ?');    args.push(params.highestEducation) }
    if (params.sourceChannel)    { wheres.push('c.source_channel = ?');       args.push(params.sourceChannel) }
    if (params.minExperience !== undefined && params.minExperience !== '') { wheres.push('c.years_of_experience >= ?'); args.push(Number(params.minExperience)) }
    if (params.maxExperience !== undefined && params.maxExperience !== '') { wheres.push('c.years_of_experience <= ?'); args.push(Number(params.maxExperience)) }
    if (params.minSalary !== undefined && params.minSalary !== '') { wheres.push('c.expected_salary_max >= ?'); args.push(Number(params.minSalary)) }
    if (params.maxSalary !== undefined && params.maxSalary !== '') { wheres.push('c.expected_salary_min <= ?'); args.push(Number(params.maxSalary)) }
    if (params.minMatchScore !== undefined && params.minMatchScore !== '') { wheres.push('c.match_score >= ?'); args.push(Number(params.minMatchScore)) }
    if (params.isBlacklist !== undefined && params.isBlacklist !== '') { wheres.push('c.is_blacklist = ?'); args.push(params.isBlacklist === 'true' || params.isBlacklist === true ? 1 : 0) }
    if (params.hrNotesKeyword) { wheres.push('c.hr_notes LIKE ?'); args.push(`%${params.hrNotesKeyword}%`) }

    // hasResume：是否有文件 key
    if (params.hasResume === 'true' || params.hasResume === true) {
      wheres.push('c.resume_file_key IS NOT NULL')
    } else if (params.hasResume === 'false' || params.hasResume === false) {
      wheres.push('c.resume_file_key IS NULL')
    }

    // 技能（AND 逻辑，每个关键词用 EXISTS 子查询）
    if (params.skillKeyword) {
      const skillKws = (params.skillKeyword as string).split(',').map((s: string) => s.trim()).filter(Boolean)
      skillKws.forEach(kw => {
        wheres.push('EXISTS (SELECT 1 FROM skills sk WHERE sk.candidate_id=c.id AND sk.skill_name LIKE ?)')
        args.push(`%${kw}%`)
      })
    }
    // 公司名
    if (params.companyKeyword) {
      wheres.push('EXISTS (SELECT 1 FROM work_experiences we WHERE we.candidate_id=c.id AND we.company_name LIKE ?)')
      args.push(`%${params.companyKeyword}%`)
    }
    // 行业
    if (params.industryKeyword) {
      wheres.push('EXISTS (SELECT 1 FROM work_experiences we WHERE we.candidate_id=c.id AND we.industry LIKE ?)')
      args.push(`%${params.industryKeyword}%`)
    }
    // 学校
    if (params.schoolKeyword) {
      wheres.push('EXISTS (SELECT 1 FROM educations ed WHERE ed.candidate_id=c.id AND ed.school_name LIKE ?)')
      args.push(`%${params.schoolKeyword}%`)
    }
    // 专业
    if (params.majorKeyword) {
      wheres.push('EXISTS (SELECT 1 FROM educations ed WHERE ed.candidate_id=c.id AND ed.major LIKE ?)')
      args.push(`%${params.majorKeyword}%`)
    }

    const where = wheres.join(' AND ')
    const sortMap: Record<string, string> = {
      createdAt: 'c.created_at', matchScore: 'c.match_score',
      yearsOfExperience: 'c.years_of_experience', name: 'c.name', age: 'c.age'
    }
    const sortCol = sortMap[params.sortBy] || 'c.created_at'
    const sortDir = (params.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const total = ((await queryOne<any>(`SELECT COUNT(*) as c FROM candidates c ${joins.join(' ')} WHERE ${where}`, args))?.c || 0) as number
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const offset = (page - 1) * pageSize

    const rows = await query(
      `SELECT c.* FROM candidates c ${joins.join(' ')} WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
      [...args, pageSize, offset]
    )

    // 附加 tags 和 skills 用于列表展示
    const list: Candidate[] = []
    for (const row of rows) {
      const c = rowToCandidate(row)
      c.tags   = (await query('SELECT * FROM candidate_tags WHERE candidate_id=?', [c.id])).map(rowToTag)
      c.skills = (await query('SELECT * FROM skills WHERE candidate_id=?', [c.id])).map(rowToSkill)
      list.push(c)
    }
    return { list, total }
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    const row = await queryOne('SELECT * FROM candidates WHERE id=?', [id])
    if (!row) return undefined
    const c = rowToCandidate(row)
    c.educations      = (await query('SELECT * FROM educations WHERE candidate_id=? ORDER BY sort_order', [id])).map(rowToEducation)
    c.workExperiences = (await query('SELECT * FROM work_experiences WHERE candidate_id=? ORDER BY sort_order', [id])).map(rowToWorkExp)
    c.projects        = (await query('SELECT * FROM projects WHERE candidate_id=? ORDER BY sort_order', [id])).map(rowToProject)
    c.skills          = (await query('SELECT * FROM skills WHERE candidate_id=?', [id])).map(rowToSkill)
    c.certifications  = (await query('SELECT * FROM certifications WHERE candidate_id=?', [id])).map(rowToCertification)
    c.tags            = (await query('SELECT * FROM candidate_tags WHERE candidate_id=?', [id])).map(rowToTag)
    c.interviewRecords= (await query('SELECT * FROM interview_records WHERE candidate_id=? ORDER BY created_at DESC', [id])).map(rowToInterview)
    return c
  }

  async createCandidate(data: Candidate): Promise<Candidate> {
    const result = await execute(`
      INSERT INTO candidates (name,gender,age,birth_date,phone,email,location,hometown,
        avatar_url,current_status,years_of_experience,highest_education,
        expected_salary_min,expected_salary_max,expected_position,expected_city,
        self_evaluation,linkedin_url,github_url,portfolio_url,source_channel,
        candidate_status,is_blacklist,hr_notes,match_score,raw_resume_text)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [data.name, data.gender||null, data.age||null, data.birthDate||null,
       data.phone||null, data.email||null, data.location||null, data.hometown||null,
       data.avatarUrl||null, data.currentStatus||null, data.yearsOfExperience||null,
       data.highestEducation||null, data.expectedSalaryMin||null, data.expectedSalaryMax||null,
       data.expectedPosition||null, data.expectedCity||null, data.selfEvaluation||null,
       data.linkedinUrl||null, data.githubUrl||null, data.portfolioUrl||null,
       data.sourceChannel||null, data.candidateStatus||'active',
       data.isBlacklist ? 1 : 0, data.hrNotes||null, data.matchScore||null, data.rawResumeText||null]
    )
    const id = result.insertId
    if (data.educations?.length)      await this._saveEducations(id, data.educations)
    if (data.workExperiences?.length) await this._saveWorkExperiences(id, data.workExperiences)
    if (data.projects?.length)        await this._saveProjects(id, data.projects)
    if (data.skills?.length)          await this._saveSkills(id, data.skills)
    if (data.certifications?.length)  await this._saveCertifications(id, data.certifications)
    if (data.tags?.length)            await this._saveTags(id, data.tags)
    return (await this.getCandidateById(id))!
  }

  async updateCandidate(id: number, data: Partial<Candidate>): Promise<Candidate | undefined> {
    const existing = await queryOne('SELECT id FROM candidates WHERE id=?', [id])
    if (!existing) return undefined
    await execute(`
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
        raw_resume_text=COALESCE(?,raw_resume_text)
      WHERE id=?`,
      [data.name||null, data.gender||null, data.age||null,
       data.phone||null, data.email||null, data.location||null,
       data.hometown||null, data.currentStatus||null, data.yearsOfExperience||null,
       data.highestEducation||null, data.expectedSalaryMin||null, data.expectedSalaryMax||null,
       data.expectedPosition||null, data.expectedCity||null, data.selfEvaluation||null,
       data.sourceChannel||null, data.candidateStatus||null,
       data.isBlacklist !== undefined ? (data.isBlacklist ? 1 : 0) : null,
       data.hrNotes||null, data.matchScore||null, data.rawResumeText||null, id]
    )
    if (data.educations !== undefined)      { await execute('DELETE FROM educations WHERE candidate_id=?', [id]);       await this._saveEducations(id, data.educations) }
    if (data.workExperiences !== undefined) { await execute('DELETE FROM work_experiences WHERE candidate_id=?', [id]); await this._saveWorkExperiences(id, data.workExperiences) }
    if (data.skills !== undefined)          { await execute('DELETE FROM skills WHERE candidate_id=?', [id]);           await this._saveSkills(id, data.skills) }
    if (data.tags !== undefined)            { await execute('DELETE FROM candidate_tags WHERE candidate_id=?', [id]);   await this._saveTags(id, data.tags) }
    return this.getCandidateById(id)
  }

  async deleteCandidate(id: number): Promise<boolean> {
    const r = await execute('DELETE FROM candidates WHERE id=?', [id])
    return r.affectedRows > 0
  }

  // ==========================================
  // 关联数据写入
  // ==========================================
  private async _saveEducations(cid: number, items: Education[]) {
    for (let i = 0; i < items.length; i++) {
      const e = items[i]
      await execute('INSERT INTO educations (candidate_id,school_name,degree,major,start_date,end_date,gpa,description,is_985,is_211,is_overseas,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [cid, e.schoolName, e.degree, e.major||null, e.startDate||null, e.endDate||null, e.gpa||null, e.description||null, e.is985?1:0, e.is211?1:0, e.isOverseas?1:0, i])
    }
  }
  private async _saveWorkExperiences(cid: number, items: WorkExperience[]) {
    for (let i = 0; i < items.length; i++) {
      const w = items[i]
      await execute('INSERT INTO work_experiences (candidate_id,company_name,company_size,company_type,industry,position,job_level,department,start_date,end_date,is_current,salary,description,achievements,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [cid, w.companyName, w.companySize||null, w.companyType||null, w.industry||null, w.position, w.jobLevel||null, w.department||null, w.startDate||null, w.endDate||null, w.isCurrent?1:0, w.salary||null, w.description||null, w.achievements||null, i])
    }
  }
  private async _saveProjects(cid: number, items: Project[]) {
    for (let i = 0; i < items.length; i++) {
      const p = items[i]
      await execute('INSERT INTO projects (candidate_id,project_name,role,start_date,end_date,tech_stack,description,achievements,project_url,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [cid, p.projectName, p.role||null, p.startDate||null, p.endDate||null, p.techStack||null, p.description||null, p.achievements||null, p.projectUrl||null, i])
    }
  }
  private async _saveSkills(cid: number, items: Skill[]) {
    for (const s of items) {
      await execute('INSERT INTO skills (candidate_id,skill_name,proficiency,years_used,category) VALUES (?,?,?,?,?)',
        [cid, s.skillName, s.proficiency||null, s.yearsUsed||null, s.category||null])
    }
  }
  private async _saveCertifications(cid: number, items: Certification[]) {
    for (const c of items) {
      await execute('INSERT INTO certifications (candidate_id,cert_name,issuing_org,issue_date,cert_type,description) VALUES (?,?,?,?,?,?)',
        [cid, c.certName, c.issuingOrg||null, c.issueDate||null, c.certType||null, c.description||null])
    }
  }
  private async _saveTags(cid: number, items: CandidateTag[]) {
    for (const t of items) {
      await execute('INSERT INTO candidate_tags (candidate_id,tag_name,tag_type,tag_source,confidence) VALUES (?,?,?,?,?)',
        [cid, t.tagName, t.tagType||null, t.tagSource||null, t.confidence||null])
    }
  }

  // ==========================================
  // 面试记录
  // ==========================================
  async addInterviewRecord(candidateId: number, data: InterviewRecord): Promise<InterviewRecord> {
    const result = await execute(
      'INSERT INTO interview_records (candidate_id,interview_type,interview_round,interview_date,interviewer,result,score,feedback,next_step) VALUES (?,?,?,?,?,?,?,?,?)',
      [candidateId, data.interviewType||null, data.interviewRound||null, data.interviewDate||null,
       data.interviewer||null, data.result||null, data.score||null, data.feedback||null, data.nextStep||null]
    )
    return { ...data, id: result.insertId, candidateId, createdAt: new Date().toISOString() }
  }

  // ==========================================
  // 解析任务
  // ==========================================
  async createParseTask(data: ParseTask): Promise<ParseTask> {
    const result = await execute(
      'INSERT INTO parse_tasks (candidate_id,file_name,file_url,file_type,status) VALUES (?,?,?,?,?)',
      [data.candidateId||null, data.fileName, data.fileUrl||null, data.fileType||null, data.status||'pending']
    )
    return { ...data, id: result.insertId, createdAt: new Date().toISOString() }
  }

  async updateParseTask(id: number, data: Partial<ParseTask>): Promise<void> {
    await execute(
      'UPDATE parse_tasks SET status=COALESCE(?,status), parse_result=COALESCE(?,parse_result), error_msg=COALESCE(?,error_msg), candidate_id=COALESCE(?,candidate_id) WHERE id=?',
      [data.status||null, data.parseResult||null, data.errorMsg||null, data.candidateId||null, id]
    )
  }

  async getParseTask(id: number): Promise<ParseTask | undefined> {
    const r = await queryOne<any>('SELECT * FROM parse_tasks WHERE id=?', [id])
    if (!r) return undefined
    return { id: r.id, candidateId: r.candidate_id, fileName: r.file_name, fileUrl: r.file_url, fileType: r.file_type, status: r.status, parseResult: r.parse_result, errorMsg: r.error_msg, createdAt: r.created_at, updatedAt: r.updated_at }
  }

  // ==========================================
  // 简历文件元数据（文件本身存 MinIO）
  // ==========================================

  /** 更新候选人的简历文件元数据（文件已上传到 MinIO） */
  async saveResumeFileMeta(candidateId: number, meta: {
    fileName: string; fileType: string; fileSize: number; fileKey: string
  }): Promise<void> {
    await execute(`
      UPDATE candidates SET
        resume_file_name=?, resume_file_type=?, resume_file_size=?,
        resume_file_key=?, resume_uploaded_at=NOW()
      WHERE id=?`,
      [meta.fileName, meta.fileType, meta.fileSize, meta.fileKey, candidateId]
    )
  }

  /** 清除候选人简历文件元数据（文件从 MinIO 删除后调用） */
  async clearResumeFileMeta(candidateId: number): Promise<void> {
    await execute(`
      UPDATE candidates SET
        resume_file_name=NULL, resume_file_type=NULL, resume_file_size=NULL,
        resume_file_key=NULL, resume_uploaded_at=NULL
      WHERE id=?`, [candidateId]
    )
  }

  /** 获取候选人简历 MinIO key */
  async getResumeFileKey(candidateId: number): Promise<string | undefined> {
    const row = await queryOne<any>('SELECT resume_file_key FROM candidates WHERE id=?', [candidateId])
    return row?.resume_file_key || undefined
  }

  // ==========================================
  // 统计数据
  // ==========================================
  async getStatistics() {
    const total = ((await queryOne<any>('SELECT COUNT(*) as c FROM candidates'))?.c || 0) as number

    const byStatus: Record<string, number> = {}
    for (const r of await query<any>('SELECT candidate_status, COUNT(*) as c FROM candidates GROUP BY candidate_status')) {
      byStatus[r.candidate_status || 'active'] = r.c
    }
    const byEducation: Record<string, number> = {}
    for (const r of await query<any>('SELECT highest_education, COUNT(*) as c FROM candidates GROUP BY highest_education')) {
      byEducation[r.highest_education || '未知'] = r.c
    }
    const byChannel: Record<string, number> = {}
    for (const r of await query<any>('SELECT source_channel, COUNT(*) as c FROM candidates GROUP BY source_channel')) {
      byChannel[r.source_channel || '其他'] = r.c
    }
    const byExperience: Record<string, number> = { '0-2年': 0, '2-5年': 0, '5-10年': 0, '10年+': 0 }
    for (const r of await query<any>('SELECT years_of_experience FROM candidates')) {
      const exp = r.years_of_experience || 0
      if (exp < 2) byExperience['0-2年']++
      else if (exp < 5) byExperience['2-5年']++
      else if (exp < 10) byExperience['5-10年']++
      else byExperience['10年+']++
    }
    const topSkills = (await query<any>('SELECT skill_name, COUNT(*) as c FROM skills GROUP BY skill_name ORDER BY c DESC LIMIT 10')).map(r => ({ name: r.skill_name, count: r.c }))
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    const recentAdded = ((await queryOne<any>('SELECT COUNT(*) as c FROM candidates WHERE created_at >= ?', [thirtyDaysAgo]))?.c || 0) as number
    const avgRow = await queryOne<any>('SELECT AVG(match_score) as avg FROM candidates')
    const avgMatchScore = avgRow?.avg ? Math.round(avgRow.avg * 10) / 10 : 0

    return { total, recentAdded, byStatus, byEducation, byChannel, byExperience, topSkills, avgMatchScore }
  }

  // ==========================================
  // 初始化超级管理员（启动时自动执行）
  // ==========================================
  async initSuperAdmin(): Promise<void> {
    try {
      // 检查 system_users 表是否存在
      const tables = await query<any>(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_users'"
      )
      if (tables.length === 0) {
        console.log('[DB] system_users 表不存在，请先执行 sql/init_admin.sql')
        return
      }

      // 检查是否已有管理员
      const count = await queryOne<any>('SELECT COUNT(*) as c FROM system_users WHERE role=?', ['admin'])
      if (count && count.c > 0) {
        console.log(`[DB] 管理员账号已存在 (${count.c} 个)，跳过初始化`)
        return
      }

      // 动态 import crypto（避免循环依赖）
      const { randomBytes, pbkdf2Sync } = await import('crypto')
      const ITERATIONS = 100000
      const KEYLEN = 64
      const DIGEST = 'sha512'
      const PREFIX = '$pbkdf2$'
      const plain = 'Admin@2024'
      const salt = randomBytes(16).toString('hex')
      const hash = pbkdf2Sync(plain, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex')
      const hashedPwd = `${PREFIX}${salt}$${hash}`

      await execute(
        `INSERT IGNORE INTO system_users (id,username,real_name,email,phone,role,department,status,password)
         VALUES (1,?,?,?,?,?,?,?,?)`,
        ['admin', '系统管理员', 'admin@company.com', '13800000001', 'admin', '技术部', 'active', hashedPwd]
      )
      console.log('[DB] ✅ 超级管理员已创建 | 用户名: admin | 初始密码: Admin@2024 | 请登录后立即修改！')
    } catch (e: any) {
      // 表不存在时优雅降级，不阻塞启动
      if (e.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[DB] system_users 表不存在，请执行 sql/init_admin.sql 创建表并初始化数据')
      } else {
        console.error('[DB] initSuperAdmin 失败:', e.message)
      }
    }
  }
}

export const db = new MySQLDatabase()

// 服务启动后异步初始化超级管理员（延迟2秒，等连接池就绪）
setTimeout(() => {
  db.initSuperAdmin().catch(e => console.error('[DB] 初始化超级管理员异常:', e.message))
}, 2000)
