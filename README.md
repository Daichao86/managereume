# 简历人才管理系统

> 基于 Hono + Node.js + MySQL 的智能 HR 招聘管理平台，支持 AI 简历解析、多维度人才检索与完整的用户权限体系。

## 项目信息

| 项目 | 内容 |
|------|------|
| **名称** | 简历人才管理系统 Resume Talent Management System |
| **GitHub** | https://github.com/Daichao86/managereume |
| **技术栈** | Hono (TypeScript) + Node.js + MySQL + Tailwind CSS + Chart.js |
| **AI 引擎** | OpenAI GPT-4o（简历解析 / Vision 图片识别） |
| **运行方式** | Node.js + PM2，可在任意 Linux 服务器部署 |

---

## 功能清单

### ✅ 已实现

| 模块 | 功能说明 |
|------|----------|
| **🔐 登录认证** | JWT 登录鉴权，超级管理员账号，7天 Token，密码 PBKDF2 哈希 |
| **👥 用户管理** | 超级管理员创建用户，4种角色（管理员/HR/面试官/只读），启用/禁用 |
| **📊 数据看板** | 人才总数、面试中、录用率、AI匹配分、图表分析（状态/学历/渠道/年限/技能） |
| **📋 人才库** | 左右分栏（列表+详情预览），多维筛选，排序，分页，右侧内嵌简历预览 |
| **🔍 档案查询** | 常用条件直显，20+高级条件可折叠，支持全文/技能/学历/公司/院校联合检索 |
| **🤖 AI 解析** | 上传 PDF/Word/TXT/图片，GPT-4o 自动提取结构化信息；支持文本粘贴解析 |
| **📁 简历存储** | 原件保存至服务器本地磁盘，MySQL 存元数据，支持在线预览 |
| **📝 候选人详情** | 教育经历 / 工作经历 / 项目经验 / 技能 / 证书 / AI标签 / 面试记录 |
| **🏷️ 状态流转** | 活跃 → 面试中 → 已录用 / 已淘汰 / 黑名单 |
| **💬 面试记录** | 多轮面试（电话/视频/现场），记录面试官、结果、反馈 |
| **📌 HR 备注** | 私密备注，支持随时编辑 |
| **⚙️ 系统设置** | AI Key 配置与连通性测试，用户管理，系统信息 |

### 🗂️ 数据模型

```
candidates        候选人主信息（含简历文件元数据）
educations        教育经历
work_experiences  工作经历
projects          项目经验
skills            技能信息
certifications    证书荣誉
candidate_tags    AI 智能标签
interview_records 面试记录
parse_tasks       AI 解析任务队列
system_users      系统用户（登录账号）
```

---

## 快速部署

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- PM2（`npm install -g pm2`）

### 一键启动

```bash
# 1. 克隆代码
git clone https://github.com/Daichao86/managereume.git
cd managereume

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 DB_HOST / DB_USER / DB_PASSWORD / DB_NAME

# 4. 初始化数据库
mysql -u root -p < sql/init.sql          # 建表
mysql -u root -p resume_db < sql/init_admin.sql  # 创建超级管理员

# 5. 构建并启动
npm run build
pm2 start ecosystem.production.cjs

# 访问 http://服务器IP:3000
```

### 超级管理员账号

| 用户名 | 初始密码 |
|--------|----------|
| `admin` | `Admin@2024` |

> ⚠️ **首次登录后请立即在「系统设置 → 用户管理」修改密码！**

---

## 目录结构

```
├── src/
│   ├── index.tsx          # 主入口：路由挂载 + 登录页 + SPA HTML
│   ├── routes/
│   │   ├── auth.ts        # 登录 / 登出 / 修改密码
│   │   ├── candidates.ts  # 候选人 CRUD + 简历管理
│   │   ├── upload.ts      # AI 简历解析上传
│   │   └── users.ts       # 用户管理
│   └── lib/
│       ├── database.ts    # MySQL 数据访问层
│       ├── ai-parser.ts   # OpenAI 简历解析
│       ├── storage.ts     # 本地文件存储
│       ├── jwt.ts         # JWT 签发 / 验证
│       └── crypto.ts      # PBKDF2 密码哈希
├── public/static/
│   ├── app.js             # 前端全部逻辑（SPA）
│   ├── style.css          # 自定义样式
│   ├── tailwind.min.js    # Tailwind CSS（离线版）
│   ├── chart.min.js       # Chart.js（离线版）
│   └── fa.min.css         # FontAwesome 图标
├── sql/
│   ├── init.sql           # 数据库建表脚本（含全部表结构）
│   ├── init_admin.sql     # 超级管理员初始化脚本
│   └── migrate_add_resume_fields.sql  # 字段迁移脚本
├── server.js              # Node.js 生产启动入口
├── ecosystem.config.cjs   # PM2 开发配置
├── ecosystem.production.cjs  # PM2 生产配置
└── vite.config.ts         # Vite SSR 构建配置
```

---

## API 接口一览

### 认证（无需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT Token |
| GET  | `/api/auth/me` | 获取当前登录用户信息 |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/auth/change-password` | 修改密码 |

### 候选人（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/candidates` | 列表（支持 20+ 过滤参数） |
| GET    | `/api/candidates/stats/overview` | 统计看板数据 |
| GET    | `/api/candidates/:id` | 候选人详情 |
| POST   | `/api/candidates` | 创建候选人 |
| PUT    | `/api/candidates/:id` | 更新候选人 |
| DELETE | `/api/candidates/:id` | 删除候选人 |
| PATCH  | `/api/candidates/:id/status` | 更新状态 |
| PATCH  | `/api/candidates/:id/notes` | 更新 HR 备注 |
| POST   | `/api/candidates/:id/interviews` | 添加面试记录 |
| GET    | `/api/candidates/:id/resume/info` | 简历文件信息 |
| GET    | `/api/candidates/:id/resume` | 下载简历原件 |

### 上传解析（需 Token + X-OpenAI-Key 头）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload/resume` | 上传文件并 AI 解析 |
| POST | `/api/upload/text` | 文本粘贴 AI 解析 |
| POST | `/api/upload/config` | 验证 API Key 连通性 |

### 用户管理（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET    | `/api/users` | 用户列表 |
| POST   | `/api/users` | 创建用户 |
| PUT    | `/api/users/:id` | 更新用户 |
| PATCH  | `/api/users/:id/status` | 启用/禁用 |
| DELETE | `/api/users/:id` | 删除用户（超管不可删） |

---

## 安全设计

- **JWT**：HS256 签名，7 天有效期，过期自动跳转登录页
- **密码**：PBKDF2-SHA512，100000 次迭代，随机 Salt
- **API 鉴权**：所有 `/api/*` 接口均受 JWT 保护，`/api/auth/*` 免鉴权
- **超管保护**：id=1 的超级管理员账号不可被删除
- **前端**：401 响应自动清除 Token 并跳转登录，无法绕过

---

## 开发历程（提交记录）

| 版本 | 主要内容 |
|------|----------|
| v1.0 | 初始版本，完整 SPA + AI 简历解析 |
| v1.1 | SQLite → MySQL 持久化存储升级 |
| v1.2 | 文件存储：腾讯云 COS → 本地磁盘方案 |
| v1.3 | Bug 修复：AI 遮罩层、数据加载、图标异常 |
| v1.4 | 修复简历上传字段缺失、AI 解析 404 问题 |
| v1.5 | 彻底修复 JS 语法错误（白屏 / 菜单点不动） |
| v1.6 | API Base URL 逻辑优化，移除自动补 /v1 |
| v1.7 | **登录认证系统**：JWT + 登录页 + 超级管理员 + 用户管理 |
| v1.8 | 档案查询重构：可折叠高级条件 + 修复滚动锁死 |

---

## License

MIT
