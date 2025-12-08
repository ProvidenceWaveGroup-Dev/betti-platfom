/**
 * PM2 Ecosystem Configuration for Betti Platform
 * Manages all server processes with auto-restart and graceful shutdown
 *
 * Usage:
 *   Production: pm2 start ecosystem.config.js
 *   Development: pm2 start ecosystem.config.js --env development
 */

module.exports = {
  apps: [
    // Main Backend API Server (Express + WebSocket + BLE)
    {
      name: 'betti-backend',
      script: './backend/src/index.js',
      cwd: './',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 5000,
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

    // WebRTC Signaling Server for Video Chat
    {
      name: 'betti-video',
      script: './backend/videochat-server/server.cjs',
      cwd: './',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        VIDEO_PORT: 8080
      },
      env_development: {
        NODE_ENV: 'development',
        VIDEO_PORT: 8080
      },
      error_file: './logs/betti-video-error.log',
      out_file: './logs/betti-video-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },

    // Frontend Development Server (Vite)
    {
      name: 'betti-frontend',
      script: './scripts/start-frontend.js',
      cwd: './',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/betti-frontend-error.log',
      out_file: './logs/betti-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}
