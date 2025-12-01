import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Check if running in ngrok mode (no SSL needed - ngrok provides it)
const isNgrokMode = process.env.NGROK_MODE === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: isNgrokMode ? [react()] : [react(), basicSsl()],
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    allowedHosts: ['halibut-saved-gannet.ngrok-free.app'],
    // Add headers to help with ngrok
    headers: {
      'ngrok-skip-browser-warning': 'true'
    },
    // Proxy configuration for ngrok and local development
    proxy: {
      // Nutrition API (separate server on port 3002)
      '/api/nutrition': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false
      },
      // Main backend API
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Backend WebSocket for BLE/sensor data
      '/ws': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, '')
      },
      // Video chat WebSocket signaling
      '/video': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/video/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  // Optimized for 13.3" touchscreen (1920x1080)
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          $screen-width: 1920px;
          $screen-height: 1080px;
        `
      }
    }
  }
})
