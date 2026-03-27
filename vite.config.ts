import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist-node',
    rollupOptions: {
      input: 'src/index.tsx',
      output: {
        entryFileNames: 'app.js',
        format: 'esm',
      },
      external: [
        // Node.js 内置模块
        'fs', 'path', 'os', 'crypto', 'stream', 'buffer', 'http', 'https', 'net', 'tls', 'events',
        // 运行时依赖（不打包，由 node_modules 提供）
        '@hono/node-server',
        '@hono/node-server/serve-static',
        'mysql2',
        'mysql2/promise',
        'cos-nodejs-sdk-v5',
        'better-sqlite3',
      ],
    },
    minify: false,
    target: 'node18',
  },
})
