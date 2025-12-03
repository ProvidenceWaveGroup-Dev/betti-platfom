# Betti Platform Server Analysis

## Complete Server Inventory

### 1. **Main Backend API** (betti-backend)
- **File**: `backend/src/index.js`
- **Port**: 3001
- **Type**: Express + WebSocket server
- **Features**:
  - REST API endpoints
  - WebSocket for real-time updates
  - BLE device scanning
  - Health metrics processing
  - Medication reminders
  - Appointments API
  - Hydration tracking API
  - Vitals database
  - Fitness tracking
- **Graceful Shutdown**: ✅ YES
- **PM2 Ready Signal**: ✅ YES
- **PM2 Configured**: ✅ YES

### 2. **Nutrition API Server** (betti-nutrition)
- **File**: `backend/src/nutrition-server.js`
- **Port**: 3002
- **Type**: Express REST API
- **Features**:
  - Nutrition tracking endpoints
  - Meal logging
  - Foods database
  - Nutrition goals/targets
- **Graceful Shutdown**: ✅ YES
- **PM2 Ready Signal**: ✅ YES
- **PM2 Configured**: ✅ YES

### 3. **Video Chat Server - HTTPS Version** (betti-webrtc)
- **File**: `backend/videochat-server/server.cjs`
- **Port**: 8080
- **Type**: HTTPS/HTTP + WebSocket (WebRTC signaling)
- **Features**:
  - WebRTC signaling for video chat
  - Room-based video calls (2 participants max)
  - **Auto-detects SSL certificates** (cert.pem, key.pem)
  - Falls back to HTTP if no certs found
- **Graceful Shutdown**: ✅ **YES** (UPDATED)
- **PM2 Ready Signal**: ✅ **YES** (UPDATED)
- **PM2 Configured**: ✅ **YES** (UPDATED - Primary server)

### 4. **Video Chat Server - Ngrok Version** (betti-webrtc-ngrok)
- **File**: `backend/videochat-server/server-ngrok.cjs`
- **Port**: 8080
- **Type**: HTTP + WebSocket (WebRTC signaling for ngrok)
- **Features**:
  - WebRTC signaling for video chat
  - Room-based video calls (2 participants max)
  - **Designed for ngrok** (ngrok provides HTTPS)
  - Static file serving from public/ directory
- **Graceful Shutdown**: ✅ YES
- **PM2 Ready Signal**: ✅ YES
- **PM2 Configured**: ⚠️ Alternative (use for ngrok deployment)

### 5. **Frontend Vite Server** (betti-frontend)
- **File**: `frontend/src/main.jsx` (served by Vite)
- **Port**: 5173
- **Type**: Vite development/production server
- **Features**:
  - React application
  - Mobile and desktop layouts
  - PWA support
  - Hot module replacement (dev mode)
- **Graceful Shutdown**: ✅ Handled by Vite
- **PM2 Ready Signal**: ⚠️ N/A (npm script)
- **PM2 Configured**: ✅ YES

---

## Current PM2 Configuration

The `ecosystem.config.js` currently manages **4 apps**:

| App Name | Script | Port | Status |
|----------|--------|------|--------|
| betti-backend | backend/src/index.js | 3001 | ✅ Configured |
| betti-nutrition | backend/src/nutrition-server.js | 3002 | ✅ Configured |
| **betti-webrtc** | **server.cjs** (HTTPS) | 8080 | ✅ Configured ⭐ UPDATED |
| betti-frontend | npm run start (Vite) | 5173 | ✅ Configured |

---

## ✅ Issues RESOLVED

### ~~🔴 Critical Issue: Missing Video Chat Server~~ **FIXED**

**WAS**: Two video chat server variants, only one in PM2

**NOW**:
- ✅ **server.cjs** (HTTPS/SSL version) - **IN PM2** (primary)
- ✅ **server-ngrok.cjs** (ngrok HTTP version) - Available as alternative

**Result**:
- ✅ Dev and production now use same server (`server.cjs`)
- ✅ Ngrok version available via `dev:ngrok` script
- ✅ Consistency achieved

### ~~🟡 Secondary Issue: server.cjs Missing Graceful Shutdown~~ **FIXED**

**ADDED to server.cjs**:
- ✅ Graceful shutdown handlers (SIGTERM, SIGINT)
- ✅ PM2 ready signal (`process.send('ready')`)
- ✅ Proper WebSocket cleanup on shutdown
- ✅ 5-second shutdown timeout

**Result**: Server shuts down cleanly in all scenarios.

---

## Recommendations

### Option 1: Standardize on Ngrok Version (Recommended for Ngrok Deployment)

**Use `server-ngrok.cjs` everywhere:**

✅ **Pros**:
- Already has graceful shutdown
- Already has PM2 ready signal
- Works with ngrok
- Consistent dev and prod

❌ **Cons**:
- Requires ngrok for HTTPS (or reverse proxy)
- No local HTTPS support

**Action**: Update `package.json` dev script to use ngrok version:
```json
"dev:video": "cd backend/videochat-server && set VIDEO_PORT=8080 && node server-ngrok.cjs"
```

### Option 2: Standardize on HTTPS Version (Recommended for Local Deployment)

**Use `server.cjs` everywhere:**

✅ **Pros**:
- Auto-detects SSL certs (HTTPS when available)
- Falls back to HTTP gracefully
- No ngrok dependency
- Better for local Raspberry Pi deployment

❌ **Cons**:
- **Needs graceful shutdown added** (I can do this)
- **Needs PM2 ready signal added** (I can do this)
- Requires SSL certificates for HTTPS

**Action**:
1. Add graceful shutdown to `server.cjs`
2. Add PM2 ready signal to `server.cjs`
3. Update PM2 config to use `server.cjs` instead of `server-ngrok.cjs`

### Option 3: Keep Both (Most Flexible)

**Have PM2 profiles for both deployment types:**

✅ **Pros**:
- Maximum flexibility
- Choose at deployment time
- Support both ngrok and local HTTPS

❌ **Cons**:
- More complex configuration
- Need to maintain both versions

**Action**: Create two PM2 configs:
- `ecosystem.config.js` - For local HTTPS (uses server.cjs)
- `ecosystem.ngrok.config.js` - For ngrok (uses server-ngrok.cjs)

---

## My Recommendation

**Choose Option 2** - Standardize on `server.cjs` (HTTPS version) because:

1. **Raspberry Pi deployment** - Better suited for local network deployment
2. **Auto-detects environment** - Uses HTTPS when certs available, HTTP otherwise
3. **Simpler** - One video chat server to maintain
4. **SSL already configured** - You have cert.pem and key.pem in the directory

**I can update server.cjs right now to add:**
- Graceful shutdown handlers
- PM2 ready signal
- WebSocket cleanup on shutdown

Then update the PM2 config to use server.cjs instead of server-ngrok.cjs.

---

## Summary Table

| Server | Port | PM2 Name | Current Status | Production Ready |
|--------|------|----------|----------------|------------------|
| Main Backend | 3001 | betti-backend | ✅ Configured | ✅ YES |
| Nutrition API | 3002 | betti-nutrition | ✅ Configured | ✅ YES |
| Video (HTTPS) | 8080 | betti-webrtc | ✅ Configured ⭐ PRIMARY | ✅ YES |
| Video (Ngrok) | 8080 | - | ⚠️ Alternative | ✅ YES (for ngrok) |
| Frontend | 5173 | betti-frontend | ✅ Configured | ✅ YES |

**Total Servers**: 5 (but only 4 run at once - HTTPS video is primary, ngrok is alternative)

---

## ✅ Implementation Complete

**Selected**: Option 2 - Use HTTPS version (`server.cjs`) as primary

**Changes Made**:

1. ✅ Updated `server.cjs`:
   - Added graceful shutdown handlers
   - Added PM2 ready signal
   - Added WebSocket cleanup on exit

2. ✅ Updated `ecosystem.config.js`:
   - Changed from `server-ngrok.cjs` to `server.cjs`
   - Updated description to note HTTPS with SSL auto-detection

3. ✅ Documentation Created:
   - `VIDEO_SERVER_CONFIG.md` - Video server configuration guide
   - Updated `SERVER_ANALYSIS.md` - This file

**Result**: Production-ready PM2 setup for Raspberry Pi deployment with HTTPS support.
