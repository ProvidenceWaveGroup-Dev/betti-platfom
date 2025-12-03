# PM2 Process Management Setup for Betti Platform

This guide explains how to set up PM2 to manage all Betti platform servers with auto-restart, graceful shutdown, and boot startup on Raspberry Pi.

## Overview

PM2 manages 3 server processes:
- **betti-backend** - Main API server including nutrition (Port 3001)
- **betti-webrtc** - WebRTC signaling server (Port 8080)
- **betti-frontend** - Vite dev server (Port 5173)

## Installation

### 1. Install PM2 Globally

```bash
npm install -g pm2
```

Verify installation:
```bash
pm2 --version
```

### 2. Install Dependencies

Make sure all project dependencies are installed:

```bash
npm run install:all
```

## Configuration

The `ecosystem.config.js` file in the project root defines all server configurations with:
- **Auto-restart**: `autorestart: true`
- **Memory limits**: 150-300MB per server (suitable for Raspberry Pi)
- **Graceful shutdown**: 5-second timeout for cleanup
- **Wait ready**: Servers signal when fully initialized
- **Log rotation**: Automatic log management

## Usage

### Quick Start

Start all services:
```bash
pm2 start ecosystem.config.js
```

Or use the helper script:
```bash
# Linux/Mac/Pi
bash scripts/start-all.sh

# Windows
scripts\start-all.bat
```

### Check Status

View all running services:
```bash
pm2 status
```

Or use the status script for more details:
```bash
bash scripts/status.sh   # Linux/Mac/Pi
scripts\status.bat       # Windows
```

### View Logs

Real-time logs from all services:
```bash
pm2 logs
```

Logs for specific service:
```bash
pm2 logs betti-backend
pm2 logs betti-nutrition
pm2 logs betti-webrtc
pm2 logs betti-frontend
```

View last 100 lines:
```bash
pm2 logs --lines 100
```

### Restart Services

Restart all services:
```bash
pm2 restart ecosystem.config.js

# Or use helper script
bash scripts/restart-all.sh
```

Restart specific service:
```bash
pm2 restart betti-backend
```

### Stop Services

Stop all services:
```bash
pm2 stop ecosystem.config.js

# Or use helper script
bash scripts/stop-all.sh
```

Stop specific service:
```bash
pm2 stop betti-backend
```

### Delete/Remove Services

Remove all services from PM2:
```bash
pm2 delete ecosystem.config.js
```

Remove specific service:
```bash
pm2 delete betti-backend
```

## Monitoring

### Interactive Monitor

Launch the PM2 monitoring dashboard:
```bash
pm2 monit
```

This shows:
- CPU usage per process
- Memory usage per process
- Logs in real-time
- Process metadata

### Process Details

Get detailed info about a specific process:
```bash
pm2 show betti-backend
```

### JSON Output

Get process list as JSON:
```bash
pm2 jlist
```

## Boot Startup (Raspberry Pi)

### 1. Generate Startup Script

Run this command to generate the startup configuration:

```bash
pm2 startup
```

PM2 will output a command like:
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi
```

**Copy and run the exact command PM2 outputs.**

### 2. Start Your Services

Start all services with PM2:
```bash
pm2 start ecosystem.config.js
```

### 3. Save Process List

Save the current process list to be restored on boot:
```bash
pm2 save
```

### 4. Test Auto-Start

Reboot your Raspberry Pi:
```bash
sudo reboot
```

After reboot, check if services auto-started:
```bash
pm2 status
```

### Disable Auto-Start

If you need to disable auto-start:
```bash
pm2 unstartup systemd
```

## Log Rotation

PM2's log files can grow large over time. Use `pm2-logrotate` to manage logs automatically.

### 1. Install Log Rotation Module

```bash
pm2 install pm2-logrotate
```

### 2. Configure Log Rotation

Set maximum log file size (10MB):
```bash
pm2 set pm2-logrotate:max_size 10M
```

Set number of rotated logs to keep (7 files):
```bash
pm2 set pm2-logrotate:retain 7
```

Compress rotated logs:
```bash
pm2 set pm2-logrotate:compress true
```

Set rotation interval (e.g., daily at midnight):
```bash
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### 3. View Log Rotation Settings

```bash
pm2 conf pm2-logrotate
```

### Manual Log Clearing

Clear all logs:
```bash
pm2 flush
```

## Troubleshooting

### Service Won't Start

Check the error logs:
```bash
pm2 logs betti-backend --err --lines 50
```

Check if port is already in use:
```bash
# Linux/Pi
sudo lsof -i :3001
sudo lsof -i :3002
sudo lsof -i :8080
sudo lsof -i :5173

# Windows
netstat -ano | findstr :3001
```

### High Memory Usage

Check memory usage:
```bash
pm2 status
```

Restart service to clear memory:
```bash
pm2 restart betti-backend
```

Reduce memory limit in `ecosystem.config.js` if needed.

### Services Stop After Reboot

Make sure you ran:
1. `pm2 startup` (and executed the command it outputs)
2. `pm2 start ecosystem.config.js`
3. `pm2 save`

Check startup configuration:
```bash
systemctl status pm2-pi
```

### Database Connection Errors

Check if database file exists and has proper permissions:
```bash
ls -la backend/betti.db
chmod 644 backend/betti.db  # Fix permissions if needed
```

## Environment-Specific Configuration

### Production Mode

Start with production environment:
```bash
pm2 start ecosystem.config.js --env production
```

### Development Mode

Start with development environment:
```bash
pm2 start ecosystem.config.js --env development
```

## Helper Scripts

All helper scripts are in the `scripts/` directory:

| Script | Linux/Mac | Windows | Description |
|--------|-----------|---------|-------------|
| Start All | `bash scripts/start-all.sh` | `scripts\start-all.bat` | Start all services |
| Stop All | `bash scripts/stop-all.sh` | `scripts\stop-all.bat` | Stop all services |
| Restart All | `bash scripts/restart-all.sh` | `scripts\restart-all.bat` | Restart all services |
| Status | `bash scripts/status.sh` | `scripts\status.bat` | Show service status |

Make scripts executable (Linux/Mac/Pi only):
```bash
chmod +x scripts/*.sh
```

## PM2 Commands Cheat Sheet

| Command | Description |
|---------|-------------|
| `pm2 start ecosystem.config.js` | Start all services |
| `pm2 stop <name>` | Stop a service |
| `pm2 restart <name>` | Restart a service |
| `pm2 reload <name>` | Reload with 0-second downtime |
| `pm2 delete <name>` | Remove service from PM2 |
| `pm2 status` | List all services |
| `pm2 logs` | View logs (all services) |
| `pm2 logs <name>` | View logs (specific service) |
| `pm2 monit` | Monitor dashboard |
| `pm2 show <name>` | Detailed service info |
| `pm2 flush` | Clear all logs |
| `pm2 save` | Save process list |
| `pm2 resurrect` | Restore saved processes |
| `pm2 startup` | Generate startup script |
| `pm2 unstartup` | Disable startup script |

## Port Configuration

Current port assignments (defined in `.env` and `ecosystem.config.js`):

- **Backend API**: 3001
- **Nutrition API**: 3002
- **WebRTC Signaling**: 8080
- **Frontend (Vite)**: 5173

To change ports, update:
1. `.env` file (for environment variables)
2. `ecosystem.config.js` (for PM2 configuration)

## Additional Resources

- [PM2 Official Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Process Management Guide](https://pm2.keymetrics.io/docs/usage/process-management/)
- [PM2 Startup Script](https://pm2.keymetrics.io/docs/usage/startup/)
- [PM2 Log Management](https://pm2.keymetrics.io/docs/usage/log-management/)

## Support

For issues related to:
- **PM2**: Check [PM2 GitHub Issues](https://github.com/Unitech/pm2/issues)
- **Betti Platform**: See project README.md

---

**Last Updated**: December 2024
