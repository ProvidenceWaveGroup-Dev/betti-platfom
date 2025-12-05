# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Betti Smart Mirror Hub is a full-stack IoT application designed for a 13.3" touchscreen display (1920x1080). The project uses npm workspaces to manage a React frontend and Node.js backend.

## Development Commands

### Setup
```bash
npm run install:all          # Install all dependencies (root + workspaces)
```

### Development
```bash
npm run dev                   # Run frontend, backend, nutrition server, and video chat server concurrently
npm run dev:frontend          # Frontend only (http://localhost:5173)
npm run dev:backend           # Backend only (http://localhost:3001)
npm run dev:nutrition         # Nutrition server only
npm run dev:video             # Video chat server only (port 8080)
```

### Building
```bash
npm run build                 # Build both frontend and backend
npm run build:frontend        # Build frontend only (outputs to frontend/dist)
npm run build:backend         # Build backend only
```

### Production
```bash
npm run start:frontend        # Start frontend in production mode
npm run start:backend         # Start backend in production mode
```

### Production (PM2)
```bash
npm run pm2:start             # Start all servers with PM2
npm run pm2:stop              # Stop all servers
npm run pm2:restart           # Restart all servers
npm run pm2:logs              # View combined logs
npm run pm2:monit             # Interactive monitoring dashboard
npm run pm2:status            # Check process status
```

### Development with ngrok (external access/testing)
```bash
npm run dev:ngrok             # Run all servers with ngrok tunneling
npm run dev:frontend:ngrok    # Frontend with ngrok only
npm run dev:video:ngrok       # Video server with ngrok only
```

## Architecture

### Workspace Structure
This is an npm workspaces monorepo with a 4-server architecture:
- `frontend/` - React application built with Vite (port 5173)
- `backend/` - Express API server with WebSocket support (port 3001)
- `backend/src/nutrition-server.js` - Dedicated nutrition API server (port 3002)
- `backend/videochat-server/` - WebRTC signaling server (port 8080)

### Frontend (`@betti/frontend`)
- **Framework**: React 18 with React Router for navigation
- **Build Tool**: Vite 5
- **Dev Server**: Port 5173, bound to all interfaces (host: true) for testing on actual hardware
- **Display Target**: Desktop: 1920x1080 (13.3" touchscreen), Mobile: Responsive
- **CSS Variables**: Screen dimensions pre-configured ($screen-width: 1920px, $screen-height: 1080px)
- **Entry Point**: `frontend/src/main.jsx`
- **Main App**: `frontend/src/App.jsx` - Dynamic component layout with automatic device detection, supporting both desktop panel-based layout and mobile screen-based layout
- **PWA Support**: Service worker registration for offline capabilities (production only)

### Backend (`@betti/backend`)
- **Framework**: Express 4
- **Runtime**: Node.js with ES modules (type: "module")
- **Dev Tool**: Nodemon for auto-restart
- **WebSocket**: ws library for real-time sensor data streaming
- **Default Port**: 3001 (configured via PORT in .env)
- **CORS**: Enabled, defaults to http://localhost:5173
- **Entry Point**: `backend/src/index.js`

### Video Chat Server (`backend/videochat-server/`)
- **Runtime**: Node.js with CommonJS (server.cjs)
- **Framework**: Native WebSocket Server with HTTPS support
- **Default Port**: 8080 (configured via VIDEO_PORT environment variable)
- **SSL Support**: Supports HTTPS with cert.pem and key.pem certificates for WebRTC compatibility
- **Functionality**: WebRTC signaling server for peer-to-peer video communication
- **Room Management**: Supports room-based video chat with up to 2 participants per room

### Communication
- **REST API**: Backend exposes Express endpoints for frontend consumption
  - `/api/health` - Health check with WebSocket client count
  - `/api/ble/scan` (POST) - Start BLE device scanning
  - `/api/ble/status` (GET) - Get current scanning status
  - `/api/nutrition/*` - Nutrition tracking endpoints (meals, foods database)
- **Nutrition Server**: Separate nutrition server (`backend/src/nutrition-server.js`) on port 3002 handles nutrition-specific functionality
- **WebSocket**: Real-time bidirectional communication for sensor data updates
  - WebSocket server runs on same port as HTTP server (3001)
  - Frontend connects via `ws://${window.location.hostname}:3001`
  - Message types: `connection`, `ble-device`, `ble-scan-status`, `medication-reminder`, `medication-due`, `medication-late`, `vitalRecorded`
  - Auto-reconnect logic in frontend with 3-second interval
  - Broadcasts medication reminders and vital readings in real-time
- **Default sensor update interval**: 5000ms (configurable via SENSOR_UPDATE_INTERVAL)

### Bluetooth LE Integration
- **BLE Scanner**: `backend/src/services/bleScanner.js` - Singleton service using `@abandonware/noble` library for device discovery
- **Scan Duration**: 30 seconds (hardcoded in bleScanner.js)
- **Device Discovery**: Uses Noble's peripheral discovery events to detect BLE devices with name, address, and RSSI
- **Event-Driven Architecture**: BLEScanner extends EventEmitter, emitting `bleStateChange`, `bleDeviceDiscovered`, and `bleScanStatus` events
- **WebSocket Broadcasting**: Discovered devices and scan status are broadcast to all connected clients in real-time
- **Frontend WebSocket Client**: `frontend/src/services/websocket.js` - Singleton client with event emitter pattern

### BLE Health Device Integration
- **Health Processor**: `backend/src/services/bleHealthProcessor.js` - Processes BLE health device data
- **Supported Devices**: Heart rate monitors, blood pressure cuffs, pulse oximeters, smart scales, thermometers, glucose monitors
- **Standard GATT Services**: Uses standard BLE health service UUIDs (0x180D for HR, 0x1810 for BP, etc.)
- **Debouncing**: 5-second window to prevent duplicate readings from devices that transmit rapidly
- **Device Registration**: Supports registering known devices with addresses and types
- **Auto-Storage**: Automatically stores vitals in SQLite database via VitalsRepo
- **WebSocket Broadcasts**: Emits `vitalRecorded` events for real-time UI updates

### BLE Fitness Data Processing
- **Fitness Processor**: `backend/src/services/bleFitnessProcessor.js` - Similar architecture for fitness trackers
- **Supported Metrics**: Steps, heart rate, calories, distance from fitness bands/smartwatches

### BLE Connection Manager
- **Service**: `backend/src/services/bleConnectionManager.js` - Background service for persistent device connections
- **Polling Interval**: 15 seconds - continuous scanning for on-demand advertising devices (e.g., UA-651BLE)
- **Connection Flow**: Poll → Scan (30s) → Connect → Discover Services → Subscribe to Characteristics
- **Blood Pressure GATT**: Service UUID `1810`, Characteristic UUID `2a35`
- **Events**: Emits `connection-status`, `connection-error`, `bp-data-received`
- **Singleton Pattern**: Exports singleton instance for consistent state management

## Configuration

### Backend Environment Variables
Copy `backend/.env.example` to `backend/.env` before first run:
- `PORT` - Server port (default: 3001)
- `HOST` - Bind address (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Frontend URL for CORS (default: http://localhost:5173)
- `SENSOR_UPDATE_INTERVAL` - Sensor polling interval in ms (default: 5000)
- `VIDEO_PORT` - Video chat server port (default: 8080)
- `MEDICATION_REMINDERS_ENABLED` - Enable medication reminder service (default: true)

### Frontend Environment Variables
Configure `frontend/.env`:
- `VITE_VIDEO_SERVER_URL` - Video chat server URL (e.g., "10.0.0.232:8080" for local network access)

### Frontend Configuration
Vite configuration in `frontend/vite.config.js`:
- Dev server uses strictPort mode (fails if 5173 is occupied)
- Production builds exclude sourcemaps for smaller bundle size
- SCSS preprocessor configured with screen dimension variables
- SSL support enabled via @vitejs/plugin-basic-ssl for HTTPS development

## Hardware Context

This application is designed to run on a touchscreen-enabled device (likely Raspberry Pi or similar):
- 13.3" display at 1920x1080 resolution
- Landscape orientation
- Touch input enabled
- Bluetooth LE adapter required for device scanning (uses `@abandonware/noble` library)
- SSL certificates (cert.pem/key.pem) required for HTTPS in video chat server for WebRTC camera access on remote devices
- Video chat server automatically falls back to HTTP if SSL certificates are not found (development only)

## Database Architecture

### SQLite Database
The backend uses `better-sqlite3` for local-first data storage with no cloud dependency:
- **Database File**: `backend/data/betti.db` (auto-created from schema)
- **Schema**: `backend/src/schema/betti-schema.sql` - Comprehensive schema with users, vitals, medications, workouts, meals, hydration
- **Database Service**: `backend/src/services/database.js` - Singleton connection manager with repository pattern exports
- **Configuration**: WAL mode for concurrent reads, foreign keys enabled, normal synchronous mode

### Repository Pattern
The database service exports repository objects for data access:
- **WorkoutRepo**: CRUD operations for workouts and daily activity summaries
- **MedicationRepo**: Complex medication management with scheduling, logging, and adherence tracking
- **VitalsRepo**: Health vitals storage (`backend/src/repos/VitalsRepo.js`)
- **BleDevicesRepo**: BLE device management (`backend/src/repos/BleDevicesRepo.js`)
  - MAC normalization: Strips separators and lowercases (e.g., `A1:B2:C3:D4:E5:F6` → `a1b2c3d4e5f6`)
  - Pairing/trusting management with single-device constraint enforcement
  - Device types: `blood_pressure`, `heart_rate`, `scale`, `glucose`, `thermometer`, `unknown`

### Single-User Mode
The application currently operates in single-user mode with `DEFAULT_USER_ID = 1` for all device assignments and data storage.

### Key Tables
- `vital_readings` - Health metrics (BP, HR, SpO2, temp, weight, glucose) with BLE device integration
- `ble_devices` - BLE device registry with pairing status and MAC normalization
- `medications` + `medication_schedules` + `medication_log` - Comprehensive medication tracking system
- `workouts` + `daily_activity` - Fitness tracking with manual and BLE device sources
- `meals` + `meal_foods` + `foods` - Nutrition tracking with food database
- `alerts` - System notifications and reminders

### Database Initialization
The database is initialized in `backend/src/index.js` on server startup using `initDatabase()`. Schema is automatically applied if database doesn't exist.

## Important Implementation Notes

### BLE Architecture Changes
The project recently transitioned from using `bluetoothctl` command-line interface to the `@abandonware/noble` Node.js library for better integration and performance. Key architectural improvements:
- **Decoupled Design**: BLEScanner service is completely decoupled from WebSocket broadcasting via EventEmitter pattern
- **State Management**: Noble handles Bluetooth adapter state changes (`poweredOn`, `poweredOff`, etc.)
- **Real-time Discovery**: Device discovery happens through Noble's event system rather than parsing command output
- **Error Handling**: Improved error handling for Bluetooth state and scanning failures

### Medication Reminder System
A sophisticated background service for medication adherence:
- **Service**: `backend/src/services/medicationReminder.js` - EventEmitter-based singleton
- **Check Interval**: Every 60 seconds
- **Reminder Window**: 5 minutes before scheduled time
- **Late Threshold**: 30 minutes after scheduled time marks medication as "late"
- **WebSocket Events**: Broadcasts `medication-reminder`, `medication-due`, `medication-late` events
- **Alert Storage**: Creates alerts in database for notification history
- **Deduplication**: Tracks sent reminders to avoid duplicates within 24 hours
- **Enable/Disable**: Controlled via `MEDICATION_REMINDERS_ENABLED` environment variable (default: true)

The service integrates with the medication scheduling system to support:
- Daily medications at specific times
- Day-specific schedules (e.g., Mon/Wed/Fri)
- Interval-based schedules (e.g., every 2 days)
- PRN (as-needed) medications with daily limits

### Development Data
- `frontend/src/data/appointments.json` - Static appointment data for development
- `frontend/src/data/vitals.json` - Static vital signs data for development
- `backend/src/data/meals.json` - Nutrition meal tracking data
- `backend/src/data/nutrition.json` - Nutrition goals and targets
- `backend/src/data/foods-database.json` - Foods database for nutrition calculations

### Health & Fitness Tracking Integration
The app features comprehensive health and fitness tracking with multiple interactive components:
- **Nutrition Tracking**: `frontend/src/components/Nutrition.jsx` - Calorie counting, meal logging, and nutrition goals
- **Fitness Tracking**: `frontend/src/components/Fitness.jsx` - Workout logging, exercise tracking with video integration
- **Hydration Tracking**: `frontend/src/components/Hydration.jsx` - Daily water intake monitoring
- **Medication Tracking**: `frontend/src/components/Medication.jsx` - Daily medication checklist
- **Modal Components**: Multiple detail modals for nutrition, fitness, and meal logging with rich UIs

### Mobile UI Architecture
The app features responsive device detection with separate layouts:
- **Device Detection**: `frontend/src/utils/deviceDetection.js` - Detects mobile devices via user agent, touch capability, and screen size
- **Mobile Layout**: `frontend/src/layouts/MobileLayout.jsx` - Container layout with header and bottom navigation
- **Mobile Screens**: `frontend/src/screens/Mobile*.jsx` - Full-screen views for each feature (Dashboard, Health, Nutrition, Fitness, Hydration, Medication, Schedule, Video)
- **Mobile Styles**: `frontend/src/styles/mobile*.scss` - Mobile-specific styling per screen
- **Force Mobile Mode**: URL parameter `?mobile=true` forces mobile layout for testing

### Desktop Panel System
The desktop layout uses a sophisticated panel state management system in `frontend/src/App.jsx`:
- **Panel States**: `collapsed`, `visible`, `hidden` for health, appointments, sensors, video, and all health tracking panels
- **Single Panel Layout**: One maximized panel (2/3 width) with collapsed sidebar panels
- **Overview Layout**: All panels shown as clickable tiles when no panel is maximized
- **Dynamic Layouts**: Automatic panel state management when switching between views

## Development Notes

### Source Code Location

When implementing features, source code should be placed in:
- `backend/src/` - Backend JavaScript files (ES modules)
- `frontend/src/` - Frontend React components and application code
- `backend/videochat-server/` - Video chat server files (CommonJS)

The entry points are:
- Backend: `backend/src/index.js`
- Frontend: `frontend/src/main.jsx`
- Video Chat Server: `backend/videochat-server/server.cjs`