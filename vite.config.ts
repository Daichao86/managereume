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
      // 外部化 Node.js 运行时依赖（不打包进产物）
      external: [
        '@hono/node-server',
        '@hono/node-server/serve-static',
      ],
    },
    // 不压缩，方便问题排查
    minify: false,
    target: 'node18',
  },
})
