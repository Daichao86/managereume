// PM2 生产环境配置
module.exports = {
  apps: [
    {
      name: 'resume-talent-mgr',
      script: 'server.js',
      instances: 1,          // 单实例（内存存储不支持多实例共享）
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        // DATA_DIR: '/data/resume-talent-mgr',  // SQLite 数据目录（默认: ./data）
        // OPENAI_API_KEY: 'sk-xxx',              // 取消注释并填入
        // OPENAI_BASE_URL: 'https://api.openai.com/v1'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    }
  ]
}
