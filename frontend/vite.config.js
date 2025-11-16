import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    host: true,
    strictPort: true
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
