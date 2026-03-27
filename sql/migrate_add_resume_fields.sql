-- ==========================================
-- 数据库迁移脚本 v2：补充简历文件元数据字段
-- 兼容 MySQL 5.7 及以上所有版本
-- 执行方式：mysql -u root -p resume_db < sql/migrate_add_resume_fields.sql
-- 安全：字段已存在时自动跳过，重复执行不报错
-- ==========================================

USE resume_db;

-- 用存储过程逐个安全添加字段，兼容 MySQL 5.7+
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

DELIMITER $$
CREATE PROCEDURE add_column_if_not_exists(
  IN tbl VARCHAR(64),
  IN col VARCHAR(64),
  IN col_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl
      AND COLUMN_NAME  = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('✅ 已添加字段: ', col) AS result;
  ELSE
    SELECT CONCAT('⏭️  字段已存在，跳过: ', col) AS result;
  END IF;
END$$
DELIMITER ;

-- 逐个添加简历文件元数据字段
CALL add_column_if_not_exists('candidates', 'resume_file_name',   "VARCHAR(255)  COMMENT '简历文件名'");
CALL add_column_if_not_exists('candidates', 'resume_file_type',   "VARCHAR(100)  COMMENT '简历文件MIME类型'");
CALL add_column_if_not_exists('candidates', 'resume_file_size',   "INT           COMMENT '简历文件大小(字节)'");
CALL add_column_if_not_exists('candidates', 'resume_file_key',    "VARCHAR(500)  COMMENT '本地文件相对路径'");
CALL add_column_if_not_exists('candidates', 'resume_uploaded_at', "DATETIME      COMMENT '简历上传时间'");

-- 清理存储过程
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- 验证结果
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'candidates'
  AND COLUMN_NAME IN ('resume_file_name','resume_file_type','resume_file_size','resume_file_key','resume_uploaded_at')
ORDER BY ORDINAL_POSITION;

SELECT '✅ 迁移完成' AS migration_result;
