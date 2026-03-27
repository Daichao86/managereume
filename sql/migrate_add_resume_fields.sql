-- ==========================================
-- 数据库迁移脚本 v2：补充简历文件元数据字段
-- 适用场景：已有旧版数据库，执行此脚本后即可支持简历文件上传
-- 执行方式：mysql -u root -p resume_db < sql/migrate_add_resume_fields.sql
-- 注意：使用 IF NOT EXISTS 安全检查，重复执行不会报错
-- ==========================================

USE resume_db;

-- 为 candidates 表补充简历文件元数据字段（若已存在则跳过）
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_file_name  VARCHAR(255)  COMMENT '简历文件名',
  ADD COLUMN IF NOT EXISTS resume_file_type  VARCHAR(100)  COMMENT '简历文件MIME类型',
  ADD COLUMN IF NOT EXISTS resume_file_size  INT           COMMENT '简历文件大小(字节)',
  ADD COLUMN IF NOT EXISTS resume_file_key   VARCHAR(500)  COMMENT '本地文件相对路径(相对于UPLOAD_DIR)',
  ADD COLUMN IF NOT EXISTS resume_uploaded_at DATETIME     COMMENT '简历上传时间';

-- 验证字段是否添加成功
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'resume_db'
  AND TABLE_NAME = 'candidates'
  AND COLUMN_NAME IN ('resume_file_name','resume_file_type','resume_file_size','resume_file_key','resume_uploaded_at');

SELECT '✅ 迁移完成：resume_file_* 字段已就绪' AS migration_result;
