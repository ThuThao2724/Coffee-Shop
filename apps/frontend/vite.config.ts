import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3007',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/chat': {
        target: 'http://localhost:3007',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
