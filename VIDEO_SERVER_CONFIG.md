# Video Chat Server Configuration

## Overview

The Betti platform now uses **two video chat server variants** for different deployment scenarios:

1. **`server.cjs`** (HTTPS/SSL) - Primary server for local/Raspberry Pi deployment
2. **`server-ngrok.cjs`** (HTTP) - Alternative server for ngrok public deployment

---

## Server Comparison

| Feature | server.cjs (HTTPS) | server-ngrok.cjs (HTTP) |
|---------|-------------------|------------------------|
| **Use Case** | Local network, Raspberry Pi | Ngrok public access |
| **Protocol** | HTTPS (with certs) or HTTP | HTTP only |
| **SSL Certs** | Auto-detects cert.pem/key.pem | N/A (ngrok provides HTTPS) |
| **Port** | 8080 | 8080 |
| **Graceful Shutdown** | ✅ YES | ✅ YES |
| **PM2 Ready Signal** | ✅ YES | ✅ YES |
| **Static Files** | ❌ NO | ✅ YES (from public/) |

---

## Current Configuration

### PM2 Production (Recommended)

**Uses**: `server.cjs` (HTTPS version)

```bash
npm run pm2:start
# or
pm2 start ecosystem.config.js
```

**Why**: Best for Raspberry Pi local network deployment with optional HTTPS support.

### Development Scripts

**Regular Dev** (uses `server.cjs`):
```bash
npm run dev
# or
npm run dev:video
```

**Ngrok Dev** (uses `server-ngrok.cjs`):
```bash
npm run dev:ngrok
# or
npm run dev:video:ngrok
```

---

## SSL Certificate Setup

### For HTTPS Support (server.cjs)

The HTTPS server automatically detects SSL certificates:

**Certificate Location**: `backend/videochat-server/`
- `cert.pem` - SSL certificate
- `key.pem` - Private key

**Auto-Detection**:
- ✅ **Certs found** → Uses HTTPS
- ❌ **Certs missing** → Falls back to HTTP (with warning)

### Generate Self-Signed Certificates (Development)

```bash
cd backend/videochat-server

# Generate self-signed certificate (valid 365 days)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

**Note**: Self-signed certificates will show browser warnings. For production, use certificates from Let's Encrypt or your certificate authority.

### Production Certificates

For Raspberry Pi on local network:
1. Use Let's Encrypt with Certbot
2. Or use your organization's certificates
3. Or use ngrok for public HTTPS (uses `server-ngrok.cjs`)

---

## Port Configuration

Both servers use **port 8080** (configured via `VIDEO_PORT` environment variable).

**Change port** in:
1. `.env` file: `VIDEO_PORT=8080`
2. `ecosystem.config.js`: `VIDEO_PORT: 8080`

---

## Graceful Shutdown

Both servers now support graceful shutdown:

**When PM2 sends SIGTERM or SIGINT**:
1. Close all WebSocket client connections
2. Close WebSocket server
3. Close HTTP/HTTPS server
4. Exit cleanly (or force exit after 5 seconds)

**Test graceful shutdown**:
```bash
pm2 stop betti-webrtc
# Check logs
pm2 logs betti-webrtc --lines 20
```

---

## Which Server to Use?

### Use `server.cjs` (HTTPS) When:
- ✅ Running on Raspberry Pi local network
- ✅ You have SSL certificates (or can generate them)
- ✅ Accessing from same local network
- ✅ Want auto-detection of HTTPS/HTTP

**PM2 Config**: ✅ Already configured (default)

### Use `server-ngrok.cjs` (HTTP) When:
- ✅ Using ngrok for public internet access
- ✅ Need ngrok to provide HTTPS layer
- ✅ Serving static files from `public/` directory
- ✅ Don't have/need local SSL certificates

**PM2 Config**: Create `ecosystem.ngrok.config.js` (optional)

---

## Switching Between Servers

### Option 1: Edit ecosystem.config.js

Change the script path for `betti-webrtc`:

**For HTTPS** (current default):
```javascript
script: './backend/videochat-server/server.cjs',
```

**For Ngrok**:
```javascript
script: './backend/videochat-server/server-ngrok.cjs',
```

### Option 2: Use Different PM2 Configs

**Create** `ecosystem.ngrok.config.js` for ngrok deployment:
```javascript
// Copy ecosystem.config.js and change video server to server-ngrok.cjs
```

**Start with specific config**:
```bash
# HTTPS version
pm2 start ecosystem.config.js

# Ngrok version
pm2 start ecosystem.ngrok.config.js
```

---

## Troubleshooting

### Server won't start in HTTPS mode

**Check certificates exist**:
```bash
ls -la backend/videochat-server/*.pem
```

**Expected output**:
```
cert.pem
key.pem
```

**If missing**: Server automatically falls back to HTTP (check logs).

### Browser shows "Not Secure" warning

**Cause**: Using self-signed certificate

**Solutions**:
1. Accept the warning (development only)
2. Use Let's Encrypt for production
3. Use ngrok (switches to `server-ngrok.cjs`)

### Can't connect from remote device

**HTTPS mode**:
- Make sure firewall allows port 8080
- Use device's local IP: `https://192.168.1.x:8080`
- Accept certificate warning on client device

**HTTP mode**:
- WebRTC camera access requires HTTPS on remote devices
- Use ngrok: `https://your-url.ngrok-free.app`

---

## Summary

**Current Setup** (Recommended for Raspberry Pi):
```
PM2 → server.cjs (HTTPS with auto-detection)
Dev → npm run dev (uses server.cjs)
Dev Ngrok → npm run dev:ngrok (uses server-ngrok.cjs)
```

**Both servers now have**:
- ✅ Graceful shutdown handlers
- ✅ PM2 ready signals
- ✅ WebSocket cleanup on exit
- ✅ 5-second shutdown timeout

---

**Last Updated**: December 2024
