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
npm run dev                   # Run both frontend and backend concurrently
npm run dev:frontend          # Frontend only (http://localhost:5173)
npm run dev:backend           # Backend only (http://localhost:3001)
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

## Architecture

### Workspace Structure
This is an npm workspaces monorepo with two main packages:
- `frontend/` - React application built with Vite
- `backend/` - Express API server with WebSocket support

### Frontend (`@betti/frontend`)
- **Framework**: React 18 with React Router for navigation
- **Build Tool**: Vite 5
- **Dev Server**: Port 5173, bound to all interfaces (host: true) for testing on actual hardware
- **Display Target**: 1920x1080 resolution (13.3" touchscreen)
- **CSS Variables**: Screen dimensions pre-configured ($screen-width: 1920px, $screen-height: 1080px)
- **Entry Point**: `frontend/src/main.jsx`
- **Main App**: `frontend/src/App.jsx` - Simple component layout with Header, Appointments, Vitals, and BLEDevices

### Backend (`@betti/backend`)
- **Framework**: Express 4
- **Runtime**: Node.js with ES modules (type: "module")
- **Dev Tool**: Nodemon for auto-restart
- **WebSocket**: ws library for real-time sensor data streaming
- **Default Port**: 3001 (configured via PORT in .env)
- **CORS**: Enabled, defaults to http://localhost:5173
- **Entry Point**: `backend/src/index.js`

### Communication
- **REST API**: Backend exposes Express endpoints for frontend consumption
  - `/api/health` - Health check with WebSocket client count
  - `/api/ble/scan` (POST) - Start BLE device scanning
  - `/api/ble/status` (GET) - Get current scanning status
- **WebSocket**: Real-time bidirectional communication for sensor data updates
  - WebSocket server runs on same port as HTTP server (3001)
  - Frontend connects via `ws://${window.location.hostname}:3001`
  - Message types: `connection`, `ble-device`, `ble-scan-status`
  - Auto-reconnect logic in frontend with 3-second interval
- **Default sensor update interval**: 5000ms (configurable via SENSOR_UPDATE_INTERVAL)

### Bluetooth LE Integration
- **BLE Scanner**: `backend/src/services/bleScanner.js` - Singleton service using `@abandonware/noble` library for device discovery
- **Scan Duration**: 30 seconds (hardcoded in bleScanner.js)
- **Device Discovery**: Uses Noble's peripheral discovery events to detect BLE devices with name, address, and RSSI
- **Event-Driven Architecture**: BLEScanner extends EventEmitter, emitting `bleStateChange`, `bleDeviceDiscovered`, and `bleScanStatus` events
- **WebSocket Broadcasting**: Discovered devices and scan status are broadcast to all connected clients in real-time
- **Frontend WebSocket Client**: `frontend/src/services/websocket.js` - Singleton client with event emitter pattern

## Configuration

### Backend Environment Variables
Copy `backend/.env.example` to `backend/.env` before first run:
- `PORT` - Server port (default: 3001)
- `HOST` - Bind address (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Frontend URL for CORS (default: http://localhost:5173)
- `SENSOR_UPDATE_INTERVAL` - Sensor polling interval in ms (default: 5000)

### Frontend Configuration
Vite configuration in `frontend/vite.config.js`:
- Dev server uses strictPort mode (fails if 5173 is occupied)
- Production builds exclude sourcemaps for smaller bundle size
- SCSS preprocessor configured with screen dimension variables

## Hardware Context

This application is designed to run on a touchscreen-enabled device (likely Raspberry Pi or similar):
- 13.3" display at 1920x1080 resolution
- Landscape orientation
- Touch input enabled
- Bluetooth LE adapter required for device scanning (uses `@abandonware/noble` library)

## Important Implementation Notes

### BLE Architecture Changes
The project recently transitioned from using `bluetoothctl` command-line interface to the `@abandonware/noble` Node.js library for better integration and performance. Key architectural improvements:
- **Decoupled Design**: BLEScanner service is completely decoupled from WebSocket broadcasting via EventEmitter pattern
- **State Management**: Noble handles Bluetooth adapter state changes (`poweredOn`, `poweredOff`, etc.)
- **Real-time Discovery**: Device discovery happens through Noble's event system rather than parsing command output
- **Error Handling**: Improved error handling for Bluetooth state and scanning failures

### Development Data
- `frontend/src/data/appointments.json` - Static appointment data for development
- `frontend/src/data/vitals.json` - Static vital signs data for development

## Source Code Location

When implementing features, source code should be placed in:
- `backend/src/` - Backend JavaScript files (ES modules)
- `frontend/src/` - Frontend React components and application code

The entry points are:
- Backend: `backend/src/index.js`
- Frontend: `frontend/src/main.jsx`
