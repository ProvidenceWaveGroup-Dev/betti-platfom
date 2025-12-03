# Betti Platform Infrastructure Map

Complete guide to server locations, database storage, and data architecture.

---

## 📂 Project Structure Overview

```
betti-platform/
├── backend/                    # Backend services
│   ├── src/                   # Source code
│   │   ├── index.js          # Main backend server
│   │   ├── nutrition-server.js  # Nutrition API server
│   │   ├── services/          # Business logic
│   │   │   └── database.js   # Database singleton & repositories
│   │   ├── routes/           # API endpoints
│   │   ├── schema/           # Database schemas
│   │   ├── migrations/       # Database migrations
│   │   └── data/             # ⚠️ EMPTY - Not used
│   ├── data/                 # ✅ ACTIVE DATABASE LOCATION
│   │   ├── betti.db         # Main SQLite database (232 KB)
│   │   ├── betti.db-shm     # WAL shared memory (32 KB)
│   │   └── betti.db-wal     # Write-ahead log (2.2 MB)
│   ├── videochat-server/    # Video chat signaling servers
│   │   ├── server.cjs       # HTTPS/SSL version (primary)
│   │   ├── server-ngrok.cjs # Ngrok HTTP version (alternative)
│   │   ├── cert.pem         # SSL certificate
│   │   └── key.pem          # SSL private key
│   ├── betti.db             # ⚠️ OLD DATABASE (252 KB - legacy)
│   ├── .env                 # Backend environment variables
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── main.jsx       # Frontend entry point
│   │   ├── App.jsx        # Main app component
│   │   ├── components/    # React components
│   │   └── data/          # ⚠️ MOCK DATA (development only)
│   │       ├── appointments.json
│   │       ├── vitals.json
│   │       ├── fitness.json
│   │       └── ...
│   ├── .env               # Frontend environment variables
│   └── package.json
├── logs/                  # PM2 log files
├── ecosystem.config.js    # PM2 configuration
└── package.json          # Root workspace config
```

---

## 🖥️ Server Locations & Ports

### 1. Main Backend Server
**File**: `backend/src/index.js`
**Port**: 3001
**Type**: Express + WebSocket
**Database**: Uses `backend/data/betti.db`

**Features**:
- REST API endpoints
- WebSocket for real-time updates
- BLE device scanning
- Vitals tracking
- Medication management
- Appointments API
- Hydration tracking API
- Fitness tracking

**Start Command**:
- Dev: `npm run dev:backend`
- PM2: Managed as `betti-backend`

---

### 2. Nutrition API Server
**File**: `backend/src/nutrition-server.js`
**Port**: 3002
**Type**: Express REST API
**Database**: Uses `backend/data/betti.db` (shared)

**Features**:
- Nutrition tracking endpoints
- Meal logging
- Foods database
- Nutrition goals

**Start Command**:
- Dev: `npm run dev:nutrition`
- PM2: Managed as `betti-nutrition`

---

### 3. Video Chat Server (HTTPS) ⭐ PRIMARY
**File**: `backend/videochat-server/server.cjs`
**Port**: 8080
**Type**: HTTPS/HTTP + WebSocket
**Database**: None (stateless)
**SSL**: Auto-detects `cert.pem` and `key.pem`

**Features**:
- WebRTC signaling
- Room-based video calls (2 participants max)
- Auto HTTPS/HTTP detection

**Start Command**:
- Dev: `npm run dev:video`
- PM2: Managed as `betti-webrtc`

---

### 4. Video Chat Server (Ngrok) - ALTERNATIVE
**File**: `backend/videochat-server/server-ngrok.cjs`
**Port**: 8080
**Type**: HTTP + WebSocket
**Database**: None (stateless)

**Features**:
- WebRTC signaling for ngrok
- Static file serving
- Designed for ngrok HTTPS layer

**Start Command**:
- Dev: `npm run dev:video:ngrok`
- PM2: Not configured (alternative)

---

### 5. Frontend Vite Server
**File**: `frontend/src/main.jsx`
**Port**: 5173
**Type**: Vite dev/production server
**Database**: None (connects to backend APIs)

**Features**:
- React application
- Hot module replacement
- PWA support

**Start Command**:
- Dev: `npm run dev:frontend`
- PM2: Managed as `betti-frontend`

---

## 🗄️ Database Architecture

### SQLite Database (Primary Data Store)

**Active Database**:
```
📁 backend/data/betti.db  (232 KB)
├── betti.db-shm          (32 KB - WAL shared memory)
└── betti.db-wal          (2.2 MB - Write-ahead log)
```

**Location**: `C:\Users\AMI Server\Documents\betti-platform\backend\data\betti.db`

**Access Mode**: WAL (Write-Ahead Logging)
**Configured In**: `backend/src/services/database.js` (line 22)

**Schema Source**: `backend/src/schema/betti-schema.sql`

---

### Database Tables (23 Total)

#### User & Settings
1. **users** - User accounts
2. **user_settings** - User preferences
3. **emergency_contacts** - Emergency contact info

#### Health & Vitals
4. **vital_readings** - Blood pressure, heart rate, temperature, etc.
5. **hydration_log** - Water intake tracking
6. **hydration_goals** - Daily hydration goals

#### Nutrition
7. **foods** - Food database
8. **meals** - Meal records
9. **meal_foods** - Junction table (meals ↔ foods)
10. **nutrition_goals** - Daily nutrition targets
11. **recent_foods** - Recently logged foods

#### Medications
12. **medications** - Medication database
13. **medication_schedules** - Dosing schedules
14. **medication_log** - Medication intake log

#### Fitness
15. **workouts** - Exercise sessions
16. **daily_activity** - Step count, calories, etc.

#### Appointments
17. **appointments** - Calendar events and appointments

#### BLE & Devices
18. **ble_devices** - Bluetooth LE devices
19. **ble_scan_log** - BLE scan history

#### Communication
20. **video_calls** - Video call history
21. **alerts** - System notifications

#### System
22. **system_config** - System configuration
23. **sync_status** - Data synchronization status

---

### Database Access

**Shared by**:
- Main Backend Server (port 3001)
- Nutrition API Server (port 3002)

**Connection**:
- Singleton pattern in `database.js`
- WAL mode for concurrent reads
- Foreign keys enabled
- Synchronous mode: NORMAL

**Initialization**:
```javascript
// backend/src/services/database.js
const dbPath = join(__dirname, '../../data/betti.db')
db = new Database(dbPath)
```

---

## 📊 Legacy & Unused Databases

### ⚠️ Old Database Location
**File**: `backend/betti.db` (252 KB)
**Status**: Legacy - Not used by current code
**Action**: Can be safely deleted after backup

### ⚠️ Empty Database
**File**: `backend/src/data/betti.db` (0 bytes)
**Status**: Empty - Not used
**Action**: Can be deleted

---

## 📄 JSON Data Files (Development/Mock Data)

### Backend Data Files
**Location**: `backend/src/data/`

1. **foods-database.json** (2.4 KB) - Foods reference data
2. **meals.json** (11 KB) - Sample meal data
3. **nutrition.json** (637 bytes) - Nutrition goals

**Status**: Legacy - Data now in SQLite database

---

### Frontend Data Files (Mock Data)
**Location**: `frontend/src/data/`

1. **appointments.json** (918 bytes) - Sample appointments
2. **exercises-database.json** (5.6 KB) - Exercise reference
3. **fitness.json** (1.5 KB) - Sample fitness data
4. **fitness-extended.json** (5.2 KB) - Extended fitness data
5. **foods-database.json** (2.4 KB) - Foods reference
6. **meals.json** (65 bytes) - Sample meals
7. **nutrition.json** (3.6 KB) - Nutrition data
8. **vitals.json** (785 bytes) - Sample vitals

**Status**: Development mock data - Frontend now uses API calls

**Usage**: Fallback data during development when API is unavailable

---

## 🗂️ Schema & Migrations

### Schema Files
**Location**: `backend/src/schema/`

1. **betti-schema.sql** (21 KB) - Main database schema
2. **medication-migration.sql** (2.0 KB) - Medication updates
3. **per-day-dosing-migration.sql** (1.8 KB) - Dosing schedule updates

### Migrations
**Location**: `backend/src/migrations/`

1. **add-appointment-columns.js** - Appointment schema updates

---

## ⚙️ Configuration Files

### Backend Configuration
**File**: `backend/.env`
**Template**: `backend/.env.example`

```env
PORT=3001                    # Backend API port
HOST=0.0.0.0                # Bind to all interfaces
NODE_ENV=development        # Environment
CORS_ORIGIN=http://localhost:5173
SENSOR_UPDATE_INTERVAL=5000
NUTRITION_PORT=3002         # Nutrition API port
VIDEO_PORT=8080             # Video chat port
```

### Frontend Configuration
**File**: `frontend/.env`

```env
VITE_API_URL=http://localhost:3001
VITE_NUTRITION_API_URL=http://localhost:3002
VITE_VIDEO_SERVER_URL=10.0.0.232:8080
```

### PM2 Configuration
**File**: `ecosystem.config.js` (root)

Defines all 4 production servers with:
- Memory limits
- Auto-restart
- Log rotation
- Environment variables

---

## 📡 Data Flow Architecture

### Write Operations
```
Frontend → Backend API (3001/3002) → SQLite Database (backend/data/betti.db)
```

### Read Operations
```
Frontend → Backend API (3001/3002) → SQLite Database (backend/data/betti.db) → Frontend
```

### Real-time Updates
```
Backend (3001) → WebSocket → Frontend (updates in real-time)
```

### BLE Device Data
```
BLE Device → Backend BLE Scanner → Database → WebSocket → Frontend
```

---

## 🔐 SSL Certificates (Video Chat)

**Location**: `backend/videochat-server/`

- **cert.pem** (2.1 KB) - SSL certificate
- **key.pem** (3.3 KB) - Private key

**Used By**: `server.cjs` (HTTPS video server)
**Auto-Detection**: Falls back to HTTP if missing

---

## 📋 Data Storage Summary

| Type | Location | Size | Status |
|------|----------|------|--------|
| **Primary Database** | `backend/data/betti.db` | 232 KB | ✅ Active |
| **WAL Log** | `backend/data/betti.db-wal` | 2.2 MB | ✅ Active |
| **WAL Shared Memory** | `backend/data/betti.db-shm` | 32 KB | ✅ Active |
| **Old Database** | `backend/betti.db` | 252 KB | ⚠️ Legacy |
| **Empty Database** | `backend/src/data/betti.db` | 0 KB | ⚠️ Unused |
| **Backend JSON Data** | `backend/src/data/*.json` | ~14 KB | ⚠️ Legacy |
| **Frontend Mock Data** | `frontend/src/data/*.json` | ~20 KB | 🔧 Dev Only |
| **SSL Certificates** | `backend/videochat-server/*.pem` | ~5 KB | ✅ Active |

---

## 🧹 Cleanup Recommendations

### Safe to Delete
1. ✅ `backend/betti.db` - Old database location (after backup)
2. ✅ `backend/src/data/betti.db` - Empty database file
3. ⚠️ `backend/src/data/*.json` - Legacy JSON data (keep as backup)

### Keep for Development
1. ✅ `frontend/src/data/*.json` - Mock data for development
2. ✅ `backend/data/betti.db*` - Active database files

---

## 🚀 Quick Reference

### Server Start Locations

| Server | Entry Point | Database Access |
|--------|-------------|-----------------|
| Main Backend | `backend/src/index.js` | ✅ Yes (`backend/data/betti.db`) |
| Nutrition API | `backend/src/nutrition-server.js` | ✅ Yes (shared) |
| Video (HTTPS) | `backend/videochat-server/server.cjs` | ❌ No |
| Video (Ngrok) | `backend/videochat-server/server-ngrok.cjs` | ❌ No |
| Frontend | `frontend/src/main.jsx` | ❌ No (uses APIs) |

### Database Repository Access

**File**: `backend/src/services/database.js`

All database operations go through repository patterns:
- `WorkoutRepo` - Fitness data
- `MedicationRepo` - Medication data
- `AppointmentRepo` - Appointment data
- `VitalsRepo` - Vital signs
- Direct SQL for other tables

---

**Last Updated**: December 2024
**Database Schema Version**: 23 tables
**Total Servers**: 5 (4 active in PM2)
