import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { pbkdf2Sync, randomBytes } from "crypto";
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "resume_db",
  charset: "utf8mb4",
  timezone: "+08:00",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0];
}
async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}
function rowToCandidate(row) {
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
    resumeFileKey: row.resume_file_key,
    // MinIO 对象 key
    resumeUploadedAt: row.resume_uploaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rowToEducation(r) {
  return { id: r.id, candidateId: r.candidate_id, schoolName: r.school_name, degree: r.degree, major: r.major, startDate: r.start_date, endDate: r.end_date, gpa: r.gpa, description: r.description, is985: !!r.is_985, is211: !!r.is_211, isOverseas: !!r.is_overseas, sortOrder: r.sort_order };
}
function rowToWorkExp(r) {
  return { id: r.id, candidateId: r.candidate_id, companyName: r.company_name, companySize: r.company_size, companyType: r.company_type, industry: r.industry, position: r.position, jobLevel: r.job_level, department: r.department, startDate: r.start_date, endDate: r.end_date, isCurrent: !!r.is_current, salary: r.salary, description: r.description, achievements: r.achievements, sortOrder: r.sort_order };
}
function rowToSkill(r) {
  return { id: r.id, candidateId: r.candidate_id, skillName: r.skill_name, proficiency: r.proficiency, yearsUsed: r.years_used, category: r.category };
}
function rowToTag(r) {
  return { id: r.id, candidateId: r.candidate_id, tagName: r.tag_name, tagType: r.tag_type, tagSource: r.tag_source, confidence: r.confidence };
}
function rowToProject(r) {
  return { id: r.id, candidateId: r.candidate_id, projectName: r.project_name, role: r.role, startDate: r.start_date, endDate: r.end_date, techStack: r.tech_stack, description: r.description, achievements: r.achievements, projectUrl: r.project_url, sortOrder: r.sort_order };
}
function rowToCertification(r) {
  return { id: r.id, candidateId: r.candidate_id, certName: r.cert_name, issuingOrg: r.issuing_org, issueDate: r.issue_date, certType: r.cert_type, description: r.description };
}
function rowToInterview(r) {
  return { id: r.id, candidateId: r.candidate_id, interviewType: r.interview_type, interviewRound: r.interview_round, interviewDate: r.interview_date, interviewer: r.interviewer, result: r.result, score: r.score, feedback: r.feedback, nextStep: r.next_step, createdAt: r.created_at };
}
function rowToUser(r, includePassword = false) {
  const u = { id: r.id, username: r.username, realName: r.real_name, email: r.email, phone: r.phone, role: r.role, department: r.department, status: r.status, avatar: r.avatar, lastLoginAt: r.last_login_at, createdAt: r.created_at, updatedAt: r.updated_at };
  if (includePassword) u.password = r.password;
  return u;
}
class MySQLDatabase {
  // ==========================================
  // 用户管理
  // ==========================================
  async getUsers(params = {}) {
    const wheres = ["1=1"];
    const args = [];
    if (params.keyword) {
      wheres.push("(username LIKE ? OR real_name LIKE ? OR email LIKE ? OR department LIKE ?)");
      const kw = `%${params.keyword}%`;
      args.push(kw, kw, kw, kw);
    }
    if (params.role) {
      wheres.push("role = ?");
      args.push(params.role);
    }
    if (params.status) {
      wheres.push("status = ?");
      args.push(params.status);
    }
    const where = wheres.join(" AND ");
    const total = (await queryOne(`SELECT COUNT(*) as c FROM system_users WHERE ${where}`, args))?.c || 0;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const rows = await query(`SELECT * FROM system_users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...args, pageSize, offset]);
    return { list: rows.map((r) => rowToUser(r)), total };
  }
  async getUserById(id) {
    const row = await queryOne("SELECT * FROM system_users WHERE id=?", [id]);
    return row ? rowToUser(row) : void 0;
  }
  async getUserByUsername(username) {
    const row = await queryOne("SELECT * FROM system_users WHERE username=?", [username]);
    return row ? rowToUser(row, true) : void 0;
  }
  async createUser(data) {
    const dup = await queryOne("SELECT id FROM system_users WHERE username=?", [data.username]);
    if (dup) return { error: `登录名 "${data.username}" 已存在` };
    const emailDup = await queryOne("SELECT id FROM system_users WHERE email=?", [data.email]);
    if (emailDup) return { error: `邮箱 "${data.email}" 已被使用` };
    const result = await execute(
      "INSERT INTO system_users (username,real_name,email,phone,role,department,status,password) VALUES (?,?,?,?,?,?,?,?)",
      [data.username, data.realName, data.email, data.phone || null, data.role, data.department || null, data.status || "active", data.password || null]
    );
    return { user: await this.getUserById(result.insertId) };
  }
  async updateUser(id, data) {
    const existing = await queryOne("SELECT * FROM system_users WHERE id=?", [id]);
    if (!existing) return { error: "用户不存在" };
    if (data.username && data.username !== existing.username) {
      const dup = await queryOne("SELECT id FROM system_users WHERE username=? AND id!=?", [data.username, id]);
      if (dup) return { error: `登录名 "${data.username}" 已存在` };
    }
    if (data.email && data.email !== existing.email) {
      const dup = await queryOne("SELECT id FROM system_users WHERE email=? AND id!=?", [data.email, id]);
      if (dup) return { error: `邮箱 "${data.email}" 已被使用` };
    }
    await execute(
      `
      UPDATE system_users SET
        username=COALESCE(?,username), real_name=COALESCE(?,real_name),
        email=COALESCE(?,email), phone=COALESCE(?,phone),
        role=COALESCE(?,role), department=COALESCE(?,department),
        status=COALESCE(?,status), password=COALESCE(?,password)
      WHERE id=?`,
      [
        data.username || null,
        data.realName || null,
        data.email || null,
        data.phone || null,
        data.role || null,
        data.department || null,
        data.status || null,
        data.password || null,
        id
      ]
    );
    return { user: await this.getUserById(id) };
  }
  async toggleUserStatus(id) {
    const u = await queryOne("SELECT status FROM system_users WHERE id=?", [id]);
    if (!u) return { error: "用户不存在" };
    return this.updateUser(id, { status: u.status === "active" ? "disabled" : "active" });
  }
  async deleteUser(id) {
    const r = await execute("DELETE FROM system_users WHERE id=?", [id]);
    return r.affectedRows > 0;
  }
  async getUserCount() {
    return (await queryOne("SELECT COUNT(*) as c FROM system_users"))?.c || 0;
  }
  async updateLastLogin(id) {
    await execute("UPDATE system_users SET last_login_at=NOW() WHERE id=?", [id]);
  }
  // ==========================================
  // 候选人列表（多条件过滤）
  // ==========================================
  async getCandidates(params = {}) {
    const wheres = ["1=1"];
    const args = [];
    const joins = [];
    if (params.keyword) {
      wheres.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.expected_position LIKE ? OR c.self_evaluation LIKE ? OR c.location LIKE ? OR c.hr_notes LIKE ?)");
      const kw = `%${params.keyword}%`;
      args.push(kw, kw, kw, kw, kw, kw, kw);
    }
    if (params.name) {
      wheres.push("c.name LIKE ?");
      args.push(`%${params.name}%`);
    }
    if (params.phone) {
      wheres.push("c.phone LIKE ?");
      args.push(`%${params.phone}%`);
    }
    if (params.email) {
      wheres.push("c.email LIKE ?");
      args.push(`%${params.email}%`);
    }
    if (params.gender) {
      wheres.push("c.gender = ?");
      args.push(params.gender);
    }
    if (params.minAge) {
      wheres.push("c.age >= ?");
      args.push(Number(params.minAge));
    }
    if (params.maxAge) {
      wheres.push("c.age <= ?");
      args.push(Number(params.maxAge));
    }
    if (params.location) {
      wheres.push("c.location LIKE ?");
      args.push(`%${params.location}%`);
    }
    if (params.expectedPosition) {
      wheres.push("c.expected_position LIKE ?");
      args.push(`%${params.expectedPosition}%`);
    }
    if (params.expectedCity) {
      wheres.push("c.expected_city LIKE ?");
      args.push(`%${params.expectedCity}%`);
    }
    if (params.currentStatus) {
      wheres.push("c.current_status = ?");
      args.push(params.currentStatus);
    }
    if (params.candidateStatus) {
      wheres.push("c.candidate_status = ?");
      args.push(params.candidateStatus);
    }
    if (params.highestEducation) {
      wheres.push("c.highest_education = ?");
      args.push(params.highestEducation);
    }
    if (params.sourceChannel) {
      wheres.push("c.source_channel = ?");
      args.push(params.sourceChannel);
    }
    if (params.minExperience !== void 0 && params.minExperience !== "") {
      wheres.push("c.years_of_experience >= ?");
      args.push(Number(params.minExperience));
    }
    if (params.maxExperience !== void 0 && params.maxExperience !== "") {
      wheres.push("c.years_of_experience <= ?");
      args.push(Number(params.maxExperience));
    }
    if (params.minSalary !== void 0 && params.minSalary !== "") {
      wheres.push("c.expected_salary_max >= ?");
      args.push(Number(params.minSalary));
    }
    if (params.maxSalary !== void 0 && params.maxSalary !== "") {
      wheres.push("c.expected_salary_min <= ?");
      args.push(Number(params.maxSalary));
    }
    if (params.minMatchScore !== void 0 && params.minMatchScore !== "") {
      wheres.push("c.match_score >= ?");
      args.push(Number(params.minMatchScore));
    }
    if (params.isBlacklist !== void 0 && params.isBlacklist !== "") {
      wheres.push("c.is_blacklist = ?");
      args.push(params.isBlacklist === "true" || params.isBlacklist === true ? 1 : 0);
    }
    if (params.hrNotesKeyword) {
      wheres.push("c.hr_notes LIKE ?");
      args.push(`%${params.hrNotesKeyword}%`);
    }
    if (params.hasResume === "true" || params.hasResume === true) {
      wheres.push("c.resume_file_key IS NOT NULL");
    } else if (params.hasResume === "false" || params.hasResume === false) {
      wheres.push("c.resume_file_key IS NULL");
    }
    if (params.skillKeyword) {
      const skillKws = params.skillKeyword.split(",").map((s) => s.trim()).filter(Boolean);
      skillKws.forEach((kw) => {
        wheres.push("EXISTS (SELECT 1 FROM skills sk WHERE sk.candidate_id=c.id AND sk.skill_name LIKE ?)");
        args.push(`%${kw}%`);
      });
    }
    if (params.companyKeyword) {
      wheres.push("EXISTS (SELECT 1 FROM work_experiences we WHERE we.candidate_id=c.id AND we.company_name LIKE ?)");
      args.push(`%${params.companyKeyword}%`);
    }
    if (params.industryKeyword) {
      wheres.push("EXISTS (SELECT 1 FROM work_experiences we WHERE we.candidate_id=c.id AND we.industry LIKE ?)");
      args.push(`%${params.industryKeyword}%`);
    }
    if (params.schoolKeyword) {
      wheres.push("EXISTS (SELECT 1 FROM educations ed WHERE ed.candidate_id=c.id AND ed.school_name LIKE ?)");
      args.push(`%${params.schoolKeyword}%`);
    }
    if (params.majorKeyword) {
      wheres.push("EXISTS (SELECT 1 FROM educations ed WHERE ed.candidate_id=c.id AND ed.major LIKE ?)");
      args.push(`%${params.majorKeyword}%`);
    }
    const where = wheres.join(" AND ");
    const sortMap = {
      createdAt: "c.created_at",
      matchScore: "c.match_score",
      yearsOfExperience: "c.years_of_experience",
      name: "c.name",
      age: "c.age"
    };
    const sortCol = sortMap[params.sortBy] || "c.created_at";
    const sortDir = (params.sortOrder || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
    const total = (await queryOne(`SELECT COUNT(*) as c FROM candidates c ${joins.join(" ")} WHERE ${where}`, args))?.c || 0;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const rows = await query(
      `SELECT c.* FROM candidates c ${joins.join(" ")} WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
      [...args, pageSize, offset]
    );
    const list = [];
    for (const row of rows) {
      const c = rowToCandidate(row);
      c.tags = (await query("SELECT * FROM candidate_tags WHERE candidate_id=?", [c.id])).map(rowToTag);
      c.skills = (await query("SELECT * FROM skills WHERE candidate_id=?", [c.id])).map(rowToSkill);
      list.push(c);
    }
    return { list, total };
  }
  async getCandidateById(id) {
    const row = await queryOne("SELECT * FROM candidates WHERE id=?", [id]);
    if (!row) return void 0;
    const c = rowToCandidate(row);
    c.educations = (await query("SELECT * FROM educations WHERE candidate_id=? ORDER BY sort_order", [id])).map(rowToEducation);
    c.workExperiences = (await query("SELECT * FROM work_experiences WHERE candidate_id=? ORDER BY sort_order", [id])).map(rowToWorkExp);
    c.projects = (await query("SELECT * FROM projects WHERE candidate_id=? ORDER BY sort_order", [id])).map(rowToProject);
    c.skills = (await query("SELECT * FROM skills WHERE candidate_id=?", [id])).map(rowToSkill);
    c.certifications = (await query("SELECT * FROM certifications WHERE candidate_id=?", [id])).map(rowToCertification);
    c.tags = (await query("SELECT * FROM candidate_tags WHERE candidate_id=?", [id])).map(rowToTag);
    c.interviewRecords = (await query("SELECT * FROM interview_records WHERE candidate_id=? ORDER BY created_at DESC", [id])).map(rowToInterview);
    return c;
  }
  async createCandidate(data) {
    const result = await execute(
      `
      INSERT INTO candidates (name,gender,age,birth_date,phone,email,location,hometown,
        avatar_url,current_status,years_of_experience,highest_education,
        expected_salary_min,expected_salary_max,expected_position,expected_city,
        self_evaluation,linkedin_url,github_url,portfolio_url,source_channel,
        candidate_status,is_blacklist,hr_notes,match_score,raw_resume_text)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.name,
        data.gender || null,
        data.age || null,
        data.birthDate || null,
        data.phone || null,
        data.email || null,
        data.location || null,
        data.hometown || null,
        data.avatarUrl || null,
        data.currentStatus || null,
        data.yearsOfExperience || null,
        data.highestEducation || null,
        data.expectedSalaryMin || null,
        data.expectedSalaryMax || null,
        data.expectedPosition || null,
        data.expectedCity || null,
        data.selfEvaluation || null,
        data.linkedinUrl || null,
        data.githubUrl || null,
        data.portfolioUrl || null,
        data.sourceChannel || null,
        data.candidateStatus || "active",
        data.isBlacklist ? 1 : 0,
        data.hrNotes || null,
        data.matchScore || null,
        data.rawResumeText || null
      ]
    );
    const id = result.insertId;
    if (data.educations?.length) await this._saveEducations(id, data.educations);
    if (data.workExperiences?.length) await this._saveWorkExperiences(id, data.workExperiences);
    if (data.projects?.length) await this._saveProjects(id, data.projects);
    if (data.skills?.length) await this._saveSkills(id, data.skills);
    if (data.certifications?.length) await this._saveCertifications(id, data.certifications);
    if (data.tags?.length) await this._saveTags(id, data.tags);
    return await this.getCandidateById(id);
  }
  async updateCandidate(id, data) {
    const existing = await queryOne("SELECT id FROM candidates WHERE id=?", [id]);
    if (!existing) return void 0;
    await execute(
      `
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
      [
        data.name || null,
        data.gender || null,
        data.age || null,
        data.phone || null,
        data.email || null,
        data.location || null,
        data.hometown || null,
        data.currentStatus || null,
        data.yearsOfExperience || null,
        data.highestEducation || null,
        data.expectedSalaryMin || null,
        data.expectedSalaryMax || null,
        data.expectedPosition || null,
        data.expectedCity || null,
        data.selfEvaluation || null,
        data.sourceChannel || null,
        data.candidateStatus || null,
        data.isBlacklist !== void 0 ? data.isBlacklist ? 1 : 0 : null,
        data.hrNotes || null,
        data.matchScore || null,
        data.rawResumeText || null,
        id
      ]
    );
    if (data.educations !== void 0) {
      await execute("DELETE FROM educations WHERE candidate_id=?", [id]);
      await this._saveEducations(id, data.educations);
    }
    if (data.workExperiences !== void 0) {
      await execute("DELETE FROM work_experiences WHERE candidate_id=?", [id]);
      await this._saveWorkExperiences(id, data.workExperiences);
    }
    if (data.skills !== void 0) {
      await execute("DELETE FROM skills WHERE candidate_id=?", [id]);
      await this._saveSkills(id, data.skills);
    }
    if (data.tags !== void 0) {
      await execute("DELETE FROM candidate_tags WHERE candidate_id=?", [id]);
      await this._saveTags(id, data.tags);
    }
    return this.getCandidateById(id);
  }
  async deleteCandidate(id) {
    const r = await execute("DELETE FROM candidates WHERE id=?", [id]);
    return r.affectedRows > 0;
  }
  // ==========================================
  // 关联数据写入
  // ==========================================
  async _saveEducations(cid, items) {
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      await execute(
        "INSERT INTO educations (candidate_id,school_name,degree,major,start_date,end_date,gpa,description,is_985,is_211,is_overseas,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [cid, e.schoolName, e.degree, e.major || null, e.startDate || null, e.endDate || null, e.gpa || null, e.description || null, e.is985 ? 1 : 0, e.is211 ? 1 : 0, e.isOverseas ? 1 : 0, i]
      );
    }
  }
  async _saveWorkExperiences(cid, items) {
    for (let i = 0; i < items.length; i++) {
      const w = items[i];
      await execute(
        "INSERT INTO work_experiences (candidate_id,company_name,company_size,company_type,industry,position,job_level,department,start_date,end_date,is_current,salary,description,achievements,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [cid, w.companyName, w.companySize || null, w.companyType || null, w.industry || null, w.position, w.jobLevel || null, w.department || null, w.startDate || null, w.endDate || null, w.isCurrent ? 1 : 0, w.salary || null, w.description || null, w.achievements || null, i]
      );
    }
  }
  async _saveProjects(cid, items) {
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      await execute(
        "INSERT INTO projects (candidate_id,project_name,role,start_date,end_date,tech_stack,description,achievements,project_url,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [cid, p.projectName, p.role || null, p.startDate || null, p.endDate || null, p.techStack || null, p.description || null, p.achievements || null, p.projectUrl || null, i]
      );
    }
  }
  async _saveSkills(cid, items) {
    for (const s of items) {
      await execute(
        "INSERT INTO skills (candidate_id,skill_name,proficiency,years_used,category) VALUES (?,?,?,?,?)",
        [cid, s.skillName, s.proficiency || null, s.yearsUsed || null, s.category || null]
      );
    }
  }
  async _saveCertifications(cid, items) {
    for (const c of items) {
      await execute(
        "INSERT INTO certifications (candidate_id,cert_name,issuing_org,issue_date,cert_type,description) VALUES (?,?,?,?,?,?)",
        [cid, c.certName, c.issuingOrg || null, c.issueDate || null, c.certType || null, c.description || null]
      );
    }
  }
  async _saveTags(cid, items) {
    for (const t of items) {
      await execute(
        "INSERT INTO candidate_tags (candidate_id,tag_name,tag_type,tag_source,confidence) VALUES (?,?,?,?,?)",
        [cid, t.tagName, t.tagType || null, t.tagSource || null, t.confidence || null]
      );
    }
  }
  // ==========================================
  // 面试记录
  // ==========================================
  async addInterviewRecord(candidateId, data) {
    const result = await execute(
      "INSERT INTO interview_records (candidate_id,interview_type,interview_round,interview_date,interviewer,result,score,feedback,next_step) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        candidateId,
        data.interviewType || null,
        data.interviewRound || null,
        data.interviewDate || null,
        data.interviewer || null,
        data.result || null,
        data.score || null,
        data.feedback || null,
        data.nextStep || null
      ]
    );
    return { ...data, id: result.insertId, candidateId, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  // ==========================================
  // 解析任务
  // ==========================================
  async createParseTask(data) {
    const result = await execute(
      "INSERT INTO parse_tasks (candidate_id,file_name,file_url,file_type,status) VALUES (?,?,?,?,?)",
      [data.candidateId || null, data.fileName, data.fileUrl || null, data.fileType || null, data.status || "pending"]
    );
    return { ...data, id: result.insertId, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  async updateParseTask(id, data) {
    await execute(
      "UPDATE parse_tasks SET status=COALESCE(?,status), parse_result=COALESCE(?,parse_result), error_msg=COALESCE(?,error_msg), candidate_id=COALESCE(?,candidate_id) WHERE id=?",
      [data.status || null, data.parseResult || null, data.errorMsg || null, data.candidateId || null, id]
    );
  }
  async getParseTask(id) {
    const r = await queryOne("SELECT * FROM parse_tasks WHERE id=?", [id]);
    if (!r) return void 0;
    return { id: r.id, candidateId: r.candidate_id, fileName: r.file_name, fileUrl: r.file_url, fileType: r.file_type, status: r.status, parseResult: r.parse_result, errorMsg: r.error_msg, createdAt: r.created_at, updatedAt: r.updated_at };
  }
  // ==========================================
  // 简历文件元数据（文件本身存 MinIO）
  // ==========================================
  /** 更新候选人的简历文件元数据（文件已上传到 MinIO） */
  async saveResumeFileMeta(candidateId, meta) {
    await execute(
      `
      UPDATE candidates SET
        resume_file_name=?, resume_file_type=?, resume_file_size=?,
        resume_file_key=?, resume_uploaded_at=NOW()
      WHERE id=?`,
      [meta.fileName, meta.fileType, meta.fileSize, meta.fileKey, candidateId]
    );
  }
  /** 清除候选人简历文件元数据（文件从 MinIO 删除后调用） */
  async clearResumeFileMeta(candidateId) {
    await execute(
      `
      UPDATE candidates SET
        resume_file_name=NULL, resume_file_type=NULL, resume_file_size=NULL,
        resume_file_key=NULL, resume_uploaded_at=NULL
      WHERE id=?`,
      [candidateId]
    );
  }
  /** 获取候选人简历 MinIO key */
  async getResumeFileKey(candidateId) {
    const row = await queryOne("SELECT resume_file_key FROM candidates WHERE id=?", [candidateId]);
    return row?.resume_file_key || void 0;
  }
  // ==========================================
  // 统计数据
  // ==========================================
  async getStatistics() {
    const total = (await queryOne("SELECT COUNT(*) as c FROM candidates"))?.c || 0;
    const byStatus = {};
    for (const r of await query("SELECT candidate_status, COUNT(*) as c FROM candidates GROUP BY candidate_status")) {
      byStatus[r.candidate_status || "active"] = r.c;
    }
    const byEducation = {};
    for (const r of await query("SELECT highest_education, COUNT(*) as c FROM candidates GROUP BY highest_education")) {
      byEducation[r.highest_education || "未知"] = r.c;
    }
    const byChannel = {};
    for (const r of await query("SELECT source_channel, COUNT(*) as c FROM candidates GROUP BY source_channel")) {
      byChannel[r.source_channel || "其他"] = r.c;
    }
    const byExperience = { "0-2年": 0, "2-5年": 0, "5-10年": 0, "10年+": 0 };
    for (const r of await query("SELECT years_of_experience FROM candidates")) {
      const exp = r.years_of_experience || 0;
      if (exp < 2) byExperience["0-2年"]++;
      else if (exp < 5) byExperience["2-5年"]++;
      else if (exp < 10) byExperience["5-10年"]++;
      else byExperience["10年+"]++;
    }
    const topSkills = (await query("SELECT skill_name, COUNT(*) as c FROM skills GROUP BY skill_name ORDER BY c DESC LIMIT 10")).map((r) => ({ name: r.skill_name, count: r.c }));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().slice(0, 19).replace("T", " ");
    const recentAdded = (await queryOne("SELECT COUNT(*) as c FROM candidates WHERE created_at >= ?", [thirtyDaysAgo]))?.c || 0;
    const avgRow = await queryOne("SELECT AVG(match_score) as avg FROM candidates");
    const avgMatchScore = avgRow?.avg ? Math.round(avgRow.avg * 10) / 10 : 0;
    return { total, recentAdded, byStatus, byEducation, byChannel, byExperience, topSkills, avgMatchScore };
  }
  // ==========================================
  // 初始化超级管理员（启动时自动执行）
  // ==========================================
  async initSuperAdmin() {
    try {
      const tables = await query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_users'"
      );
      if (tables.length === 0) {
        console.log("[DB] system_users 表不存在，请先执行 sql/init_admin.sql");
        return;
      }
      const count = await queryOne("SELECT COUNT(*) as c FROM system_users WHERE role=?", ["admin"]);
      if (count && count.c > 0) {
        console.log(`[DB] 管理员账号已存在 (${count.c} 个)，跳过初始化`);
        return;
      }
      const { randomBytes: randomBytes2, pbkdf2Sync: pbkdf2Sync2 } = await import("crypto");
      const ITERATIONS2 = 1e5;
      const KEYLEN2 = 64;
      const DIGEST2 = "sha512";
      const PREFIX2 = "$pbkdf2$";
      const plain = "Admin@2024";
      const salt = randomBytes2(16).toString("hex");
      const hash = pbkdf2Sync2(plain, salt, ITERATIONS2, KEYLEN2, DIGEST2).toString("hex");
      const hashedPwd = `${PREFIX2}${salt}$${hash}`;
      await execute(
        `INSERT IGNORE INTO system_users (id,username,real_name,email,phone,role,department,status,password)
         VALUES (1,?,?,?,?,?,?,?,?)`,
        ["admin", "系统管理员", "admin@company.com", "13800000001", "admin", "技术部", "active", hashedPwd]
      );
      console.log("[DB] ✅ 超级管理员已创建 | 用户名: admin | 初始密码: Admin@2024 | 请登录后立即修改！");
    } catch (e) {
      if (e.code === "ER_NO_SUCH_TABLE") {
        console.warn("[DB] system_users 表不存在，请执行 sql/init_admin.sql 创建表并初始化数据");
      } else {
        console.error("[DB] initSuperAdmin 失败:", e.message);
      }
    }
  }
}
const db = new MySQLDatabase();
setTimeout(() => {
  db.initSuperAdmin().catch((e) => console.error("[DB] 初始化超级管理员异常:", e.message));
}, 2e3);
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(process.cwd(), "uploads");
const RESUMES_DIR = path.join(UPLOAD_DIR, "resumes");
if (!fs.existsSync(RESUMES_DIR)) {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
  console.log(`📁 创建文件存储目录: ${RESUMES_DIR}`);
}
function generateFileKey(candidateId, fileName) {
  const ts = Date.now();
  const safeName = fileName.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
  return path.join("resumes", String(candidateId), `${ts}-${safeName}`);
}
function keyToAbsPath(key) {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(UPLOAD_DIR, normalized);
}
async function uploadFile(key, buffer, _mimeType) {
  const absPath = keyToAbsPath(key);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  await fs.promises.writeFile(absPath, buffer);
}
async function getFileBuffer(key) {
  const absPath = keyToAbsPath(key);
  if (!fs.existsSync(absPath)) {
    throw new Error(`文件不存在: ${key}`);
  }
  return fs.promises.readFile(absPath);
}
async function deleteFile(key) {
  const absPath = keyToAbsPath(key);
  if (fs.existsSync(absPath)) {
    await fs.promises.unlink(absPath);
    const dir = path.dirname(absPath);
    const remaining = fs.readdirSync(dir);
    if (remaining.length === 0) {
      fs.rmdirSync(dir);
    }
  }
}
function getFileStat(key) {
  const absPath = keyToAbsPath(key);
  if (!fs.existsSync(absPath)) return void 0;
  const stat = fs.statSync(absPath);
  return { size: stat.size, mtime: stat.mtime };
}
const candidates = new Hono();
candidates.get("/", async (c) => {
  try {
    const q = c.req.query();
    const { list, total } = await db.getCandidates({
      ...q,
      page: q.page ? parseInt(q.page) : 1,
      pageSize: q.pageSize ? parseInt(q.pageSize) : 10,
      minExperience: q.minExperience ? parseFloat(q.minExperience) : void 0,
      maxExperience: q.maxExperience ? parseFloat(q.maxExperience) : void 0,
      minAge: q.minAge ? parseInt(q.minAge) : void 0,
      maxAge: q.maxAge ? parseInt(q.maxAge) : void 0,
      minSalary: q.minSalary ? parseInt(q.minSalary) : void 0,
      maxSalary: q.maxSalary ? parseInt(q.maxSalary) : void 0,
      minMatchScore: q.minMatchScore ? parseFloat(q.minMatchScore) : void 0,
      isBlacklist: q.isBlacklist === "true" ? true : q.isBlacklist === "false" ? false : void 0
    });
    return c.json({
      success: true,
      data: list,
      total,
      page: parseInt(q.page || "1"),
      pageSize: parseInt(q.pageSize || "10")
    });
  } catch (e) {
    console.error("[GET /candidates] DB error:", e.message);
    return c.json({ success: false, message: `数据库查询失败: ${e.message}`, data: [], total: 0 }, 500);
  }
});
candidates.get("/stats/overview", async (c) => {
  try {
    const stats = await db.getStatistics();
    return c.json({ success: true, data: stats });
  } catch (e) {
    console.error("[GET /stats/overview] DB error:", e.message);
    return c.json({
      success: false,
      message: `统计数据查询失败: ${e.message}`,
      data: {
        total: 0,
        recentAdded: 0,
        avgMatchScore: 0,
        byStatus: {},
        byEducation: {},
        byChannel: {},
        byExperience: {},
        topSkills: []
      }
    }, 500);
  }
});
candidates.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (isNaN(id)) return c.json({ success: false, message: "无效的ID" }, 400);
    const candidate = await db.getCandidateById(id);
    if (!candidate) return c.json({ success: false, message: "候选人不存在" }, 404);
    return c.json({ success: true, data: candidate });
  } catch (e) {
    return c.json({ success: false, message: `查询失败: ${e.message}` }, 500);
  }
});
candidates.post("/", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name?.trim()) return c.json({ success: false, message: "姓名不能为空" }, 400);
    const candidate = await db.createCandidate(body);
    return c.json({ success: true, data: candidate, message: "候选人创建成功" }, 201);
  } catch (e) {
    return c.json({ success: false, message: `创建失败: ${e.message}` }, 500);
  }
});
candidates.put("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const updated = await db.updateCandidate(id, body);
    if (!updated) return c.json({ success: false, message: "候选人不存在" }, 404);
    return c.json({ success: true, data: updated, message: "更新成功" });
  } catch (e) {
    return c.json({ success: false, message: `更新失败: ${e.message}` }, 500);
  }
});
candidates.patch("/:id/status", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const { candidateStatus } = await c.req.json();
    const validStatuses = ["active", "interviewing", "hired", "rejected", "blacklist", "archived"];
    if (!validStatuses.includes(candidateStatus))
      return c.json({ success: false, message: "无效的状态值" }, 400);
    const updated = await db.updateCandidate(id, {
      candidateStatus,
      isBlacklist: candidateStatus === "blacklist"
    });
    if (!updated) return c.json({ success: false, message: "候选人不存在" }, 404);
    return c.json({ success: true, data: updated, message: "状态更新成功" });
  } catch (e) {
    return c.json({ success: false, message: `状态更新失败: ${e.message}` }, 500);
  }
});
candidates.patch("/:id/notes", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const { hrNotes } = await c.req.json();
    const updated = await db.updateCandidate(id, { hrNotes });
    if (!updated) return c.json({ success: false, message: "候选人不存在" }, 404);
    return c.json({ success: true, message: "备注更新成功" });
  } catch (e) {
    return c.json({ success: false, message: `备注更新失败: ${e.message}` }, 500);
  }
});
candidates.delete("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const fileKey = await db.getResumeFileKey(id);
    if (fileKey) {
      try {
        await deleteFile(fileKey);
      } catch {
      }
    }
    const deleted = await db.deleteCandidate(id);
    if (!deleted) return c.json({ success: false, message: "候选人不存在" }, 404);
    return c.json({ success: true, message: "删除成功" });
  } catch (e) {
    return c.json({ success: false, message: `删除失败: ${e.message}` }, 500);
  }
});
candidates.post("/:id/interviews", async (c) => {
  try {
    const candidateId = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const record = await db.addInterviewRecord(candidateId, { ...body, candidateId });
    return c.json({ success: true, data: record, message: "面试记录添加成功" }, 201);
  } catch (e) {
    return c.json({ success: false, message: `添加失败: ${e.message}` }, 500);
  }
});
candidates.get("/:id/resume/info", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const candidate = await db.getCandidateById(id);
    if (!candidate) return c.json({ success: false, message: "候选人不存在" }, 404);
    if (!candidate.resumeFileKey) {
      return c.json({ success: true, hasFile: false, message: "暂无简历文件" });
    }
    const stat = getFileStat(candidate.resumeFileKey);
    return c.json({
      success: true,
      hasFile: true,
      data: {
        fileName: candidate.resumeFileName,
        fileType: candidate.resumeFileType,
        fileSize: stat?.size ?? candidate.resumeFileSize,
        uploadedAt: candidate.resumeUploadedAt,
        previewUrl: `/api/candidates/${id}/resume`,
        downloadUrl: `/api/candidates/${id}/resume?download=1`
      }
    });
  } catch (e) {
    return c.json({ success: false, message: `查询失败: ${e.message}` }, 500);
  }
});
candidates.get("/:id/resume", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const candidate = await db.getCandidateById(id);
    if (!candidate) return c.json({ success: false, message: "候选人不存在" }, 404);
    if (!candidate.resumeFileKey)
      return c.json({ success: false, message: "该候选人暂无上传的简历文件" }, 404);
    const download = c.req.query("download") === "1";
    const fileBuffer = await getFileBuffer(candidate.resumeFileKey);
    const mimeType = candidate.resumeFileType || "application/octet-stream";
    const safeFileName = encodeURIComponent(candidate.resumeFileName || "resume");
    const disposition = download ? `attachment; filename*=UTF-8''${safeFileName}` : `inline; filename*=UTF-8''${safeFileName}`;
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, no-cache"
      }
    });
  } catch (e) {
    return c.json({ success: false, message: `文件读取失败: ${e.message}` }, 500);
  }
});
candidates.post("/:id/resume", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const candidate = await db.getCandidateById(id);
    if (!candidate) return c.json({ success: false, message: "候选人不存在" }, 404);
    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!file) return c.json({ success: false, message: "请选择要上传的文件" }, 400);
    const allowedExts = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"];
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExts.includes(fileExt))
      return c.json({ success: false, message: "仅支持 PDF、Word、JPG、PNG 格式" }, 400);
    if (file.size > 20 * 1024 * 1024)
      return c.json({ success: false, message: "文件大小不能超过 20MB" }, 400);
    if (candidate.resumeFileKey) {
      try {
        await deleteFile(candidate.resumeFileKey);
      } catch {
      }
    }
    const fileKey = generateFileKey(id, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || `application/${fileExt}`;
    await uploadFile(fileKey, buffer, mimeType);
    await db.saveResumeFileMeta(id, {
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      fileKey
    });
    return c.json({
      success: true,
      message: "简历文件上传成功",
      data: {
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        previewUrl: `/api/candidates/${id}/resume`
      }
    });
  } catch (e) {
    return c.json({ success: false, message: `上传失败: ${e.message}` }, 500);
  }
});
candidates.delete("/:id/resume", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const fileKey = await db.getResumeFileKey(id);
    if (!fileKey) return c.json({ success: false, message: "文件不存在" }, 404);
    try {
      await deleteFile(fileKey);
    } catch {
    }
    await db.clearResumeFileMeta(id);
    return c.json({ success: true, message: "简历文件已删除" });
  } catch (e) {
    return c.json({ success: false, message: `删除失败: ${e.message}` }, 500);
  }
});
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
4. 请确保返回有效的JSON格式，不要包含任何额外的说明文字`;
function normalizeBaseUrl(url) {
  return (url || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
}
async function parseResumeWithAI(resumeText, apiKey, apiBaseUrl = "https://api.openai.com/v1") {
  const baseUrl = normalizeBaseUrl(apiBaseUrl);
  const truncatedText = resumeText.slice(0, 8e3);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PARSE_SYSTEM_PROMPT },
        { role: "user", content: `请解析以下简历内容：

${truncatedText}` }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API错误: ${response.status} - ${errText}`);
  }
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI返回内容为空");
  try {
    const parsed = JSON.parse(content);
    if (!parsed.tags) parsed.tags = [];
    if (parsed.educations) {
      parsed.educations.forEach((edu) => {
        if (edu.is985) parsed.tags.push({ tagName: "985高校", tagType: "education", tagSource: "ai", confidence: 100 });
        if (edu.is211 && !edu.is985) parsed.tags.push({ tagName: "211高校", tagType: "education", tagSource: "ai", confidence: 100 });
        if (edu.isOverseas) parsed.tags.push({ tagName: "海外留学", tagType: "education", tagSource: "ai", confidence: 100 });
      });
    }
    const bigCompanies = ["阿里", "腾讯", "百度", "字节", "美团", "京东", "华为", "网易", "滴滴", "拼多多", "小米", "Google", "Microsoft", "Amazon", "Meta", "Apple"];
    if (parsed.workExperiences) {
      parsed.workExperiences.forEach((exp) => {
        bigCompanies.forEach((company) => {
          if (exp.companyName?.includes(company)) {
            parsed.tags.push({ tagName: "大厂背景", tagType: "trait", tagSource: "ai", confidence: 100 });
          }
        });
      });
    }
    const tagSet = /* @__PURE__ */ new Set();
    parsed.tags = parsed.tags.filter((tag) => {
      if (tagSet.has(tag.tagName)) return false;
      tagSet.add(tag.tagName);
      return true;
    });
    return parsed;
  } catch (e) {
    throw new Error(`AI返回格式解析失败: ${e}`);
  }
}
function safeArrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
async function extractTextFromFile(fileContent, fileName, mimeType, apiKey, apiBaseUrl = "https://api.openai.com/v1") {
  apiBaseUrl = normalizeBaseUrl(apiBaseUrl);
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (["txt", "html", "htm"].includes(ext) || mimeType === "text/plain") {
    return new TextDecoder("utf-8", { fatal: false }).decode(fileContent);
  }
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
  const imageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
  if (imageExts.includes(ext) || imageMimes.includes(mimeType)) {
    return await extractWithVision(fileContent, mimeType || `image/${ext}`, apiKey, apiBaseUrl);
  }
  if (ext === "pdf" || mimeType === "application/pdf") {
    const extracted = extractTextFromPdfBinary(fileContent);
    const usableChars = (extracted.match(/[\u4e00-\u9fff]|[A-Za-z]{2,}/g) || []).length;
    if (usableChars >= 20) {
      return extracted;
    }
    return await extractWithVision(fileContent, "application/pdf", apiKey, apiBaseUrl);
  }
  if (["doc", "docx"].includes(ext)) {
    const extracted = extractTextFromDocxBinary(fileContent);
    const usableChars = (extracted.match(/[\u4e00-\u9fff]|[A-Za-z]{2,}/g) || []).length;
    if (usableChars >= 20) {
      return extracted;
    }
    const fallbackMime = ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword";
    return await extractWithVision(fileContent, fallbackMime, apiKey, apiBaseUrl);
  }
  const rawText = new TextDecoder("utf-8", { fatal: false }).decode(fileContent);
  return rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ").replace(/\s+/g, " ").trim();
}
function extractTextFromPdfBinary(buffer) {
  const raw = new TextDecoder("latin1").decode(buffer);
  const texts = [];
  const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let m;
  while ((m = tjRegex.exec(raw)) !== null) {
    const t = m[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
    texts.push(t);
  }
  const tjArrRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((m = tjArrRegex.exec(raw)) !== null) {
    const inner = m[1];
    const parts = inner.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || [];
    parts.forEach((p) => texts.push(p.slice(1, -1)));
  }
  if (texts.length === 0) return "";
  let result = texts.join(" ");
  try {
    const bytes = new Uint8Array(result.length);
    for (let i = 0; i < result.length; i++) bytes[i] = result.charCodeAt(i);
    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if ((utf8.match(/[\u4e00-\u9fff]/g) || []).length > 0) result = utf8;
  } catch {
  }
  return result.replace(/\s+/g, " ").trim();
}
function extractTextFromDocxBinary(buffer) {
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
  const texts = [];
  let m;
  while ((m = wtRegex.exec(raw)) !== null) {
    texts.push(m[1]);
  }
  if (texts.length > 0) return texts.join(" ").replace(/\s+/g, " ").trim();
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
async function extractWithVision(fileData, mimeType, apiKey, apiBaseUrl) {
  const base64 = safeArrayBufferToBase64(fileData);
  const isPdf = mimeType === "application/pdf" || mimeType.includes("pdf");
  const isWord = mimeType.includes("word") || mimeType.includes("document");
  if (isPdf || isWord) {
    const response2 = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "这是一份简历文件的base64内容。请从中提取所有可读的简历文字信息，包括姓名、联系方式、教育经历、工作经历、技能等，保持原有格式输出。如果无法识别，请返回空字符串。"
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            }
          ]
        }],
        max_tokens: 4e3
      })
    });
    if (!response2.ok) {
      const err = await response2.text();
      throw new Error(`OpenAI API错误: ${response2.status} - ${err}`);
    }
    const result2 = await response2.json();
    return result2.choices?.[0]?.message?.content || "";
  }
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "请完整提取这张简历图片中的所有文字内容，保持原有格式，不要遗漏任何信息。" },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }],
      max_tokens: 4e3
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API错误: ${response.status} - ${err}`);
  }
  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}
function calculateProfileCompleteness(candidate) {
  const fields = [
    candidate.name,
    candidate.phone,
    candidate.email,
    candidate.location,
    candidate.highestEducation,
    candidate.expectedPosition,
    candidate.selfEvaluation,
    candidate.yearsOfExperience
  ];
  const filled = fields.filter((f) => f !== void 0 && f !== null && f !== "").length;
  let score = filled / fields.length * 60;
  if (candidate.educations?.length > 0) score += 10;
  if (candidate.workExperiences?.length > 0) score += 15;
  if (candidate.skills?.length > 0) score += 10;
  if (candidate.tags?.length > 0) score += 5;
  return Math.min(100, Math.round(score));
}
const upload = new Hono();
upload.post("/resume", async (c) => {
  try {
    const apiKey = c.req.header("X-OpenAI-Key") || process.env.OPENAI_API_KEY || "";
    const apiBaseUrl = c.req.header("X-OpenAI-Base-URL") || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    if (!apiKey) {
      return c.json({ success: false, message: "OpenAI API Key未配置，请在系统设置中配置API Key" }, 400);
    }
    const formData = await c.req.formData();
    const file = formData.get("file");
    const sourceChannel = formData.get("sourceChannel") || "手动上传";
    if (!file) return c.json({ success: false, message: "请选择要上传的简历文件" }, 400);
    const allowedExts = ["pdf", "doc", "docx", "txt", "html", "htm", "jpg", "jpeg", "png", "webp"];
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExts.includes(fileExt)) {
      return c.json({ success: false, message: "不支持的文件格式，请上传 PDF、Word、TXT、HTML 或图片格式" }, 400);
    }
    if (file.size > 20 * 1024 * 1024) {
      return c.json({ success: false, message: "文件大小不能超过 20MB" }, 400);
    }
    const fileBuffer = await file.arrayBuffer();
    const nodeBuffer = Buffer.from(fileBuffer);
    const mimeType = file.type || `application/${fileExt}`;
    const task = await db.createParseTask({ fileName: file.name, fileType: mimeType, status: "processing" });
    try {
      const resumeText = await extractTextFromFile(fileBuffer, file.name, file.type, apiKey, apiBaseUrl);
      if (!resumeText || resumeText.trim().length < 10) {
        await db.updateParseTask(task.id, { status: "failed", errorMsg: "无法提取文件文本内容" });
        return c.json({ success: false, message: "无法从文件中提取有效内容，PDF请确保非扫描件；图片请保证文字清晰" }, 400);
      }
      const parseResult = await parseResumeWithAI(resumeText, apiKey, apiBaseUrl);
      if (!parseResult.name) {
        parseResult.name = file.name.replace(/\.[^.]+$/, "").replace(/简历|_resume|resume/gi, "").trim() || "未知姓名";
      }
      const candidate = await db.createCandidate({
        ...parseResult,
        sourceChannel,
        rawResumeText: resumeText.slice(0, 5e3),
        resumeFileName: file.name,
        resumeFileType: mimeType,
        resumeFileSize: file.size,
        candidateStatus: "active",
        matchScore: calculateProfileCompleteness(parseResult)
      });
      const fileKey = generateFileKey(candidate.id, file.name);
      await uploadFile(fileKey, nodeBuffer, mimeType);
      await db.saveResumeFileMeta(candidate.id, {
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        fileKey
      });
      const previewUrl = `/api/candidates/${candidate.id}/resume`;
      await db.updateParseTask(task.id, {
        status: "completed",
        candidateId: candidate.id,
        parseResult: JSON.stringify(parseResult)
      });
      const fullCandidate = await db.getCandidateById(candidate.id);
      return c.json({
        success: true,
        data: { candidate: fullCandidate, parseResult, taskId: task.id, previewUrl },
        message: `简历解析成功！已为 ${candidate.name} 创建候选人档案`
      });
    } catch (parseError) {
      await db.updateParseTask(task.id, { status: "failed", errorMsg: parseError.message });
      throw parseError;
    }
  } catch (e) {
    const msg = e.message || "未知错误";
    let friendlyMsg = `简历解析失败: ${msg}`;
    if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("Incorrect API key")) {
      friendlyMsg = "API Key 无效或已过期，请在系统设置 → AI配置中重新填写正确的 OpenAI API Key。";
    } else if (msg.includes("429") || msg.includes("rate_limit")) {
      friendlyMsg = "OpenAI 请求频率超限，请稍后再试。";
    } else if (msg.includes("quota") || msg.includes("insufficient_quota")) {
      friendlyMsg = "OpenAI API 余额不足，请充值后再试。";
    } else if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      friendlyMsg = "请求超时，请检查网络或 API Base URL 是否正确。";
    } else if (msg.includes("model") && msg.includes("not found")) {
      friendlyMsg = "模型不存在，请确认 API Key 有权限访问 gpt-4o。";
    } else if (msg.includes("404") || msg.includes("no Route matched") || msg.includes("Not Found")) {
      friendlyMsg = 'API地址错误(404)：请检查系统设置 → AI配置中的"API Base URL"。正确格式为 https://api.openai.com/v1 或您的代理地址（以 /v1 结尾，不要多填路径）。';
    }
    return c.json({ success: false, message: friendlyMsg }, 500);
  }
});
upload.post("/text", async (c) => {
  try {
    const apiKey = c.req.header("X-OpenAI-Key") || process.env.OPENAI_API_KEY || "";
    const apiBaseUrl = c.req.header("X-OpenAI-Base-URL") || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    if (!apiKey) return c.json({ success: false, message: "OpenAI API Key未配置" }, 400);
    const body = await c.req.json();
    if (!body.text || body.text.trim().length < 20) {
      return c.json({ success: false, message: "简历文本内容过短，请输入完整简历信息" }, 400);
    }
    const parseResult = await parseResumeWithAI(body.text, apiKey, apiBaseUrl);
    if (!parseResult.name) parseResult.name = "未知姓名";
    const candidate = await db.createCandidate({
      ...parseResult,
      sourceChannel: body.sourceChannel || "文本导入",
      rawResumeText: body.text.slice(0, 5e3),
      candidateStatus: "active",
      matchScore: calculateProfileCompleteness(parseResult)
    });
    return c.json({
      success: true,
      data: { candidate, parseResult },
      message: `简历解析成功！已为 ${candidate.name} 创建候选人档案`
    });
  } catch (e) {
    const msg = e.message || "未知错误";
    let friendlyMsg = "简历解析失败: " + msg;
    if (msg.includes("401") || msg.includes("invalid_api_key")) friendlyMsg = "API Key 无效，请检查系统设置。";
    else if (msg.includes("429")) friendlyMsg = "OpenAI 请求频率超限，请稍后再试。";
    else if (msg.includes("quota")) friendlyMsg = "OpenAI API 余额不足，请充值后再试。";
    else if (msg.includes("404") || msg.includes("no Route matched") || msg.includes("Not Found")) {
      friendlyMsg = 'API地址错误(404)：请在系统设置→AI配置中检查"API Base URL"，正确格式为 https://api.openai.com/v1（以/v1结尾）。';
    }
    return c.json({ success: false, message: friendlyMsg }, 500);
  }
});
upload.get("/task/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const task = await db.getParseTask(id);
  if (!task) return c.json({ success: false, message: "任务不存在" }, 404);
  return c.json({ success: true, data: task });
});
upload.post("/config", async (c) => {
  try {
    const { openaiKey, openaiBaseUrl } = await c.req.json();
    if (!openaiKey) return c.json({ success: false, message: "API Key不能为空" }, 400);
    const normalizedUrl = (openaiBaseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
    const testRes = await fetch(`${normalizedUrl}/models`, {
      headers: { "Authorization": `Bearer ${openaiKey}` }
    });
    if (!testRes.ok) {
      if (testRes.status === 401) return c.json({ success: false, message: "API Key无效或已过期，请重新填写正确的Key。" }, 400);
      if (testRes.status === 404) return c.json({ success: false, message: "API地址不存在(404)，请确认Base URL填写正确。当前地址：" + normalizedUrl }, 400);
      return c.json({ success: false, message: "API验证失败(" + testRes.status + ")，请检查Key和Base URL后重试。" }, 400);
    }
    return c.json({ success: true, message: "API Key验证成功" });
  } catch (e) {
    return c.json({ success: false, message: `验证失败: ${e.message}` }, 500);
  }
});
const users = new Hono();
users.get("/", (c) => {
  const q = c.req.query();
  const { list, total } = db.getUsers({
    keyword: q.keyword,
    role: q.role,
    status: q.status,
    page: q.page ? parseInt(q.page) : 1,
    pageSize: q.pageSize ? parseInt(q.pageSize) : 20
  });
  return c.json({ success: true, data: list, total });
});
users.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const user = db.getUserById(id);
  if (!user) return c.json({ success: false, message: "用户不存在" }, 404);
  return c.json({ success: true, data: user });
});
users.post("/", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.username?.trim()) return c.json({ success: false, message: "登录名不能为空" }, 400);
    if (!body.realName?.trim()) return c.json({ success: false, message: "真实姓名不能为空" }, 400);
    if (!body.email?.trim()) return c.json({ success: false, message: "邮箱不能为空" }, 400);
    if (!body.password?.trim()) return c.json({ success: false, message: "密码不能为空" }, 400);
    if (body.password.length < 6) return c.json({ success: false, message: "密码不能少于6位" }, 400);
    const validRoles = ["admin", "hr", "interviewer", "viewer"];
    if (!validRoles.includes(body.role)) return c.json({ success: false, message: "无效的角色" }, 400);
    const result = db.createUser(body);
    if (result.error) return c.json({ success: false, message: result.error }, 409);
    return c.json({ success: true, data: result.user, message: "用户创建成功" }, 201);
  } catch (e) {
    return c.json({ success: false, message: `创建失败: ${e.message}` }, 500);
  }
});
users.put("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    if (body.password !== void 0 && body.password !== "" && body.password.length < 6) {
      return c.json({ success: false, message: "密码不能少于6位" }, 400);
    }
    const result = db.updateUser(id, body);
    if (result.error) return c.json({ success: false, message: result.error }, 409);
    return c.json({ success: true, data: result.user, message: "用户更新成功" });
  } catch (e) {
    return c.json({ success: false, message: `更新失败: ${e.message}` }, 500);
  }
});
users.patch("/:id/status", (c) => {
  const id = parseInt(c.req.param("id"));
  const result = db.toggleUserStatus(id);
  if (result.error) return c.json({ success: false, message: result.error }, 404);
  const action = result.user?.status === "active" ? "启用" : "禁用";
  return c.json({ success: true, data: result.user, message: `用户已${action}` });
});
users.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  if (id === 1) return c.json({ success: false, message: "超级管理员不可删除" }, 403);
  const ok = db.deleteUser(id);
  if (!ok) return c.json({ success: false, message: "用户不存在" }, 404);
  return c.json({ success: true, message: "用户已删除" });
});
users.get("/stats/overview", (c) => {
  const { list } = db.getUsers({ pageSize: 9999 });
  const total = list.length;
  const byRole = list.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  const byStatus = list.reduce((acc, u) => {
    acc[u.status] = (acc[u.status] || 0) + 1;
    return acc;
  }, {});
  return c.json({ success: true, data: { total, byRole, byStatus } });
});
const JWT_SECRET = process.env.JWT_SECRET || "resume-talent-mgr-secret-2024";
const JWT_EXPIRES = 7 * 24 * 60 * 60;
function base64urlEncode(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64urlDecode(str) {
  const pad = str.length % 4;
  const padded = str + (pad ? "=".repeat(4 - pad) : "");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
}
async function hmacSign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function hmacVerify(data, signature, secret) {
  const expected = await hmacSign(data, secret);
  return expected === signature;
}
async function signToken(payload) {
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1e3);
  const body = base64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRES }));
  const sig = await hmacSign(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${sig}`;
}
async function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const valid = await hmacVerify(`${header}.${body}`, sig, JWT_SECRET);
    if (!valid) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (payload.exp && Math.floor(Date.now() / 1e3) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
const ITERATIONS = 1e5;
const KEYLEN = 64;
const DIGEST = "sha512";
const PREFIX = "$pbkdf2$";
async function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(plain, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return `${PREFIX}${salt}$${hash}`;
}
async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith(PREFIX)) {
    const parts = stored.split("$");
    if (parts.length < 4) return false;
    const salt = parts[2];
    const hash = parts[3];
    const derived = pbkdf2Sync(plain, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
    return derived === hash;
  }
  return plain === stored;
}
const auth = new Hono();
auth.post("/login", async (c) => {
  try {
    const { username, password } = await c.req.json();
    if (!username || !password) {
      return c.json({ success: false, message: "请输入用户名和密码" }, 400);
    }
    const user = await db.getUserByUsername(username);
    if (!user) {
      return c.json({ success: false, message: "用户名或密码错误" }, 401);
    }
    if (user.status === "disabled") {
      return c.json({ success: false, message: "账号已被禁用，请联系管理员" }, 403);
    }
    const ok = await verifyPassword(password, user.password || "");
    if (!ok) {
      return c.json({ success: false, message: "用户名或密码错误" }, 401);
    }
    await db.updateLastLogin(user.id);
    const token = await signToken({ id: user.id, username: user.username, role: user.role });
    const { password: _pw, ...safeUser } = user;
    return c.json({ success: true, token, user: safeUser, message: "登录成功" });
  } catch (e) {
    return c.json({ success: false, message: `登录失败: ${e.message}` }, 500);
  }
});
auth.get("/me", async (c) => {
  try {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return c.json({ success: false, message: "未登录" }, 401);
    const payload = await verifyToken(token);
    if (!payload) return c.json({ success: false, message: "token已过期，请重新登录" }, 401);
    const user = await db.getUserById(payload.id);
    if (!user) return c.json({ success: false, message: "用户不存在" }, 401);
    if (user.status === "disabled") return c.json({ success: false, message: "账号已被禁用" }, 403);
    const { password: _pw, ...safeUser } = user;
    return c.json({ success: true, user: safeUser });
  } catch (e) {
    return c.json({ success: false, message: "认证失败" }, 401);
  }
});
auth.post("/logout", (c) => {
  return c.json({ success: true, message: "已退出登录" });
});
auth.post("/change-password", async (c) => {
  try {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const payload = await verifyToken(token);
    if (!payload) return c.json({ success: false, message: "未登录" }, 401);
    const { oldPassword, newPassword } = await c.req.json();
    if (!oldPassword || !newPassword) return c.json({ success: false, message: "请填写旧密码和新密码" }, 400);
    if (newPassword.length < 6) return c.json({ success: false, message: "新密码不能少于6位" }, 400);
    const user = await db.getUserByUsername(payload.username);
    if (!user) return c.json({ success: false, message: "用户不存在" }, 404);
    const ok = await verifyPassword(oldPassword, user.password || "");
    if (!ok) return c.json({ success: false, message: "旧密码错误" }, 400);
    const hashed = await hashPassword(newPassword);
    await db.updateUser(payload.id, { password: hashed });
    return c.json({ success: true, message: "密码修改成功" });
  } catch (e) {
    return c.json({ success: false, message: `修改失败: ${e.message}` }, 500);
  }
});
const app = new Hono();
app.use("/api/*", cors());
app.route("/api/auth", auth);
app.use("/api/*", async (c, next) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return c.json({ success: false, message: "请先登录", code: "UNAUTHORIZED" }, 401);
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ success: false, message: "token已过期，请重新登录", code: "TOKEN_EXPIRED" }, 401);
  }
  c.set("user", payload);
  await next();
});
app.route("/api/candidates", candidates);
app.route("/api/upload", upload);
app.route("/api/users", users);
app.get("/api/stats", (c) => {
  return c.json({ success: true, message: "use /api/candidates/stats/overview" });
});
app.use("/static/*", serveStatic({ root: "./public" }));
app.get("/login", (c) => c.html(getLoginHtml()));
const spaRoutes = ["/", "/candidates", "/candidates/*", "/upload", "/analytics", "/settings"];
spaRoutes.forEach((r) => app.get(r, (c) => c.html(getIndexHtml())));
function getLoginHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - 简历人才管理系统</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>">
  <script src="/static/tailwind.min.js"><\/script>
  <link href="/static/fa.min.css" rel="stylesheet">
  <style>
    * { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1e3a5f 100%); display: flex; align-items: center; justify-content: center; }
    .login-card { background: #fff; border-radius: 20px; padding: 44px 40px 36px; width: 400px; max-width: calc(100vw - 32px); box-shadow: 0 25px 60px rgba(0,0,0,0.3); }
    .login-input { width: 100%; padding: 12px 16px 12px 44px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 15px; outline: none; transition: border-color .2s, box-shadow .2s; background: #f8fafc; color: #1e293b; }
    .login-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); background: #fff; }
    .input-wrap { position: relative; }
    .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 15px; pointer-events: none; }
    .eye-btn { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; padding: 2px 4px; }
    .eye-btn:hover { color: #2563eb; }
    .login-btn { width: 100%; padding: 13px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s, transform .1s; letter-spacing: .5px; }
    .login-btn:hover { background: #1d4ed8; }
    .login-btn:active { transform: scale(.98); }
    .login-btn:disabled { background: #93c5fd; cursor: not-allowed; }
    .error-msg { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 8px; padding: 10px 14px; font-size: 13px; display: none; align-items: center; gap: 8px; }
    .error-msg.show { display: flex; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
    .shake { animation: shake .35s ease; }
  </style>
</head>
<body>
  <div class="login-card">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="width:60px;height:60px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 8px 20px rgba(37,99,235,.3)">
        <i class="fas fa-users" style="color:#fff;font-size:24px"></i>
      </div>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#1e293b">简历人才管理系统</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8">智能 HR 招聘平台</p>
    </div>

    <!-- 错误提示 -->
    <div class="error-msg" id="errorMsg">
      <i class="fas fa-exclamation-circle"></i>
      <span id="errorText"></span>
    </div>

    <!-- 表单 -->
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:8px">
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">用户名</label>
        <div class="input-wrap">
          <i class="fas fa-user input-icon"></i>
          <input class="login-input" type="text" id="username" placeholder="请输入用户名" autocomplete="username" />
        </div>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">密码</label>
        <div class="input-wrap">
          <i class="fas fa-lock input-icon"></i>
          <input class="login-input" type="password" id="password" placeholder="请输入密码" autocomplete="current-password" />
          <button class="eye-btn" onclick="togglePwd()" id="eyeBtn" type="button">
            <i class="fas fa-eye" id="eyeIcon"></i>
          </button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        <input type="checkbox" id="rememberMe" style="width:15px;height:15px;accent-color:#2563eb;cursor:pointer">
        <label for="rememberMe" style="font-size:13px;color:#64748b;cursor:pointer">记住登录状态（7天）</label>
      </div>
      <button class="login-btn" id="loginBtn" onclick="doLogin()">
        <i class="fas fa-sign-in-alt" style="margin-right:6px"></i>登录
      </button>
    </div>

    <p style="text-align:center;font-size:12px;color:#cbd5e1;margin:24px 0 0">
      超级管理员账号：<strong style="color:#94a3b8">admin</strong>
    </p>
  </div>

  <script>
    // 如果已有有效 token，直接跳主页
    const tk = localStorage.getItem('auth_token')
    if (tk) {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + tk } })
        .then(r => r.json()).then(d => { if (d.success) location.href = '/' })
        .catch(() => {})
    }

    // 回车登录
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
    document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('password').focus() })

    function togglePwd() {
      const inp = document.getElementById('password')
      const icon = document.getElementById('eyeIcon')
      if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash' }
      else { inp.type = 'password'; icon.className = 'fas fa-eye' }
    }

    function showError(msg) {
      const el = document.getElementById('errorMsg')
      document.getElementById('errorText').textContent = msg
      el.classList.add('show')
      document.querySelector('.login-card').classList.add('shake')
      setTimeout(() => document.querySelector('.login-card').classList.remove('shake'), 400)
    }

    function hideError() { document.getElementById('errorMsg').classList.remove('show') }

    async function doLogin() {
      const username = document.getElementById('username').value.trim()
      const password = document.getElementById('password').value
      const btn = document.getElementById('loginBtn')

      if (!username) { showError('请输入用户名'); document.getElementById('username').focus(); return }
      if (!password) { showError('请输入密码'); document.getElementById('password').focus(); return }

      hideError()
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>登录中...'

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const data = await res.json()
        if (data.success) {
          localStorage.setItem('auth_token', data.token)
          localStorage.setItem('auth_user', JSON.stringify(data.user))
          btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>登录成功，跳转中...'
          btn.style.background = '#16a34a'
          setTimeout(() => { location.href = '/' }, 600)
        } else {
          showError(data.message || '登录失败')
          btn.disabled = false
          btn.innerHTML = '<i class="fas fa-sign-in-alt" style="margin-right:6px"></i>登录'
          document.getElementById('password').value = ''
          document.getElementById('password').focus()
        }
      } catch (e) {
        showError('网络错误，请稍后重试')
        btn.disabled = false
        btn.innerHTML = '<i class="fas fa-sign-in-alt" style="margin-right:6px"></i>登录'
      }
    }
  <\/script>
</body>
</html>`;
}
function getIndexHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>简历人才管理系统</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>">
  <script src="/static/tailwind.min.js"><\/script>
  <link href="/static/fa.min.css" rel="stylesheet">
  <script src="/static/chart.min.js"><\/script>
  <style>
    * { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }
    .sidebar-link {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: 10px; color: #cbd5e1; cursor: pointer; transition: all 0.15s;
      text-decoration: none; white-space: nowrap; overflow: hidden; width: 100%; box-sizing: border-box;
    }
    .sidebar-link:hover { background: #1d4ed8; color: #fff; }
    .sidebar-link.active { background: #2563eb; color: #fff; }
    .sidebar-link .menu-icon { flex-shrink: 0; width: 18px; text-align: center; font-size: 14px; }
    .sidebar-link .menu-text { flex: 1; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-link .menu-badge { flex-shrink: 0; background: #1e40af; font-size: 11px; border-radius: 9999px; padding: 1px 7px; }
    .sidebar-link .menu-arrow { flex-shrink: 0; font-size: 11px; opacity: 0.6; transition: transform 0.2s; }
    .sidebar-link.open .menu-arrow { transform: rotate(90deg); }
    .sub-menu { overflow: hidden; max-height: 0; transition: max-height 0.25s ease; }
    .sub-menu.open { max-height: 200px; }
    .sub-link {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px 8px 38px;
      border-radius: 8px; color: #94a3b8; cursor: pointer; transition: all 0.15s;
      text-decoration: none; white-space: nowrap; font-size: 13px; box-sizing: border-box; width: 100%;
    }
    .sub-link:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
    .sub-link.active { background: rgba(37,99,235,0.5); color: #fff; }
    .sub-link .sub-icon { flex-shrink: 0; width: 16px; text-align: center; font-size: 12px; }
    .tag-skill { background: #dbeafe; color: #1d4ed8; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .tag-industry { background: #dcfce7; color: #15803d; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .tag-trait { background: #f3e8ff; color: #7e22ce; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .tag-education { background: #fef9c3; color: #a16207; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .status-badge { font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 9999px; }
    .loading-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.55); z-index: 99999; display: flex; align-items: center; justify-content: center; pointer-events: all; }
    .card-hover { transition: all 0.2s; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    .progress-bar { transition: width 0.6s ease; }
    .fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  </style>
</head>
<body class="bg-gray-50">

<div id="toastContainer" class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"></div>

<div class="flex h-screen overflow-hidden">
  <aside style="width:260px;min-width:260px;flex-shrink:0;background:#1e3a5f;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:18px 16px 16px;border-bottom:1px solid rgba(255,255,255,0.1)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:38px;height:38px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-users" style="color:#fff;font-size:16px"></i>
        </div>
        <div style="min-width:0">
          <div style="font-weight:700;color:#fff;font-size:14px;white-space:nowrap;line-height:1.3">简历人才管理</div>
          <div style="color:#93c5fd;font-size:11px;white-space:nowrap;line-height:1.3">智能HR招聘平台</div>
        </div>
      </div>
    </div>

    <nav style="padding:12px 10px;flex:1;display:flex;flex-direction:column;gap:3px;overflow-y:auto">
      <a class="sidebar-link active" onclick="navigateTo('dashboard')" id="nav-dashboard">
        <i class="fas fa-chart-line menu-icon"></i><span class="menu-text">数据看板</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('candidates')" id="nav-candidates">
        <i class="fas fa-users menu-icon"></i><span class="menu-text">人才库</span>
        <span id="candidateCount" class="menu-badge">-</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('archive')" id="nav-archive">
        <i class="fas fa-search menu-icon"></i><span class="menu-text">档案查询</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('upload')" id="nav-upload">
        <i class="fas fa-cloud-upload-alt menu-icon"></i><span class="menu-text">导入简历</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('analytics')" id="nav-analytics">
        <i class="fas fa-chart-bar menu-icon"></i><span class="menu-text">统计分析</span>
      </a>
      <div style="height:1px;background:rgba(255,255,255,0.1);margin:6px 4px"></div>
      <div>
        <a class="sidebar-link" onclick="toggleSettingsMenu()" id="nav-settings">
          <i class="fas fa-cog menu-icon"></i><span class="menu-text">系统设置</span>
          <i class="fas fa-chevron-right menu-arrow" id="settings-arrow"></i>
        </a>
        <div class="sub-menu" id="settings-submenu">
          <a class="sub-link" onclick="navigateToSettings('ai')" id="nav-settings-ai">
            <i class="fas fa-robot sub-icon"></i><span>AI 配置</span>
          </a>
          <a class="sub-link" onclick="navigateToSettings('users')" id="nav-settings-users">
            <i class="fas fa-users-cog sub-icon"></i><span>用户管理</span>
          </a>
          <a class="sub-link" onclick="navigateToSettings('system')" id="nav-settings-system">
            <i class="fas fa-info-circle sub-icon"></i><span>系统信息</span>
          </a>
        </div>
      </div>
    </nav>

    <!-- 当前登录用户 + 退出 -->
    <div style="padding:10px 10px 14px;border-top:1px solid rgba(255,255,255,0.1)">
      <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <div style="font-size:11px;color:#93c5fd;margin-bottom:6px">AI解析状态</div>
        <div style="display:flex;align-items:center;gap:7px">
          <div id="aiStatusDot" style="width:8px;height:8px;border-radius:50%;background:#9ca3af;flex-shrink:0"></div>
          <span id="aiStatusText" style="font-size:12px;color:#d1d5db;white-space:nowrap">未配置</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px">
        <div style="display:flex;align-items:center;gap:7px;min-width:0">
          <div style="width:26px;height:26px;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#fff;font-weight:700" id="userAvatar">?</div>
          <div style="min-width:0">
            <div style="font-size:12px;color:#e2e8f0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px" id="userDisplayName">-</div>
            <div style="font-size:10px;color:#94a3b8" id="userRoleBadge">-</div>
          </div>
        </div>
        <button onclick="doLogout()" title="退出登录" style="background:rgba(255,255,255,0.08);border:none;border-radius:7px;padding:5px 8px;cursor:pointer;color:#94a3b8;transition:all .15s" onmouseover="this.style.background='rgba(239,68,68,.2)';this.style.color='#fca5a5'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='#94a3b8'">
          <i class="fas fa-sign-out-alt" style="font-size:13px"></i>
        </button>
      </div>
    </div>
  </aside>

  <main class="flex-1 overflow-auto" id="mainContent"></main>
</div>

<script src="/static/app.js"><\/script>
</body>
</html>`;
}
export {
  app as default
};
