import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Đọc file .env ở thư mục gốc project (../../.env so với frontend/)
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.BACKEND_PORT ?? '8080'
  const backendUrl  = `http://127.0.0.1:${backendPort}`
  const wsUrl       = `ws://127.0.0.1:${backendPort}`

  return defineConfig({
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      proxy: {
        // Proxy API calls đến backend — không bị CORS khi dev
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/ws': {
          target: wsUrl,
          ws: true,
        },
      },
    },
  })
})
