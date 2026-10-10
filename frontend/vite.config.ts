/// <reference types="vitest/config" />
import path from "path"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts']
  },
  server: {
    host: true, // expose on LAN so mobile can connect via local IP
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/auth': 'http://localhost:3001',
      '/history-facts': 'http://localhost:3001',
      '/medical-history': {
        target: 'http://localhost:3001',
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/red-flags': 'http://localhost:3001',
      '/ayush-assessment': {
        target: 'http://localhost:3001',
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/ocr-vision': 'http://localhost:3001',
      '/documents': 'http://localhost:3001',
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

