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

        // MySQL 配置
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USER: 'resume_user',
        DB_PASSWORD: 'your_strong_password',  // ← 修改为你的密码
        DB_NAME: 'resume_db',

        // MinIO 配置
        MINIO_ENDPOINT: '127.0.0.1',
        MINIO_PORT: '9000',
        MINIO_USE_SSL: 'false',
        MINIO_ACCESS_KEY: 'minioadmin',       // ← 修改为你的 AccessKey
        MINIO_SECRET_KEY: 'minioadmin',       // ← 修改为你的 SecretKey
        MINIO_BUCKET: 'resumes',

        // OpenAI（可选）
        // OPENAI_API_KEY: 'sk-xxx',
        // OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    }
  ]
}
