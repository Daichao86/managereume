// PM2 沙箱开发环境配置（使用 Node.js 直接运行）
module.exports = {
  apps: [
    {
      name: 'resume-mgr',
      script: 'server.js',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        // MySQL 配置（沙箱测试用，生产环境请改为真实服务器配置）
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'resume_db',
        // 本地文件存储目录
        UPLOAD_DIR: '/home/user/webapp/uploads',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5,
      error_file: './logs/err.log',
      out_file:   './logs/out.log',
    }
  ]
}
