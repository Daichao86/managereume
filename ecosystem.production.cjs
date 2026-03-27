// PM2 生产环境配置
// 启动: pm2 start ecosystem.production.cjs
// 查看: pm2 list / pm2 logs resume-talent-mgr
module.exports = {
  apps: [
    {
      name: 'resume-talent-mgr',
      script: 'server.js',
      instances: 1,          // 单实例（MySQL 多实例也支持，但文件存储本地磁盘无影响）
      exec_mode: 'fork',
      max_memory_restart: '512M',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',

        // ---- MySQL 配置（必填）----
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USER: 'resume_user',
        DB_PASSWORD: 'your_mysql_password',   // ← 修改为真实密码
        DB_NAME: 'resume_db',

        // ---- 本地文件存储目录（必填，确保目录存在且有写权限）----
        UPLOAD_DIR: '/data/resume-talent-mgr/uploads',

        // ---- OpenAI 配置（可选，也可在系统设置中填写）----
        OPENAI_API_KEY: '',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
      // 日志
      error_file: './logs/err.log',
      out_file:   './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
}
