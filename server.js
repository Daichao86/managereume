#!/usr/bin/env node
// ==========================================
// 简历人才管理系统 - Node.js 生产启动入口
// 用法: node server.js
//       PORT=8080 node server.js
//       HOST=127.0.0.1 PORT=8080 node server.js
// ==========================================

import { serve } from '@hono/node-server'

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'

// 动态导入构建产物（纯 Hono app，不含 serve 调用）
const { default: app } = await import('./dist-node/app.js')

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log('\n✅ 简历人才管理系统已启动')
    console.log(`   监听地址: http://${HOST}:${info.port}`)
    console.log(`   本地访问: http://localhost:${info.port}`)
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
    console.log('\n按 Ctrl+C 停止服务\n')
  }
)
