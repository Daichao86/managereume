-- ==========================================
-- 初始化超级管理员账号
-- 执行方式: mysql -u root -p resume_db < sql/init_admin.sql
-- 
-- 默认超级管理员:
--   用户名: admin
--   密码:   Admin@2024
--   角色:   admin (超级管理员)
-- 
-- 注意: 首次登录后请立即修改密码！
-- ==========================================

USE resume_db;

-- 创建 system_users 表（如果不存在）
CREATE TABLE IF NOT EXISTS system_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录名',
  real_name     VARCHAR(50)  NOT NULL COMMENT '真实姓名',
  email         VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
  phone         VARCHAR(20)  COMMENT '手机号',
  role          ENUM('admin','hr','interviewer','viewer') NOT NULL DEFAULT 'viewer' COMMENT '角色',
  department    VARCHAR(100) COMMENT '部门',
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active' COMMENT '状态',
  password      VARCHAR(255) COMMENT '密码哈希',
  avatar        VARCHAR(255) COMMENT '头像URL',
  last_login_at DATETIME     COMMENT '最后登录时间',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username(username),
  INDEX idx_email(email),
  INDEX idx_role(role),
  INDEX idx_status(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

-- 插入超级管理员（若已存在则跳过）
-- 密码: Admin@2024 (PBKDF2-SHA512 哈希)
INSERT IGNORE INTO system_users 
  (id, username, real_name, email, phone, role, department, status, password)
VALUES 
  (1, 'admin', '系统管理员', 'admin@company.com', '13800000001', 'admin', '技术部', 'active',
   '$pbkdf2$a5d42a3accb34a7cd9184b5963954564$6de0eb2efa7df10f77b9f7e72e6e2c12cd60fc002f6aee492da5ec5f686f2517e1bd7997850f4e2d627a55ad32741be168663d60ffea0e0b8d4331bdbe36e7e0');

-- 验证结果
SELECT id, username, real_name, role, status, created_at 
FROM system_users 
ORDER BY id;

SELECT '✅ 超级管理员初始化完成！用户名: admin  初始密码: Admin@2024  请登录后立即修改密码！' AS '提示信息';
