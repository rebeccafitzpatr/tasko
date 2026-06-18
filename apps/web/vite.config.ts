import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
  // Load env vars for the current mode
  const env = loadEnv(mode, process.cwd(), '')

  // Dev: fall back to localhost backend if not provided
  const apiUrl = env.VITE_API_URL

  return defineConfig({
    plugins: [vue()],
    server: {
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  })
}
