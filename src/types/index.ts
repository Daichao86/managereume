// ==========================================
// 简历管理系统 - 核心类型定义
// ==========================================

export interface Education {
  id?: number
  candidateId?: number
  schoolName: string
  degree: string
  major: string
  startDate: string
  endDate: string
  gpa?: number
  description?: string
  is985?: boolean
  is211?: boolean
  isOverseas?: boolean
  sortOrder?: number
}

export interface WorkExperience {
  id?: number
  candidateId?: number
  companyName: string
  companySize?: string
  companyType?: string
  industry?: string
  position: string
  jobLevel?: string
  department?: string
  startDate: string
  endDate?: string
  isCurrent?: boolean
  salary?: number
  description: string
  achievements?: string
  sortOrder?: number
}

export interface Project {
  id?: number
  candidateId?: number
  projectName: string
  role?: string
  startDate?: string
  endDate?: string
  techStack?: string
  description: string
  achievements?: string
  projectUrl?: string
  sortOrder?: number
}

export interface Skill {
  id?: number
  candidateId?: number
  skillName: string
  proficiency?: string  // 精通/熟练/了解
  yearsUsed?: number
  category?: string
}

export interface Certification {
  id?: number
  candidateId?: number
  certName: string
  issuingOrg?: string
  issueDate?: string
  certType?: string
  description?: string
}

export interface CandidateTag {
  id?: number
  candidateId?: number
  tagName: string
  tagType?: string  // skill/industry/trait/education/custom
  tagSource?: string  // ai/manual
  confidence?: number
}

export interface InterviewRecord {
  id?: number
  candidateId?: number
  interviewType?: string
  interviewRound?: string
  interviewDate?: string
  interviewer?: string
  result?: string
  score?: number
  feedback?: string
  nextStep?: string
  createdAt?: string
}

export interface Candidate {
  id?: number
  name: string
  gender?: string
  age?: number
  birthDate?: string
  phone?: string
  email?: string
  location?: string
  hometown?: string
  avatarUrl?: string
  currentStatus?: string
  yearsOfExperience?: number
  highestEducation?: string
  expectedSalaryMin?: number
  expectedSalaryMax?: number
  expectedPosition?: string
  expectedCity?: string
  selfEvaluation?: string
  linkedinUrl?: string
  githubUrl?: string
  portfolioUrl?: string
  sourceChannel?: string
  candidateStatus?: string
  isBlacklist?: boolean
  hrNotes?: string
  matchScore?: number
  rawResumeText?: string
  resumeFileUrl?: string
  resumeFileName?: string
  createdAt?: string
  updatedAt?: string
  // 关联数据
  educations?: Education[]
  workExperiences?: WorkExperience[]
  projects?: Project[]
  skills?: Skill[]
  certifications?: Certification[]
  tags?: CandidateTag[]
  interviewRecords?: InterviewRecord[]
}

export interface ParseTask {
  id?: number
  candidateId?: number
  fileName: string
  fileUrl?: string
  fileType: string
  status: string  // pending/processing/completed/failed
  parseResult?: string
  errorMsg?: string
  createdAt?: string
  updatedAt?: string
}

export interface SearchParams {
  keyword?: string
  candidateStatus?: string
  highestEducation?: string
  minExperience?: number
  maxExperience?: number
  sourceChannel?: string
  isBlacklist?: boolean
  location?: string
  expectedPosition?: string
  skillKeyword?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  total?: number
  page?: number
  pageSize?: number
}

// AI解析结果类型
export interface AIParseResult {
  name: string
  gender?: string
  age?: number
  phone?: string
  email?: string
  location?: string
  hometown?: string
  currentStatus?: string
  yearsOfExperience?: number
  highestEducation?: string
  expectedSalaryMin?: number
  expectedSalaryMax?: number
  expectedPosition?: string
  expectedCity?: string
  selfEvaluation?: string
  linkedinUrl?: string
  githubUrl?: string
  educations: Education[]
  workExperiences: WorkExperience[]
  projects: Project[]
  skills: Skill[]
  certifications: Certification[]
  tags: CandidateTag[]
  summary?: string  // AI生成的候选人概述
}
