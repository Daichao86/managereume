// PM2 生产环境配置
module.exports = {
  apps: [
    {
      name: 'resume-talent-mgr',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',

        // ── MySQL 配置 ──────────────────────
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USER: 'resume_user',
        DB_PASSWORD: 'your_strong_password',   // ← 改为你的密码
        DB_NAME: 'resume_db',

        // ── 腾讯云 COS 配置 ─────────────────
        COS_SECRET_ID:  '',   // ← 填入腾讯云 SecretId
        COS_SECRET_KEY: '',   // ← 填入腾讯云 SecretKey
        COS_BUCKET:     'resumes-1234567890',                   // ← 填入桶名-AppId
        COS_REGION:     'ap-guangzhou',                         // ← 填入地域

        // ── OpenAI（可选）──────────────────
        // OPENAI_API_KEY:  'sk-xxx',
        // OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
      error_file: './logs/err.log',
      out_file:   './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    }
  ]
}
