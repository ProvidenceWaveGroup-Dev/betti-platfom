# Betti Smart Mirror Hub - Architecture Documentation

> Generated: December 1, 2025
> Version: 0.1.0

## Executive Summary

The Betti Smart Mirror Hub is a full-stack health and wellness IoT platform designed for 13.3" touchscreen displays (1920x1080). It employs a sophisticated 4-server architecture with npm workspaces, React frontend, Node.js/Express backend, separate nutrition service, and a dedicated WebRTC video chat signaling server. The platform features real-time Bluetooth LE device scanning, comprehensive health tracking (vitals, nutrition, fitness, hydration, medication), and responsive mobile/desktop layouts.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Communication Flow](#4-communication-flow)
5. [External Dependencies](#5-external-dependencies)
6. [Security & Configuration](#6-security--configuration)
7. [Data Models](#7-data-models)
8. [Architecture Diagram](#8-architecture-diagram)

---

## 1. Project Structure

### Directory Layout

```
betti-platform/
├── frontend/                          # React application workspace
│   ├── public/                       # Static assets
│   │   ├── manifest.json            # PWA manifest
│   │   ├── sw.js                    # Service worker
│   │   └── mobile-test.html         # Mobile testing HTML
│   ├── src/
│   │   ├── App.jsx                  # Main app with panel state management
│   │   ├── main.jsx                 # Entry point with SW registration
│   │   ├── components/              # Reusable React components (16 files)
│   │   ├── layouts/                 # Layout components (mobile)
│   │   ├── screens/                 # Full-screen mobile views (8 files)
│   │   ├── services/                # API client services
│   │   ├── utils/                   # Utility functions
│   │   ├── data/                    # Static JSON data files
│   │   └── styles/                  # SCSS styles
│   ├── vite.config.js               # Standard dev config
│   ├── vite.config.ngrok.js         # Ngrok-specific config
│   └── package.json                 # Frontend dependencies
│
├── backend/                          # Express API server workspace
│   ├── src/
│   │   ├── index.js                 # Main server (port 3001)
│   │   ├── nutrition-server.js      # Nutrition API server (port 3002)
│   │   ├── routes/                  # Express route handlers
│   │   ├── services/                # Business logic services
│   │   └── data/                    # Persistent JSON data
│   ├── videochat-server/            # WebRTC signaling server
│   │   ├── server.cjs               # HTTPS WebSocket server (port 8080)
│   │   ├── server-ngrok.cjs         # Ngrok variant (HTTP mode)
│   │   ├── cert.pem                 # SSL certificate
│   │   └── key.pem                  # SSL private key
│   ├── .env                         # Environment configuration
│   └── package.json                 # Backend dependencies
│
├── docs/                            # Documentation
├── package.json                     # Root workspace definition
└── CLAUDE.md                        # AI assistant instructions
```

### NPM Workspaces

```json
{
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "concurrently (all 4 servers)",
    "dev:frontend": "frontend only",
    "dev:backend": "backend only",
    "dev:nutrition": "nutrition server only",
    "dev:video": "video chat server only",
    "build": "build both workspaces"
  }
}
```

---

## 2. Backend Architecture

### Server Overview

| Server | Port | Protocol | File | Purpose |
|--------|------|----------|------|---------|
| **Main Backend** | 3001 | HTTP + WS | `backend/src/index.js` | API + BLE WebSocket |
| **Nutrition** | 3002 | HTTP | `backend/src/nutrition-server.js` | Nutrition tracking API |
| **Video Chat** | 8080 | HTTPS + WSS | `backend/videochat-server/server.cjs` | WebRTC signaling |

### 2.1 Main Backend Server (Port 3001)

**Technology**: Express.js + WebSocket (ws library)

**REST Endpoints:**
```
GET  /api/health          - Health check with WebSocket client count
POST /api/ble/scan        - Start 30-second BLE device scan
GET  /api/ble/status      - Get current BLE scan status
```

**WebSocket Events Broadcasted:**
- `ble-state` - Bluetooth adapter state (poweredOn/poweredOff)
- `ble-device` - New/updated BLE device discovered
- `ble-scan-status` - Scan progress (scanning/idle/error)
- `connection` - Client connection confirmation

### 2.2 BLE Scanner Service

**File**: `backend/src/services/bleScanner.js`
**Library**: @abandonware/noble
**Pattern**: Singleton EventEmitter

```javascript
// Device Object Structure
{
  id: string,              // Normalized MAC (hex, lowercase, no colons)
  name: string,            // Device name or address
  address: string,         // Uppercase MAC with colons
  rssi: number,            // Signal strength (-50 to -100+)
  lastSeen: ISO string,    // Discovery timestamp
  manufacturer: null       // Reserved for future
}
```

### 2.3 Nutrition Server (Port 3002)

**REST Endpoints:**
```
GET    /api/nutrition/daily         - Daily nutrition summary
POST   /api/nutrition/log-meal      - Add meal entry
GET    /api/nutrition/foods         - Search food database
GET    /api/nutrition/goals         - Get nutrition targets
PUT    /api/nutrition/goals         - Update nutrition targets
GET    /api/nutrition/history       - Historical data (7+ days)
DELETE /api/nutrition/meal/:mealId  - Delete meal
GET    /api/nutrition/recent-foods  - Recently used foods
GET    /api/health                  - Service health check
```

### 2.4 Video Chat Server (Port 8080)

**Technology**: Node.js WebSocket (CommonJS)
**Protocol**: HTTPS with self-signed certificates

**WebSocket Message Types:**
```
Client → Server:
  join-room      - Join video room
  offer          - WebRTC SDP offer
  answer         - WebRTC SDP answer
  ice-candidate  - ICE candidate
  leave-room     - Disconnect

Server → Client:
  joined-room    - Room join confirmation
  user-joined    - New participant notification
  user-left      - Participant disconnected
  error          - Error message
```

**Features:**
- Room-based communication (max 2 participants)
- SDP offer/answer exchange
- ICE candidate routing
- Automatic cleanup on disconnect

---

## 3. Frontend Architecture

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| Vite | 5.0.0 | Build tool |
| React Router | 6.18.0 | Client routing |
| SCSS/Sass | 1.94.1 | Styling |
| @vitejs/plugin-basic-ssl | 1.2.0 | Development HTTPS |

### 3.1 Application Entry (`main.jsx`)

- Service worker registration (production only)
- PWA offline capabilities
- Error handling with fallback rendering

### 3.2 Panel State Management (`App.jsx`)

```javascript
// Panel States
panelState: {
  health: 'collapsed',      // Vitals panel
  nutrition: 'collapsed',   // Nutrition tracking
  fitness: 'collapsed',     // Fitness tracking
  hydration: 'collapsed',   // Water intake
  medication: 'collapsed',  // Medication checklist
  appointments: 'collapsed', // Schedule
  sensors: 'hidden',        // BLE devices
  video: 'hidden'           // Video chat
}

// States: 'collapsed' | 'visible' | 'hidden'
```

### 3.3 Layout Modes

**Desktop Single-Panel Layout:**
- Left/right sidebars with collapsed panels
- Center maximized panel (2/3 width)
- Automatic panel splitting

**Mobile Full-Screen Layout:**
```
MobileLayout
├── MobileHeader (sticky top, 80px)
├── Screen Content (scrollable)
└── MobileNav (fixed bottom, 104px)
```

### 3.4 Component Structure

**Desktop Components** (`/components/`):
| Component | Purpose |
|-----------|---------|
| Vitals.jsx | Health metrics (BP, HR, O2, Temp, Weight) |
| Nutrition.jsx | Macronutrient tracking with modals |
| Fitness.jsx | Workout logging with video search |
| Hydration.jsx | Water intake tracking |
| Medication.jsx | Daily medication checklist |
| Appointments.jsx | Schedule management |
| BLEDevices.jsx | Bluetooth device scanner |
| VideoChat.jsx | WebRTC video communication |

**Mobile Screens** (`/screens/`):
| Screen | Purpose |
|--------|---------|
| MobileDashboard | Home/overview |
| MobileHealth | Vitals details |
| MobileNutrition | Meal tracking |
| MobileFitness | Workout logging |
| MobileHydration | Water intake |
| MobileMedication | Medication tracking |
| MobileSchedule | Appointments |
| MobileVideo | Video chat |

### 3.5 Services

**WebSocket Client** (`services/websocket.js`):
```javascript
// Singleton connection to backend
// URL: /ws (proxied to localhost:3001)
// Auto-reconnect: 3 seconds
// Events: connection, ble-device, ble-scan-status, ble-state
```

**Nutrition API** (`services/nutritionApi.js`):
```javascript
// RESTful client for nutrition server
// URL: /api/nutrition (proxied to localhost:3002)
// Methods: getDailySummary, logMeal, searchFoods, etc.
```

### 3.6 Device Detection (`utils/deviceDetection.js`)

**Detection Factors:**
1. User agent regex (iOS, Android, Windows Phone)
2. Touch capability
3. Screen size (<768px = mobile)
4. Aspect ratio (>1.5 = phone)
5. Device pixel ratio adjustment

**Override:** `?mobile=true` URL parameter

---

## 4. Communication Flow

### 4.1 Vite Proxy Configuration

```javascript
// vite.config.js & vite.config.ngrok.js
proxy: {
  '/api/nutrition': {
    target: 'http://localhost:3002',    // Nutrition server
    changeOrigin: true
  },
  '/api': {
    target: 'http://localhost:3001',    // Main backend
    changeOrigin: true
  },
  '/ws': {
    target: 'http://localhost:3001',    // BLE WebSocket
    ws: true,
    rewrite: path => path.replace(/^\/ws/, '')
  },
  '/video': {
    target: 'https://localhost:8080',   // Video WebSocket
    ws: true,
    rewrite: path => path.replace(/^\/video/, '')
  }
}
```

### 4.2 Connection Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  React Components → Services → fetch()/WebSocket()              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VITE DEV SERVER (Port 5173)                   │
│                       Reverse Proxy                              │
├─────────────────────────────────────────────────────────────────┤
│  /api/nutrition/*  →  http://localhost:3002  (Nutrition)        │
│  /api/*            →  http://localhost:3001  (Backend API)      │
│  /ws               →  ws://localhost:3001    (BLE WebSocket)    │
│  /video            →  wss://localhost:8080   (Video WebSocket)  │
└───────┬─────────────────────┬─────────────────────┬─────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   NUTRITION   │     │    BACKEND    │     │  VIDEO CHAT   │
│   Port 3002   │     │   Port 3001   │     │   Port 8080   │
│               │     │               │     │               │
│ REST API      │     │ REST API      │     │ WebSocket     │
│ - /daily      │     │ - /health     │     │ - join-room   │
│ - /log-meal   │     │ - /ble/scan   │     │ - offer       │
│ - /foods      │     │ - /ble/status │     │ - answer      │
│ - /goals      │     │               │     │ - ice-candidate│
│ - /history    │     │ WebSocket     │     │               │
│               │     │ - ble-device  │     │ Room: max 2   │
│               │     │ - ble-state   │     │               │
└───────┬───────┘     └───────┬───────┘     └───────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│  JSON Files   │     │  BLE Scanner  │
│  - meals.json │     │  (@abandonware│
│  - nutrition  │     │   /noble)     │
│  - foods-db   │     │               │
└───────────────┘     └───────┬───────┘
                              │
                              ▼
                      ┌───────────────┐
                      │  Bluetooth    │
                      │   Adapter     │
                      │  (Hardware)   │
                      └───────────────┘
```

### 4.3 WebRTC Video Flow

```
Client A                    Server                    Client B
    │                          │                          │
    │─── join-room ───────────>│                          │
    │<── joined-room ──────────│                          │
    │                          │                          │
    │                          │<───── join-room ─────────│
    │                          │────── joined-room ──────>│
    │<── user-joined ──────────│                          │
    │                          │                          │
    │─── offer ───────────────>│                          │
    │                          │────── offer ────────────>│
    │                          │                          │
    │                          │<───── answer ────────────│
    │<── answer ───────────────│                          │
    │                          │                          │
    │─── ice-candidate ───────>│                          │
    │                          │──── ice-candidate ──────>│
    │                          │                          │
    │<══════════ P2P Media Connection ═══════════════════>│
```

---

## 5. External Dependencies

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.2 | Web framework |
| cors | ^2.8.5 | Cross-origin resource sharing |
| ws | ^8.14.2 | WebSocket server |
| @abandonware/noble | ^1.9.2-26 | Bluetooth LE scanning |
| dotenv | ^16.3.1 | Environment variables |
| nodemon | ^3.0.1 | Dev auto-restart |

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.2.0 | UI library |
| react-dom | ^18.2.0 | DOM rendering |
| react-router-dom | ^6.18.0 | Client routing |
| sass | ^1.94.1 | SCSS compilation |
| vite | ^5.0.0 | Build tool |
| @vitejs/plugin-react | ^4.2.0 | React support |
| @vitejs/plugin-basic-ssl | ^1.2.0 | Dev HTTPS |

### Hardware Requirements

- **Bluetooth LE Adapter**: Required for BLE scanning
- **Camera**: For WebRTC video (requires HTTPS)
- **Network**: For ngrok/remote access

### Third-Party Services

- **STUN Servers**: `stun.l.google.com:19302`, `stun1.l.google.com:19302`
- **Ngrok**: Optional public tunnel (halibut-saved-gannet.ngrok-free.app)

---

## 6. Security & Configuration

### 6.1 SSL/TLS

**Development:**
- Vite basicSsl plugin generates certificates
- Location: `frontend/node_modules/.vite/basic-ssl/`
- Files: `_cert.pem`, `_key.pem`

**Video Server:**
- Pre-generated: `backend/videochat-server/cert.pem`, `key.pem`
- Required for remote WebRTC camera access

### 6.2 CORS Configuration

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'https://halibut-saved-gannet.ngrok-free.app'
]
```

### 6.3 Environment Variables

**Backend `.env`:**
```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
SENSOR_UPDATE_INTERVAL=5000
NUTRITION_PORT=3002
VIDEO_PORT=8080
```

**Frontend `.env`:**
```env
VITE_VIDEO_SERVER_URL=  # Optional direct video server URL
```

---

## 7. Data Models

### 7.1 Meal Entry

```javascript
{
  id: 1763396359826,          // Timestamp-based
  date: "2025-11-17",
  mealType: "breakfast",      // breakfast|lunch|dinner|snack
  time: "9:19 AM",
  foods: [{
    name: "Grilled Chicken",
    category: "meat",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    unit: "serving",
    quantity: 1
  }],
  totalCalories: 165,
  totalProtein: 31,
  totalCarbs: 0,
  totalFat: 3.6,
  totalFiber: 0,
  totalSodium: 0,
  createdAt: "2025-11-17T14:19:59.826Z"
}
```

### 7.2 Nutrition Goals

```javascript
{
  calories: 2200,
  protein: 110,
  carbs: 275,
  fat: 73,
  fiber: 25,
  sodium: 2300
}
```

### 7.3 Daily Summary

```javascript
{
  date: "2025-11-17",
  calories: { consumed: 850, target: 2200, remaining: 1350, percentage: 39 },
  protein: { consumed: 45, target: 110, remaining: 65, percentage: 41 },
  // ... other macros
  todaysMeals: [/* meal entries */]
}
```

### 7.4 BLE Device

```javascript
{
  id: "a1b2c3d4e5f6",        // Hex MAC, lowercase, no colons
  name: "Heart Rate Monitor",
  address: "A1:B2:C3:D4:E5:F6",
  rssi: -65,                 // Signal strength
  lastSeen: "2025-11-17T14:30:00.000Z",
  manufacturer: null
}
```

### 7.5 Vital Signs

```javascript
{
  icon: "❤️",
  label: "Blood Pressure",
  value: "120/80",
  unit: "mmHg",
  status: "Normal",          // Normal|High|Low
  updated: "2 min ago"
}
```

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
│                    ┌────────────────────────────┐                           │
│                    │      NGROK TUNNEL          │                           │
│                    │  halibut-saved-gannet...   │                           │
│                    └─────────────┬──────────────┘                           │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VITE DEV SERVER (Port 5173)                           │
│                            Reverse Proxy                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/nutrition/*  →  localhost:3002  │  /ws     →  ws://localhost:3001    │
│  /api/*            →  localhost:3001  │  /video  →  wss://localhost:8080   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                           REACT FRONTEND                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Desktop Layout                    │ Mobile Layout                    │   │
│  │ ├── Header                        │ ├── MobileHeader                 │   │
│  │ ├── Sidebar (collapsed panels)    │ ├── Active Screen                │   │
│  │ └── Maximized Panel (2/3 width)   │ └── MobileNav (bottom tabs)      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Services: websocket.js | nutritionApi.js | fitnessApi.js                   │
│  Utils: deviceDetection.js | serviceWorker.js                               │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                      │                      │
                    ▼                      ▼                      ▼
        ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
        │   NUTRITION API   │  │   BACKEND API     │  │   VIDEO CHAT      │
        │    Port 3002      │  │    Port 3001      │  │    Port 8080      │
        │                   │  │                   │  │                   │
        │ • /daily          │  │ • /health         │  │ • WebSocket only  │
        │ • /log-meal       │  │ • /ble/scan       │  │ • Room management │
        │ • /foods          │  │ • /ble/status     │  │ • SDP exchange    │
        │ • /goals          │  │                   │  │ • ICE candidates  │
        │ • /history        │  │ WebSocket:        │  │                   │
        │                   │  │ • ble-device      │  │ Max 2 per room    │
        │                   │  │ • ble-state       │  │                   │
        └─────────┬─────────┘  └─────────┬─────────┘  └───────────────────┘
                  │                      │
                  ▼                      ▼
        ┌───────────────────┐  ┌───────────────────┐
        │    JSON FILES     │  │   BLE SCANNER     │
        │                   │  │   (@abandonware/  │
        │ • meals.json      │  │    noble)         │
        │ • nutrition.json  │  │                   │
        │ • foods-db.json   │  │ • 30-sec scan     │
        │                   │  │ • Device discovery│
        └───────────────────┘  └─────────┬─────────┘
                                         │
                                         ▼
                               ┌───────────────────┐
                               │ BLUETOOTH ADAPTER │
                               │    (Hardware)     │
                               └───────────────────┘
```

---

## Quick Reference

### Startup Commands

```bash
npm run dev              # All 4 servers
npm run dev:frontend     # Frontend only (5173)
npm run dev:backend      # Backend only (3001)
npm run dev:nutrition    # Nutrition only (3002)
npm run dev:video        # Video chat only (8080)
npm run build            # Production build
```

### Port Summary

| Port | Service | Protocol |
|------|---------|----------|
| 5173 | Vite Frontend | HTTP |
| 3001 | Backend API | HTTP + WS |
| 3002 | Nutrition API | HTTP |
| 8080 | Video Chat | HTTPS + WSS |

### Proxy Routes

| Path | Target | Type |
|------|--------|------|
| `/api/nutrition/*` | localhost:3002 | HTTP |
| `/api/*` | localhost:3001 | HTTP |
| `/ws` | localhost:3001 | WebSocket |
| `/video` | localhost:8080 | WebSocket |

---

*This document is auto-generated. Last updated: December 1, 2025*
