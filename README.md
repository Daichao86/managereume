# 简历人才管理系统

## 项目概述
- **名称**: 简历人才管理系统（Resume Talent Management System）
- **技术栈**: Hono (TypeScript) + Tailwind CSS + Chart.js + OpenAI GPT-4o
- **部署平台**: Cloudflare Workers/Pages
- **数据库设计**: MySQL（SQL脚本在 migrations/ 目录，可替换 Java 后端）

## 核心功能

### ✅ 已实现功能
1. **数据看板** - 实时统计展示：总人数、面试中、录用率、AI匹配分、图表分析
2. **人才库管理** - 候选人列表、多维度搜索筛选（关键词/状态/学历/渠道/技能）
3. **AI智能解析** - 上传PDF/Word/TXT/图片，GPT-4o自动提取结构化简历信息
4. **文本导入** - 粘贴简历文本，AI一键解析成电子档案
5. **候选人详情** - 完整档案（基本信息/教育/工作/项目/技能/证书/标签）
6. **状态管理** - 活跃/面试中/已录用/已淘汰/黑名单流转
7. **面试记录** - 添加多轮面试记录、面试反馈
8. **HR备注** - 私密备注系统
9. **AI标签** - 自动生成技能/行业/特质/学历等多维标签
10. **统计分析** - 漏斗分析、学历分布、渠道ROI、技能热榜、工作年限

### 📋 数据模型
- `candidates` - 候选人基本信息
- `educations` - 教育经历
- `work_experiences` - 工作经历
- `projects` - 项目经验
- `skills` - 技能信息
- `certifications` - 证书荣誉
- `candidate_tags` - AI智能标签
- `interview_records` - 面试记录
- `parse_tasks` - AI解析任务

## API接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/candidates | 获取候选人列表（支持筛选分页） |
| GET | /api/candidates/:id | 获取候选人详情 |
| POST | /api/candidates | 创建候选人 |
| PUT | /api/candidates/:id | 更新候选人 |
| DELETE | /api/candidates/:id | 删除候选人 |
| PATCH | /api/candidates/:id/status | 更新候选人状态 |
| PATCH | /api/candidates/:id/notes | 更新HR备注 |
| POST | /api/candidates/:id/interviews | 添加面试记录 |
| GET | /api/candidates/stats/overview | 统计数据 |
| POST | /api/upload/resume | 上传文件并AI解析 |
| POST | /api/upload/text | 文本粘贴AI解析 |

## 使用指南

### 1. 配置AI解析
进入「系统设置」→ 输入 OpenAI API Key → 保存

### 2. 导入简历
- 点击「导入简历」→ 上传文件（PDF/Word/TXT/图片）→ AI自动解析
- 或粘贴简历文本 → AI解析

### 3. 管理人才库
- 人才库页面支持按姓名、职位、学历、渠道、技能多维筛选
- 点击候选人查看完整档案、更新状态、添加面试记录

## Java后端对接

项目提供完整的MySQL Schema（migrations/001_initial_schema.sql），可与Spring Boot后端对接：

1. 在MySQL中执行建表脚本
2. Java Spring Boot实现相同路径的REST API
3. 修改前端 apiRequest 函数的基础URL为Java服务地址

## 部署

```bash
# 本地开发
npm run build
pm2 start ecosystem.config.cjs

# Cloudflare Pages部署
npm run build
npx wrangler pages deploy dist --project-name resume-mgr
```

## 更新历史
- v1.0.0 (2026-03-25): 初始版本，完整功能实现
