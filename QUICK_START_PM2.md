# Quick Start: PM2 Production Deployment

**TL;DR** - Get Betti Platform running in production with PM2 in 5 minutes.

## Prerequisites

- Node.js and npm installed
- All dependencies installed (`npm run install:all`)
- PM2 installed globally (`npm install -g pm2`)

## Current Server Configuration

| Server | Port | Purpose |
|--------|------|---------|
| **betti-backend** | 3001 | Main API + WebSocket + Nutrition |
| **betti-webrtc** | 8080 | Video chat signaling |
| **betti-frontend** | 5173 | Vite dev server |

## Quick Commands

### Start All Services
```bash
npm run pm2:start
# or
pm2 start ecosystem.config.js
```

### Check Status
```bash
npm run pm2:status
# or
pm2 status
```

### View Logs
```bash
npm run pm2:logs
# or
pm2 logs
```

### Restart All
```bash
npm run pm2:restart
# or
pm2 restart ecosystem.config.js
```

### Stop All
```bash
npm run pm2:stop
# or
pm2 stop ecosystem.config.js
```

## Auto-Start on Boot (Raspberry Pi)

**One-time setup:**

```bash
# 1. Generate startup script
pm2 startup

# 2. Run the command PM2 outputs (will look like this):
#    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi

# 3. Start your services
npm run pm2:start

# 4. Save the process list
npm run pm2:save

# 5. Test by rebooting
sudo reboot
```

After reboot, services will auto-start. Verify with `pm2 status`.

## Log Rotation Setup

```bash
# Install log rotation
pm2 install pm2-logrotate

# Configure (10MB max, keep 7 files, compress)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Helper Scripts

Located in `scripts/` directory:

**Linux/Mac/Raspberry Pi:**
```bash
bash scripts/start-all.sh     # Start all services
bash scripts/stop-all.sh      # Stop all services
bash scripts/restart-all.sh   # Restart all services
bash scripts/status.sh        # Show status
```

**Windows:**
```cmd
scripts\start-all.bat     # Start all services
scripts\stop-all.bat      # Stop all services
scripts\restart-all.bat   # Restart all services
scripts\status.bat        # Show status
```

## Monitoring

**Interactive dashboard:**
```bash
pm2 monit
```

**Detailed process info:**
```bash
pm2 show betti-backend
```

## Common Issues

### Port already in use
```bash
# Check what's using the port (Linux/Pi)
sudo lsof -i :3001
sudo lsof -i :3002
sudo lsof -i :8080

# Kill the process
sudo kill -9 <PID>
```

### Services won't start
```bash
# Check error logs
pm2 logs betti-backend --err --lines 50

# Check database exists
ls -la backend/betti.db
```

### High memory usage
```bash
# Check memory
pm2 status

# Restart to clear
pm2 restart betti-backend
```

## Full Documentation

For complete PM2 setup instructions, troubleshooting, and advanced configuration, see **[PM2_SETUP.md](./PM2_SETUP.md)**.

## Development vs Production

**Development** (with hot reload):
```bash
npm run dev
```

**Production** (with PM2):
```bash
npm run pm2:start
```

---

**Need Help?** See [PM2_SETUP.md](./PM2_SETUP.md) for detailed documentation.
