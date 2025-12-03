/**
 * PM2 Ecosystem Configuration for Betti Platform
 * Manages all 4 server processes with auto-restart and graceful shutdown
 */

module.exports = {
  apps: [
    // Main Backend API Server (Express + WebSocket)
    {
      name: 'betti-backend',
      script: './backend/src/index.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M', // Restart if exceeds 250MB (suitable for Pi)
      kill_timeout: 5000, // Wait 5 seconds for graceful shutdown
      wait_ready: true, // Wait for process.send('ready')
      listen_timeout: 10000, // Wait up to 10s for app to be ready
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      error_file: './logs/betti-backend-error.log',
      out_file: './logs/betti-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },

    // WebRTC Signaling Server (HTTPS with SSL auto-detection)
    {
      name: 'betti-webrtc',
      script: './backend/videochat-server/server.cjs',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        VIDEO_PORT: 8080
      },
      env_development: {
        NODE_ENV: 'development',
        VIDEO_PORT: 8080
      },
      error_file: './logs/betti-webrtc-error.log',
      out_file: './logs/betti-webrtc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },

    // Frontend Vite Server
    {
      name: 'betti-frontend',
      script: 'npm',
      args: 'run start',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M', // Vite may use more memory
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
        HOST: 'true' // Vite --host flag equivalent
      },
      env_development: {
        NODE_ENV: 'development'
      },
      error_file: '../logs/betti-frontend-error.log',
      out_file: '../logs/betti-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}
