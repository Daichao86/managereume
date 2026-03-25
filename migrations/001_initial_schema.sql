-- =============================================
-- 简历人才管理系统 - MySQL数据库Schema
-- Version: 1.0
-- =============================================

-- 候选人基本信息表
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '姓名',
    gender VARCHAR(10) COMMENT '性别',
    age INT COMMENT '年龄',
    birth_date DATE COMMENT '出生日期',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(200) COMMENT '邮箱',
    location VARCHAR(200) COMMENT '现居住地',
    hometown VARCHAR(200) COMMENT '籍贯',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    current_status VARCHAR(50) COMMENT '求职状态: 在职/离职/应届',
    years_of_experience DECIMAL(3,1) COMMENT '工作年限',
    highest_education VARCHAR(50) COMMENT '最高学历',
    expected_salary_min INT COMMENT '期望薪资下限(元/月)',
    expected_salary_max INT COMMENT '期望薪资上限(元/月)',
    expected_position VARCHAR(200) COMMENT '期望职位',
    expected_city VARCHAR(200) COMMENT '期望城市',
    self_evaluation TEXT COMMENT '自我评价',
    linkedin_url VARCHAR(500) COMMENT 'LinkedIn链接',
    github_url VARCHAR(500) COMMENT 'GitHub链接',
    portfolio_url VARCHAR(500) COMMENT '作品集链接',
    source_channel VARCHAR(100) COMMENT '简历来源渠道: BOSS/智联/内推/官网/邮件',
    candidate_status VARCHAR(50) DEFAULT 'active' COMMENT '候选人状态: active/interviewing/hired/rejected/blacklist',
    is_blacklist TINYINT DEFAULT 0 COMMENT '是否黑名单',
    hr_notes TEXT COMMENT 'HR备注',
    match_score DECIMAL(5,2) COMMENT 'AI匹配分数',
    raw_resume_text LONGTEXT COMMENT '简历原始文本',
    resume_file_url VARCHAR(500) COMMENT '简历文件URL',
    resume_file_name VARCHAR(200) COMMENT '简历文件名',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_name (name),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_status (candidate_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='候选人基本信息';

-- 教育经历表
CREATE TABLE IF NOT EXISTS educations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    school_name VARCHAR(200) NOT NULL COMMENT '学校名称',
    degree VARCHAR(50) COMMENT '学历: 博士/硕士/本科/大专/高中',
    major VARCHAR(200) COMMENT '专业',
    start_date VARCHAR(20) COMMENT '开始时间',
    end_date VARCHAR(20) COMMENT '结束时间',
    gpa DECIMAL(3,2) COMMENT 'GPA',
    description TEXT COMMENT '描述/在校经历',
    is_985 TINYINT DEFAULT 0 COMMENT '是否985',
    is_211 TINYINT DEFAULT 0 COMMENT '是否211',
    is_overseas TINYINT DEFAULT 0 COMMENT '是否海外',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教育经历';

-- 工作经历表
CREATE TABLE IF NOT EXISTS work_experiences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    company_name VARCHAR(200) NOT NULL COMMENT '公司名称',
    company_size VARCHAR(50) COMMENT '公司规模: <50/50-200/200-500/500-2000/2000+',
    company_type VARCHAR(50) COMMENT '公司性质: 国企/外企/民企/上市公司/初创',
    industry VARCHAR(100) COMMENT '行业',
    position VARCHAR(200) NOT NULL COMMENT '职位',
    job_level VARCHAR(50) COMMENT '职级',
    department VARCHAR(100) COMMENT '部门',
    start_date VARCHAR(20) COMMENT '开始时间',
    end_date VARCHAR(20) COMMENT '结束时间（至今填null）',
    is_current TINYINT DEFAULT 0 COMMENT '是否当前工作',
    salary INT COMMENT '薪资(元/月)',
    description TEXT COMMENT '工作描述/职责',
    achievements TEXT COMMENT '工作成就',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_company (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作经历';

-- 项目经验表
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    project_name VARCHAR(200) NOT NULL COMMENT '项目名称',
    role VARCHAR(100) COMMENT '担任角色',
    start_date VARCHAR(20) COMMENT '开始时间',
    end_date VARCHAR(20) COMMENT '结束时间',
    tech_stack TEXT COMMENT '技术栈',
    description TEXT COMMENT '项目描述',
    achievements TEXT COMMENT '项目成果',
    project_url VARCHAR(500) COMMENT '项目链接',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目经验';

-- 技能表
CREATE TABLE IF NOT EXISTS skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    skill_name VARCHAR(100) NOT NULL COMMENT '技能名称',
    proficiency VARCHAR(50) COMMENT '熟练程度: 精通/熟练/了解',
    years_used INT COMMENT '使用年限',
    category VARCHAR(100) COMMENT '技能类别: 编程语言/框架/工具/数据库',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_skill_name (skill_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能信息';

-- 证书与荣誉表
CREATE TABLE IF NOT EXISTS certifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    cert_name VARCHAR(200) NOT NULL COMMENT '证书/荣誉名称',
    issuing_org VARCHAR(200) COMMENT '颁发机构',
    issue_date VARCHAR(20) COMMENT '获得时间',
    cert_type VARCHAR(50) COMMENT '类型: 证书/奖项/荣誉',
    description TEXT COMMENT '描述',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='证书与荣誉';

-- 候选人标签表
CREATE TABLE IF NOT EXISTS candidate_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    tag_name VARCHAR(100) NOT NULL COMMENT '标签名称',
    tag_type VARCHAR(50) COMMENT '标签类型: skill/industry/trait/education/custom',
    tag_source VARCHAR(50) DEFAULT 'ai' COMMENT '来源: ai/manual',
    confidence DECIMAL(5,2) COMMENT 'AI置信度',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_tag_name (tag_name),
    INDEX idx_tag_type (tag_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='候选人标签';

-- 面试记录表
CREATE TABLE IF NOT EXISTS interview_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL COMMENT '候选人ID',
    interview_type VARCHAR(50) COMMENT '面试类型: 电话/视频/现场',
    interview_round VARCHAR(50) COMMENT '面试轮次: 初筛/一面/二面/HR面/终面',
    interview_date DATETIME COMMENT '面试时间',
    interviewer VARCHAR(100) COMMENT '面试官',
    result VARCHAR(50) COMMENT '结果: 通过/淘汰/待定',
    score INT COMMENT '评分(1-10)',
    feedback TEXT COMMENT '面试反馈',
    next_step VARCHAR(200) COMMENT '下一步',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='面试记录';

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT COMMENT '候选人ID',
    action VARCHAR(100) NOT NULL COMMENT '操作类型',
    description TEXT COMMENT '操作描述',
    operator VARCHAR(100) COMMENT '操作人',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';

-- AI解析任务表
CREATE TABLE IF NOT EXISTS parse_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT COMMENT '关联候选人ID',
    file_name VARCHAR(200) COMMENT '文件名',
    file_url VARCHAR(500) COMMENT '文件URL',
    file_type VARCHAR(50) COMMENT '文件类型',
    status VARCHAR(50) DEFAULT 'pending' COMMENT '状态: pending/processing/completed/failed',
    parse_result LONGTEXT COMMENT 'AI解析结果JSON',
    error_msg TEXT COMMENT '错误信息',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_candidate_id (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI解析任务';
