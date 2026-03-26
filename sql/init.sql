-- ==========================================
-- 简历人才管理系统 - MySQL 建表脚本
-- 执行方式: mysql -u root -p resume_db < sql/init.sql
-- ==========================================

CREATE DATABASE IF NOT EXISTS resume_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE resume_db;

-- 候选人主表
CREATE TABLE IF NOT EXISTS candidates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL COMMENT '姓名',
  gender        VARCHAR(10)  COMMENT '性别',
  age           TINYINT      COMMENT '年龄',
  birth_date    VARCHAR(20)  COMMENT '出生日期',
  phone         VARCHAR(20)  COMMENT '手机号',
  email         VARCHAR(100) COMMENT '邮箱',
  location      VARCHAR(100) COMMENT '现居城市',
  hometown      VARCHAR(100) COMMENT '籍贯',
  avatar_url    VARCHAR(255) COMMENT '头像URL',
  current_status VARCHAR(20) COMMENT '当前求职状态(在职/离职/应届)',
  years_of_experience FLOAT  COMMENT '工作年限',
  highest_education VARCHAR(20) COMMENT '最高学历',
  expected_salary_min INT    COMMENT '期望薪资下限(元/月)',
  expected_salary_max INT    COMMENT '期望薪资上限(元/月)',
  expected_position VARCHAR(100) COMMENT '意向职位',
  expected_city VARCHAR(100) COMMENT '意向城市',
  self_evaluation TEXT       COMMENT '自我评价',
  linkedin_url  VARCHAR(255) COMMENT 'LinkedIn',
  github_url    VARCHAR(255) COMMENT 'GitHub',
  portfolio_url VARCHAR(255) COMMENT '作品集',
  source_channel VARCHAR(50) COMMENT '来源渠道',
  candidate_status VARCHAR(20) DEFAULT 'active' COMMENT '候选人状态(active/interviewing/offered/hired/rejected/archived)',
  is_blacklist  TINYINT(1)   DEFAULT 0 COMMENT '是否黑名单',
  hr_notes      TEXT         COMMENT 'HR备注',
  match_score   FLOAT        COMMENT 'AI匹配分数',
  raw_resume_text MEDIUMTEXT COMMENT '简历原始文本',
  -- 简历文件元数据（文件本身存 MinIO）
  resume_file_name  VARCHAR(255) COMMENT '简历文件名',
  resume_file_type  VARCHAR(100) COMMENT '简历文件MIME类型',
  resume_file_size  INT          COMMENT '简历文件大小(字节)',
  resume_file_key   VARCHAR(500) COMMENT 'MinIO对象Key',
  resume_uploaded_at DATETIME   COMMENT '简历上传时间',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name(name),
  INDEX idx_phone(phone),
  INDEX idx_email(email),
  INDEX idx_status(candidate_status),
  INDEX idx_education(highest_education),
  INDEX idx_created(created_at),
  INDEX idx_match(match_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 教育经历
CREATE TABLE IF NOT EXISTS educations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT NOT NULL,
  school_name   VARCHAR(100) NOT NULL COMMENT '学校名称',
  degree        VARCHAR(20)  NOT NULL COMMENT '学历(本科/硕士/博士/专科)',
  major         VARCHAR(100) COMMENT '专业',
  start_date    VARCHAR(20)  COMMENT '开始时间',
  end_date      VARCHAR(20)  COMMENT '结束时间',
  gpa           FLOAT        COMMENT 'GPA',
  description   TEXT         COMMENT '描述',
  is_985        TINYINT(1)   DEFAULT 0,
  is_211        TINYINT(1)   DEFAULT 0,
  is_overseas   TINYINT(1)   DEFAULT 0 COMMENT '是否海外',
  sort_order    INT          DEFAULT 0,
  INDEX idx_candidate(candidate_id),
  INDEX idx_school(school_name),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 工作经历
CREATE TABLE IF NOT EXISTS work_experiences (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT NOT NULL,
  company_name  VARCHAR(100) NOT NULL COMMENT '公司名称',
  company_size  VARCHAR(20)  COMMENT '公司规模',
  company_type  VARCHAR(50)  COMMENT '公司类型',
  industry      VARCHAR(50)  COMMENT '所属行业',
  position      VARCHAR(100) NOT NULL COMMENT '职位',
  job_level     VARCHAR(50)  COMMENT '职级',
  department    VARCHAR(100) COMMENT '部门',
  start_date    VARCHAR(20)  COMMENT '开始时间',
  end_date      VARCHAR(20)  COMMENT '结束时间',
  is_current    TINYINT(1)   DEFAULT 0 COMMENT '是否在职',
  salary        INT          COMMENT '薪资',
  description   TEXT         COMMENT '工作内容',
  achievements  TEXT         COMMENT '工作成就',
  sort_order    INT          DEFAULT 0,
  INDEX idx_candidate(candidate_id),
  INDEX idx_company(company_name),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 项目经历
CREATE TABLE IF NOT EXISTS projects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT NOT NULL,
  project_name  VARCHAR(200) NOT NULL,
  role          VARCHAR(100) COMMENT '担任角色',
  start_date    VARCHAR(20),
  end_date      VARCHAR(20),
  tech_stack    VARCHAR(500) COMMENT '技术栈',
  description   TEXT,
  achievements  TEXT,
  project_url   VARCHAR(255),
  sort_order    INT DEFAULT 0,
  INDEX idx_candidate(candidate_id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 技能
CREATE TABLE IF NOT EXISTS skills (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT NOT NULL,
  skill_name    VARCHAR(100) NOT NULL,
  proficiency   VARCHAR(20)  COMMENT '熟练度(精通/熟练/了解)',
  years_used    FLOAT        COMMENT '使用年限',
  category      VARCHAR(50)  COMMENT '分类(编程语言/框架/工具等)',
  INDEX idx_candidate(candidate_id),
  INDEX idx_skill(skill_name),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 证书
CREATE TABLE IF NOT EXISTS certifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT NOT NULL,
  cert_name     VARCHAR(200) NOT NULL,
  issuing_org   VARCHAR(200),
  issue_date    VARCHAR(20),
  cert_type     VARCHAR(50),
  description   TEXT,
  INDEX idx_candidate(candidate_id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI标签
CREATE TABLE IF NOT EXISTS candidate_tags (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT NOT NULL,
  tag_name      VARCHAR(100) NOT NULL,
  tag_type      VARCHAR(50)  COMMENT 'skill/industry/trait/education/custom',
  tag_source    VARCHAR(20)  COMMENT 'ai/manual',
  confidence    FLOAT        COMMENT 'AI置信度',
  INDEX idx_candidate(candidate_id),
  INDEX idx_tag(tag_name),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 面试记录
CREATE TABLE IF NOT EXISTS interview_records (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id    INT NOT NULL,
  interview_type  VARCHAR(50)  COMMENT '面试类型(技术面/HR面/终面)',
  interview_round VARCHAR(20)  COMMENT '轮次',
  interview_date  VARCHAR(30)  COMMENT '面试时间',
  interviewer     VARCHAR(100) COMMENT '面试官',
  result          VARCHAR(20)  COMMENT '结果(通过/淘汰/待定)',
  score           FLOAT        COMMENT '评分',
  feedback        TEXT         COMMENT '评价反馈',
  next_step       VARCHAR(200) COMMENT '下一步',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_candidate(candidate_id),
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI解析任务
CREATE TABLE IF NOT EXISTS parse_tasks (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id  INT,
  file_name     VARCHAR(255) NOT NULL,
  file_url      VARCHAR(500),
  file_type     VARCHAR(100),
  status        VARCHAR(20)  DEFAULT 'pending' COMMENT 'pending/processing/completed/failed',
  parse_result  MEDIUMTEXT,
  error_msg     TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_candidate(candidate_id),
  INDEX idx_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统用户
CREATE TABLE IF NOT EXISTS system_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录名',
  real_name     VARCHAR(50)  NOT NULL COMMENT '真实姓名',
  email         VARCHAR(100) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  role          VARCHAR(20)  NOT NULL DEFAULT 'viewer' COMMENT 'admin/hr/interviewer/viewer',
  department    VARCHAR(100),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
  password      VARCHAR(255) COMMENT '密码(建议生产环境改为bcrypt哈希)',
  avatar        VARCHAR(10)  COMMENT '头像首字母',
  last_login_at DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username(username),
  INDEX idx_role(role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- 初始演示数据
-- ==========================================
INSERT IGNORE INTO system_users (username,real_name,email,phone,role,department,status,password) VALUES
('admin',    '系统管理员', 'admin@company.com',         '13800000001', 'admin',       '技术部',   'active',   'admin123'),
('hr_zhang', '张招聘',     'zhang.hr@company.com',      '13800000002', 'hr',          '人力资源部','active',   'hr123456'),
('interviewer_li','李面试官','li.interview@company.com', '13800000003', 'interviewer', '研发部',   'active',   'inter123'),
('viewer_wang',  '王只读',  'wang.view@company.com',     '13800000004', 'viewer',      '业务部',   'disabled', 'view1234');

INSERT IGNORE INTO candidates
  (id,name,gender,age,phone,email,location,hometown,highest_education,years_of_experience,
   expected_position,expected_salary_min,expected_salary_max,expected_city,
   current_status,candidate_status,source_channel,match_score,self_evaluation)
VALUES
(1,'张伟','男',28,'13800138001','zhangwei@email.com','北京市朝阳区','山东省济南市','本科',5,'高级Java工程师',25000,35000,'北京','在职','active','BOSS直聘',92.5,'5年Java开发经验，熟练掌握Spring Boot、MyBatis、Redis、MySQL等技术栈。'),
(2,'李娜','女',26,'13900139002','lina@email.com','上海市浦东新区','浙江省杭州市','硕士',3,'产品经理',20000,30000,'上海','在职','interviewing','智联招聘',88.0,'3年互联网产品经验，擅长用户研究、数据分析。'),
(3,'王强','男',32,'13700137003','wangqiang@email.com','深圳市南山区','广东省广州市','本科',8,'技术总监',40000,60000,'深圳','离职','active','猎头推荐',95.0,'8年研发经验，曾带领50人技术团队，擅长技术架构设计和团队管理。'),
(4,'陈晓雨','女',24,'13600136004','chenxiaoyu@email.com','北京市海淀区','四川省成都市','本科',1,'前端工程师',12000,18000,'北京/上海','应届','active','校园招聘',75.5,'985高校计算机专业应届生，熟练掌握Vue.js、React、TypeScript。'),
(5,'刘明','男',30,'13500135005','liuming@email.com','杭州市西湖区','江苏省南京市','硕士',6,'算法工程师',35000,50000,'杭州/北京','在职','active','LinkedIn',89.0,'6年机器学习/深度学习经验，发表SCI论文3篇。');

INSERT IGNORE INTO educations (candidate_id,school_name,degree,major,start_date,end_date,is_985,is_211,sort_order) VALUES
(1,'山东大学','本科','计算机科学与技术','2014-09','2018-07',1,1,0),
(2,'复旦大学','硕士','工商管理','2019-09','2021-07',1,1,0),
(2,'上海交通大学','本科','工业工程','2015-09','2019-07',1,1,1),
(3,'华南理工大学','本科','软件工程','2010-09','2014-07',1,1,0),
(4,'北京航空航天大学','本科','计算机科学','2020-09','2024-07',1,1,0),
(5,'浙江大学','硕士','计算机应用技术','2017-09','2020-07',1,1,0),
(5,'南京大学','本科','数学与应用数学','2013-09','2017-07',1,1,1);

INSERT IGNORE INTO work_experiences (candidate_id,company_name,position,industry,company_size,company_type,start_date,end_date,is_current,description,sort_order) VALUES
(1,'字节跳动','Java工程师','互联网','2000+','上市公司','2021-06',NULL,1,'负责抖音电商平台后端开发，主导设计订单系统微服务架构，QPS从1000提升至10000+',0),
(1,'滴滴出行','Java开发工程师','互联网','2000+','上市公司','2018-07','2021-05',0,'负责出行订单系统开发，优化数据库查询性能，响应时间降低40%',1),
(2,'阿里巴巴','高级产品经理','互联网电商','2000+','上市公司','2022-03',NULL,1,'负责淘宝商家运营产品线，管理DAU百万级产品',0),
(2,'腾讯','产品经理','互联网','2000+','上市公司','2021-07','2022-02',0,'负责微信小程序商业化产品设计',1),
(3,'华为技术','技术总监','通信/互联网','2000+','上市公司','2020-03',NULL,1,'带领30人研发团队，负责云计算平台核心模块研发',0),
(3,'百度','高级研发工程师','互联网','2000+','上市公司','2016-07','2020-02',0,'负责搜索引擎索引构建系统，日处理数据量100TB+',1),
(4,'美团','前端实习生','互联网','2000+','上市公司','2023-07','2023-12',0,'参与美团外卖商家端小程序开发',0),
(5,'网易','算法工程师','互联网','2000+','上市公司','2020-07',NULL,1,'负责游戏推荐系统算法优化，CTR提升15%',0),
(5,'京东','算法实习生','互联网电商','2000+','上市公司','2019-07','2020-06',0,'参与商品推荐系统建设',1);

INSERT IGNORE INTO skills (candidate_id,skill_name,proficiency,years_used,category) VALUES
(1,'Java','精通',5,'编程语言'),(1,'Spring Boot','精通',4,'框架'),(1,'MySQL','熟练',5,'数据库'),(1,'Redis','熟练',3,'中间件'),(1,'Kafka','了解',2,'中间件'),
(2,'Axure','精通',3,'工具'),(2,'SQL','熟练',3,'数据库'),(2,'数据分析','熟练',3,'技能'),(2,'Python','了解',2,'编程语言'),
(3,'Java','精通',8,'编程语言'),(3,'微服务架构','精通',5,'架构'),(3,'Kubernetes','熟练',4,'运维'),(3,'团队管理','精通',6,'软技能'),
(4,'Vue.js','熟练',2,'框架'),(4,'React','熟练',1,'框架'),(4,'TypeScript','熟练',2,'编程语言'),(4,'CSS/Tailwind','精通',2,'前端'),
(5,'Python','精通',6,'编程语言'),(5,'TensorFlow','精通',4,'框架'),(5,'PyTorch','熟练',3,'框架'),(5,'推荐系统','精通',4,'领域'),(5,'NLP','熟练',3,'领域');

INSERT IGNORE INTO candidate_tags (candidate_id,tag_name,tag_type,tag_source,confidence) VALUES
(1,'Java开发','skill','ai',98),(1,'微服务','skill','ai',90),(1,'大厂背景','trait','ai',95),(1,'985高校','education','ai',100),
(2,'产品思维','trait','ai',92),(2,'数据驱动','trait','ai',88),(2,'985高校','education','ai',100),(2,'阿里系','industry','ai',100),
(3,'技术管理','trait','ai',95),(3,'架构设计','skill','ai',92),(3,'大厂背景','trait','ai',100),(3,'高潜力','trait','ai',88),
(4,'应届生','education','ai',100),(4,'前端开发','skill','ai',90),(4,'985高校','education','ai',100),
(5,'算法专家','skill','ai',95),(5,'机器学习','skill','ai',98),(5,'发表论文','trait','ai',100),(5,'985高校','education','ai',100);
