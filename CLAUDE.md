# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Betti Smart Mirror Hub is a full-stack IoT application designed for a 13.3" touchscreen display (1920x1080). The project uses npm workspaces to manage a React frontend and Node.js backend. Target hardware is a Raspberry Pi or similar with BLE adapter and touchscreen.

## Quick Start (Windows)

```batch
start-betti.bat               # Start all services (local development)
start-betti-tunnel.bat        # Start with Cloudflare tunnel (external/mobile access)
kill-betti.bat                # Stop all Node.js processes
```

## Development Commands

```bash
npm run install:all          # Install all dependencies (root + workspaces)
npm run dev                   # Run frontend + backend + video server concurrently
npm run dev:frontend          # Frontend only (https://localhost:5173)
npm run dev:backend           # Backend only (http://localhost:3001)
npm run dev:video             # Video chat server only (port 8080)
```

### External Access with Cloudflare Tunnel
For remote access (mobile testing, external devices), use Cloudflare tunnel:
```bash
cloudflared tunnel --url https://localhost:5173 --no-tls-verify
```
This creates a public URL that proxies to your local HTTPS dev server.

### Building & Production
```bash
npm run build                 # Build both frontend and backend
npm run pm2:start             # Start all servers with PM2
npm run pm2:logs              # View combined PM2 logs (stored in ./logs/)
npm run pm2:status            # Check process status
```

## Architecture

### 3-Server Architecture (npm workspaces monorepo)
| Server | Port | Entry Point | Runtime |
|--------|------|-------------|---------|
| Frontend | 5173 | `frontend/src/main.jsx` | Vite + React 18 |
| Backend API | 3001 | `backend/src/index.js` | Express 4, ES modules |
| Video Chat | 8080 | `backend/videochat-server/server.cjs` | WebSocket, CommonJS |

### Communication Patterns
- **REST API** (`/api/*`): ble, vitals, fitness, medications, appointments, hydration, nutrition, accelerometer
- **WebSocket** (port 3001): Real-time sensor data, medication reminders, vital updates
  - Frontend auto-reconnects with 3-second interval
  - Message types: `connection`, `ble-*`, `vital-*`, `medication-*`, `halo-*`
- **Video Chat**: WebRTC signaling via WebSocket on port 8080, room-based (max 2 participants)

### Bluetooth LE Integration
All BLE services use singleton pattern with EventEmitter for decoupled WebSocket broadcasting.

| Service | File | Purpose |
|---------|------|---------|
| BLE Scanner | `bleScanner.js` | Device discovery via `@abandonware/noble`, 30s scan duration |
| Health Processor | `bleHealthProcessor.js` | Heart rate, BP, SpO2, scales, thermometers, glucose (5s debounce) |
| Fitness Processor | `bleFitnessProcessor.js` | Steps, HR, calories, distance from fitness bands |
| Connection Manager | `bleConnectionManager.js` | Persistent connections, 15s polling for on-demand advertisers |
| Halo Processor | `bleHaloProcessor.js` | Environmental sensor: temp, humidity, light, IMU/accelerometer |

**GATT Service UUIDs**: `0x180D` (HR), `0x1810` (BP), `0x181A` (Environmental Sensing)

### Halo Environmental Sensor
The Halo sensor (`halo_test` device name) provides environmental monitoring:
- **Temperature/Humidity**: Standard Environmental Sensing Service (0x181A)
- **Ambient Light**: Custom characteristic (c8546913-bfd9-45eb-8dde-9f8754f4a32e)
- **Accelerometer (IMU)**: Custom service with notifications for motion detection
- **Polling Interval**: 5 seconds for environmental data, real-time for IMU
- **Data Storage**: `EnvironmentalRepo.js` stores readings in `environmental_readings` table
- **Accelerometer Recording**: Frontend can record 10s of IMU data, saved as CSV via `/api/accelerometer/save`

## Configuration

### Environment Variables
**Backend** (`backend/.env` - copy from `.env.example`):
- `PORT` (3001), `HOST` (0.0.0.0), `NODE_ENV`, `CORS_ORIGIN` (http://localhost:5173)
- `VIDEO_PORT` (8080), `MEDICATION_REMINDERS_ENABLED` (true)

**Frontend** (`frontend/.env`):
- `VITE_VIDEO_SERVER_URL` - Video server URL for LAN access (e.g., "10.0.0.232:8080")

### SSL/HTTPS
- Vite uses `@vitejs/plugin-basic-ssl` for HTTPS development
- Video chat server requires `cert.pem`/`key.pem` for WebRTC camera access (falls back to HTTP if missing)

## Database Architecture

### SQLite (`better-sqlite3`)
- **File**: `backend/data/betti.db` (auto-created)
- **Schema**: `backend/src/schema/betti-schema.sql`
- **Config**: WAL mode, foreign keys enabled
- **Single-User Mode**: `DEFAULT_USER_ID = 1` throughout

### Repository Pattern (`backend/src/repos/`)
| Repo | Purpose |
|------|---------|
| VitalsRepo | Health metrics (BP, HR, SpO2, temp, weight, glucose) |
| BleDevicesRepo | Device registry with MAC normalization (`A1:B2:C3:D4:E5:F6` → `a1b2c3d4e5f6`) |
| EnvironmentalRepo | Halo sensor readings (temp, humidity, light, IMU) |
| WorkoutRepo | Workouts and daily activity summaries |
| MedicationRepo | Schedules, logging, adherence tracking |

### Key Tables
`vital_readings`, `ble_devices`, `medications` + `medication_schedules` + `medication_log`, `workouts` + `daily_activity`, `meals` + `meal_foods` + `foods`, `environmental_readings`, `alerts`

## Key Implementation Details

### Medication Reminder System (`medicationReminder.js`)
Background service checking every 60 seconds:
- Reminder 5 min before, marks "late" after 30 min
- WebSocket events: `medication-reminder`, `medication-due`, `medication-late`
- Supports daily, day-specific (Mon/Wed/Fri), interval, and PRN schedules
- Deduplicates reminders within 24 hours

### UI Architecture
**Desktop** (`App.jsx`): Panel state management (`collapsed`/`visible`/`hidden`)
- Single maximized panel (2/3 width) with collapsed sidebar
- Overview mode shows all panels as tiles

**Mobile**: Automatic detection via `deviceDetection.js`
- Separate screen components (`Mobile*.jsx`) with bottom nav
- Force mobile: `?mobile=true` URL parameter

### Frontend Components (`frontend/src/components/`)
Health tracking: `Nutrition.jsx`, `Fitness.jsx`, `Hydration.jsx`, `Medication.jsx`, `HaloSensor.jsx`

### WebSocket Client (`frontend/src/services/websocket.js`)
Singleton with EventEmitter pattern, auto-reconnects every 3 seconds.

## Development Notes

### Source Code Locations
- `backend/src/` - Backend (ES modules)
- `frontend/src/` - React components
- `backend/videochat-server/` - Video server (CommonJS)
- `backend/src/services/` - BLE processors, database, medication reminders
- `backend/src/repos/` - Database repositories
- `backend/src/routes/` - Express API routes

### Static Dev Data
- `frontend/src/data/` - appointments.json, vitals.json
- `backend/src/data/` - meals.json, nutrition.json, foods-database.json
- `backend/data/accelerometer/` - Recorded IMU CSV files