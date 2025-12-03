import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ngrok-specific config - NO SSL (ngrok provides HTTPS)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    allowedHosts: ['halibut-saved-gannet.ngrok-free.app'],
    // Proxy configuration for ngrok
    proxy: {
      // Nutrition API (separate server on port 3002)
      '/api/nutrition': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false
      },
      // Main backend API (backend uses HTTP in ngrok mode)
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
      // Video chat WebSocket signaling (HTTP - ngrok provides HTTPS)
      '/video': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/video/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Video proxy error:', err.message)
          })
          proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
            console.log('Video WebSocket proxy request to:', options.target)
          })
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
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
