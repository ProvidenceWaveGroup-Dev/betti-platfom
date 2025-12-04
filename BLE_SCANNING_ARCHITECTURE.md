# BLE Scanning Architecture - Betti Platform

**Date**: December 4, 2024
**Purpose**: Detailed documentation of BLE scanning implementation for pairing UA-651BLE blood pressure monitor

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [BLE Scanner Service](#ble-scanner-service)
4. [BLE Health Processor](#ble-health-processor)
5. [REST API Endpoints](#rest-api-endpoints)
6. [WebSocket Integration](#websocket-integration)
7. [Database Storage](#database-storage)
8. [Current Device Support](#current-device-support)
9. [Event Flow Diagram](#event-flow-diagram)
10. [Adding New Device Support](#adding-new-device-support)

---

## Architecture Overview

The Betti platform uses a **layered architecture** for BLE device integration:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - WebSocket client receives real-time updates          │
│  - REST API calls to trigger scanning                   │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ WebSocket + REST API
                    │
┌───────────────────▼─────────────────────────────────────┐
│              Backend (Node.js/Express)                   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          WebSocket Broadcast Layer              │    │
│  │  - Real-time event broadcasting to clients      │    │
│  └─────────────┬──────────────────────────────────┘    │
│                │                                         │
│  ┌─────────────▼──────────────┐ ┌──────────────────┐   │
│  │     BLE Scanner Service     │ │  BLE Health      │   │
│  │  (@abandonware/noble)       │ │  Processor       │   │
│  │  - Device discovery         │ │  - Data parsing  │   │
│  │  - Scan management          │ │  - Debouncing    │   │
│  │  - State tracking           │ │  - Validation    │   │
│  └─────────────┬───────────────┘ └────────┬─────────┘   │
│                │                           │             │
│                │ Events                    │ Events      │
│                │                           │             │
│  ┌─────────────▼───────────────────────────▼─────────┐  │
│  │              SQLite Database                       │  │
│  │  - vitals_readings table                          │  │
│  │  - ble_devices table                              │  │
│  │  - ble_scan_log table                             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                    ▲
                    │ Bluetooth LE
                    │
┌───────────────────▼─────────────────────────────────────┐
│           BLE Health Devices (Peripherals)               │
│  - UA-651BLE Blood Pressure Monitor                     │
│  - Heart Rate Monitors                                  │
│  - Pulse Oximeters                                      │
│  - Smart Scales                                         │
│  - Thermometers                                         │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend BLE Stack
- **Library**: `@abandonware/noble` v1.9.2-18
  - Community-maintained fork of noble (original is deprecated)
  - Cross-platform BLE support (Windows, macOS, Linux, Raspberry Pi)
  - Node.js native bindings for Bluetooth adapter access

- **Architecture**: Event-driven with EventEmitter pattern
- **Scan Mode**: Active scanning with duplicate detection allowed
- **Scan Duration**: 30 seconds (configurable)

### Communication Stack
- **REST API**: Express.js routes for scan control
- **WebSocket**: ws library for real-time device discovery broadcasts
- **Database**: SQLite with better-sqlite3 for vitals storage

---

## BLE Scanner Service

**Location**: `backend/src/services/bleScanner.js`

### Class: BLEScanner (Singleton)

The BLE scanner is implemented as a singleton EventEmitter that manages Bluetooth scanning.

#### Properties

```javascript
{
  isScanning: boolean,           // Current scan state
  scanTimeout: NodeJS.Timeout,   // Auto-stop timer
  discoveredDevices: Map,        // Map<deviceId, deviceInfo>
  scanDuration: 30000,           // Scan duration in ms (30s)
  bluetoothState: string         // 'unknown', 'poweredOn', 'poweredOff', etc.
}
```

#### Key Methods

**1. `startScan()` - Initiate BLE Scanning**
```javascript
async startScan()
```
- **Pre-checks**:
  - Prevents duplicate scans if already scanning
  - Validates Bluetooth adapter is powered on
  - Returns error if state is not 'poweredOn'

- **Behavior**:
  1. Clears previous discovered devices
  2. Sets `isScanning = true`
  3. Emits `bleScanStatus` event with status 'scanning'
  4. Calls `noble.startScanning([], true)`
     - Empty array `[]` = scan for ALL services (no filtering)
     - `true` = allow duplicate advertisements
  5. Sets timeout to auto-stop after 30 seconds

- **Returns**: `{ success: boolean, message: string }`

**2. `stopScan()` - Stop BLE Scanning**
```javascript
async stopScan()
```
- **Behavior**:
  1. Checks if currently scanning (returns early if not)
  2. Clears scan timeout
  3. Calls `noble.stopScanning()`
  4. Sets `isScanning = false`
  5. Emits `bleScanStatus` with status 'idle' and device count

**3. `handleDeviceDiscovery(address, name, rssi)` - Process Discovered Device**
```javascript
handleDeviceDiscovery(address, name, rssi)
```
- **Input**:
  - `address`: MAC address (e.g., "AA:BB:CC:DD:EE:FF")
  - `name`: Device local name from advertisement
  - `rssi`: Signal strength (negative dBm value)

- **Processing**:
  1. Normalizes MAC address to uppercase
  2. Creates deviceId by removing colons and lowercasing
  3. Creates device object:
     ```javascript
     {
       id: deviceId,
       name: name || 'Unknown Device',
       address: normalizedAddress,
       rssi: rssi || 0,
       lastSeen: ISO timestamp,
       manufacturer: null
     }
     ```
  4. Updates device if RSSI changed or name discovered
  5. Emits `bleDeviceDiscovered` event

**4. `getStatus()` - Get Current Scanner Status**
```javascript
getStatus()
```
- **Returns**:
  ```javascript
  {
    isScanning: boolean,
    bluetoothState: string,
    devicesFound: number,
    devices: Array<DeviceInfo>
  }
  ```

#### Noble Event Listeners

**1. 'stateChange' Event**
```javascript
noble.on('stateChange', (state) => {...})
```
- **Triggered when**: Bluetooth adapter state changes
- **Possible states**:
  - `'unknown'` - Initial state
  - `'poweredOn'` - Bluetooth is ready
  - `'poweredOff'` - Bluetooth is disabled
  - `'resetting'` - Adapter is resetting
  - `'unauthorized'` - No permissions
  - `'unsupported'` - Hardware doesn't support BLE

- **Behavior**:
  - Updates `bluetoothState` property
  - Emits `bleStateChange` event
  - Auto-stops scan if Bluetooth becomes unavailable

**2. 'discover' Event**
```javascript
noble.on('discover', (peripheral) => {...})
```
- **Triggered when**: BLE device advertisement received
- **Peripheral object structure**:
  ```javascript
  {
    address: "AA:BB:CC:DD:EE:FF",
    rssi: -45,
    advertisement: {
      localName: "UA-651BLE",
      serviceUuids: ["1810", ...],
      manufacturerData: Buffer,
      txPowerLevel: number
    }
  }
  ```

- **Behavior**:
  - Extracts address, name, RSSI
  - Calls `handleDeviceDiscovery()`

#### Events Emitted

| Event Name | Payload | Description |
|------------|---------|-------------|
| `bleStateChange` | `state: string` | Bluetooth adapter state changed |
| `bleDeviceDiscovered` | `device: Object` | New/updated BLE device found |
| `bleScanStatus` | `{ status, error?, devicesFound? }` | Scan status update |

---

## BLE Health Processor

**Location**: `backend/src/services/bleHealthProcessor.js`

### Class: BLEHealthProcessor (Singleton)

Handles parsing BLE health device data and storing vitals to the database.

#### Standard BLE GATT Services

```javascript
const BLE_SERVICES = {
  HEART_RATE: '180d',           // Heart Rate Service
  BLOOD_PRESSURE: '1810',       // Blood Pressure Service ⭐
  WEIGHT_SCALE: '181d',         // Weight Scale Service
  PULSE_OXIMETER: '1822',       // Pulse Oximeter Service
  HEALTH_THERMOMETER: '1809'    // Thermometer Service
}
```

#### Standard BLE GATT Characteristics

```javascript
const BLE_CHARACTERISTICS = {
  HEART_RATE_MEASUREMENT: '2a37',
  BLOOD_PRESSURE_MEASUREMENT: '2a35',  // ⭐ For UA-651BLE
  WEIGHT_MEASUREMENT: '2a9d',
  TEMPERATURE_MEASUREMENT: '2a1c',
  PLX_SPOT_CHECK: '2a5e',
  PLX_CONTINUOUS: '2a5f'
}
```

#### Key Methods for Blood Pressure

**1. `parseBloodPressureMeasurement(data)` - Parse BLE Blood Pressure Data**
```javascript
parseBloodPressureMeasurement(data: Buffer)
```

**Standard BLE Blood Pressure Measurement Format**:
```
Byte 0: Flags
  Bit 0: Units (0=mmHg, 1=kPa)
  Bit 1: Time stamp present
  Bit 2: Pulse rate present
  Bit 3: User ID present
  Bit 4: Measurement status present

Bytes 1-2: Systolic (SFLOAT, little-endian)
Bytes 3-4: Diastolic (SFLOAT, little-endian)
Bytes 5-6: Mean Arterial Pressure (SFLOAT)
[Optional] Bytes 7-8: Pulse Rate (if bit 2 set)
```

**Parsing Logic**:
```javascript
parseBloodPressureMeasurement(data) {
  const flags = data[0]
  const isKPa = (flags & 0x01) !== 0

  // Read SFLOAT values (16-bit signed integers)
  let systolic = data.readInt16LE(1)
  let diastolic = data.readInt16LE(3)
  let meanAP = data.readInt16LE(5)

  // Convert kPa to mmHg if needed
  if (isKPa) {
    systolic = Math.round(systolic * 7.50062)
    diastolic = Math.round(diastolic * 7.50062)
    meanAP = Math.round(meanAP * 7.50062)
  }

  const result = {
    type: 'blood_pressure',
    systolic,
    diastolic,
    meanArterialPressure: meanAP,
    unit: 'mmHg'
  }

  // Extract pulse rate if present
  if ((flags & 0x04) !== 0) {
    result.pulseRate = data.readInt16LE(7)
  }

  return result
}
```

**2. `processBloodPressure(deviceAddress, systolic, diastolic, options)` - Store BP Data**
```javascript
async processBloodPressure(
  deviceAddress: string,
  systolic: number,
  diastolic: number,
  options?: {
    pulseRate?: number,
    deviceName?: string,
    notes?: string
  }
)
```

**Behavior**:
1. **Debouncing**: Checks if identical reading received within 5 seconds
   - Key: `${deviceAddress}_blood_pressure`
   - Compares systolic AND diastolic values
   - Prevents duplicate storage from rapid measurements

2. **Database Storage**: Creates vital record via VitalsRepo:
   ```javascript
   {
     vitalType: 'blood_pressure',
     valuePrimary: systolic,
     valueSecondary: diastolic,
     unit: 'mmHg',
     source: deviceAddress,
     notes: "From BLE device: UA-651BLE"
   }
   ```

3. **Updates**: Sets device `lastSeen` timestamp

4. **Events**: Emits `vitalRecorded` event for WebSocket broadcast

5. **Pulse Rate**: If `options.pulseRate` provided, also calls `processHeartRate()`

**3. `registerDevice(address, name, type)` - Register Known Device**
```javascript
registerDevice(
  address: string,      // "AA:BB:CC:DD:EE:FF"
  name: string,         // "UA-651BLE"
  type: string          // "blood_pressure_cuff"
)
```
- Stores device in `knownDevices` Map
- Enables automatic data processing for registered devices
- Type options:
  - `'heart_rate_monitor'`
  - `'blood_pressure_cuff'` ⭐
  - `'pulse_oximeter'`
  - `'scale'`
  - `'thermometer'`

#### Debouncing System

**Purpose**: Prevent duplicate vitals from devices that broadcast rapidly

**Implementation**:
- Map key: `${deviceAddress}_${vitalType}`
- Stores: `{ timestamp, reading }`
- Window: 5000ms (5 seconds)
- Cleanup: Every 30 seconds, removes entries > 10 seconds old

**Logic**:
```javascript
shouldProcessReading(deviceAddress, vitalType, reading) {
  const key = `${deviceAddress}_blood_pressure`
  const recent = this.recentReadings.get(key)

  if (recent && (now - recent.timestamp < 5000)) {
    // Within debounce window - check if values are same
    if (recent.reading.systolic === reading.systolic &&
        recent.reading.diastolic === reading.diastolic) {
      return false  // Duplicate - skip
    }
  }

  // Store for future comparison
  this.recentReadings.set(key, { timestamp: now, reading })
  return true  // Process this reading
}
```

#### Events Emitted

| Event Name | Payload | Description |
|------------|---------|-------------|
| `vitalRecorded` | `{ vitalType, vital, deviceAddress }` | New vital stored |
| `error` | `{ type, deviceAddress, error }` | Processing error |

---

## REST API Endpoints

**Base URL**: `http://localhost:3001/api/ble`

### POST /api/ble/scan
**Start BLE scanning**

**Request**:
```http
POST /api/ble/scan
Content-Type: application/json
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "BLE scan started",
  "duration": 10000
}
```

**Response (Error - Already Scanning)**:
```json
{
  "success": false,
  "error": "Scan already in progress"
}
```

**Response (Error - Bluetooth Off)**:
```json
{
  "success": false,
  "error": "[BLEScanner] Bluetooth not powered on. Current state: poweredOff"
}
```

### GET /api/ble/status
**Get current scanning status and discovered devices**

**Request**:
```http
GET /api/ble/status
```

**Response**:
```json
{
  "isScanning": true,
  "bluetoothState": "poweredOn",
  "devicesFound": 3,
  "devices": [
    {
      "id": "aabbccddeeff",
      "name": "UA-651BLE",
      "address": "AA:BB:CC:DD:EE:FF",
      "rssi": -45,
      "lastSeen": "2024-12-04T18:30:15.123Z",
      "manufacturer": null
    },
    {
      "id": "112233445566",
      "name": "Unknown Device",
      "address": "11:22:33:44:55:66",
      "rssi": -78,
      "lastSeen": "2024-12-04T18:30:18.456Z",
      "manufacturer": null
    }
  ]
}
```

---

## WebSocket Integration

**Connection**: `ws://localhost:3001`

### WebSocket Message Types

#### 1. Connection Confirmation
**Direction**: Server → Client
**Trigger**: Client connects

```json
{
  "type": "connection",
  "message": "Connected to Betti backend"
}
```

#### 2. BLE State Change
**Direction**: Server → Client
**Trigger**: Bluetooth adapter state changes

```json
{
  "type": "ble-state",
  "state": "poweredOn"
}
```

**States**: `"unknown"`, `"poweredOn"`, `"poweredOff"`, `"resetting"`, `"unauthorized"`, `"unsupported"`

#### 3. BLE Device Discovered
**Direction**: Server → Client
**Trigger**: BLE device found during scan

```json
{
  "type": "ble-device",
  "device": {
    "id": "aabbccddeeff",
    "name": "UA-651BLE",
    "address": "AA:BB:CC:DD:EE:FF",
    "rssi": -45,
    "lastSeen": "2024-12-04T18:30:15.123Z",
    "manufacturer": null
  }
}
```

#### 4. BLE Scan Status
**Direction**: Server → Client
**Trigger**: Scan starts, stops, or errors

**Scanning**:
```json
{
  "type": "ble-scan-status",
  "status": "scanning"
}
```

**Idle (Scan Complete)**:
```json
{
  "type": "ble-scan-status",
  "status": "idle",
  "devicesFound": 5
}
```

**Error**:
```json
{
  "type": "ble-scan-status",
  "status": "error",
  "error": "[BLEScanner] Bluetooth not powered on. Current state: poweredOff"
}
```

#### 5. Vital Update
**Direction**: Server → Client
**Trigger**: Health data received and stored

```json
{
  "type": "vital-update",
  "vitalType": "blood_pressure",
  "vital": {
    "id": 123,
    "user_id": 1,
    "vital_type": "blood_pressure",
    "value_primary": 120,
    "value_secondary": 80,
    "unit": "mmHg",
    "source": "AA:BB:CC:DD:EE:FF",
    "notes": "From BLE device: UA-651BLE",
    "recorded_at": "2024-12-04T18:30:20.000Z"
  },
  "deviceAddress": "AA:BB:CC:DD:EE:FF",
  "timestamp": "2024-12-04T18:30:20.123Z"
}
```

### WebSocket Implementation (Backend)

**Location**: `backend/src/index.js`

```javascript
// Create WebSocket server
const wss = new WebSocketServer({ server })
const wsClients = new Set()

// Track connections
wss.on('connection', (ws) => {
  wsClients.add(ws)

  ws.on('close', () => wsClients.delete(ws))
  ws.on('error', () => wsClients.delete(ws))
})

// Broadcast function
function broadcast(data) {
  const message = JSON.stringify(data)
  wsClients.forEach((client) => {
    if (client.readyState === 1) {  // OPEN
      client.send(message)
    }
  })
}

// Listen for BLE events
bleScanner.on('bleDeviceDiscovered', (device) => {
  broadcast({ type: 'ble-device', device })
})

bleHealthProcessor.on('vitalRecorded', (data) => {
  broadcast({
    type: 'vital-update',
    vitalType: data.vitalType,
    vital: data.vital,
    deviceAddress: data.deviceAddress,
    timestamp: new Date().toISOString()
  })
})
```

---

## Database Storage

### Vitals Table Schema

**Table**: `vital_readings`

```sql
CREATE TABLE vital_readings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL DEFAULT 1,
  vital_type      TEXT NOT NULL,
  value_primary   REAL NOT NULL,
  value_secondary REAL,
  unit            TEXT,
  source          TEXT,
  notes           TEXT,
  recorded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Blood Pressure Storage Example

**Input**:
- Systolic: 120 mmHg
- Diastolic: 80 mmHg
- Source: AA:BB:CC:DD:EE:FF (UA-651BLE)

**Database Record**:
```sql
INSERT INTO vital_readings (
  user_id, vital_type, value_primary, value_secondary,
  unit, source, notes, recorded_at
) VALUES (
  1,
  'blood_pressure',
  120,
  80,
  'mmHg',
  'AA:BB:CC:DD:EE:FF',
  'From BLE device: UA-651BLE',
  '2024-12-04 18:30:20'
)
```

### Querying Vitals

**Get latest blood pressure**:
```sql
SELECT * FROM vital_readings
WHERE vital_type = 'blood_pressure'
ORDER BY recorded_at DESC
LIMIT 1
```

**Get today's blood pressure readings**:
```sql
SELECT * FROM vital_readings
WHERE vital_type = 'blood_pressure'
  AND DATE(recorded_at) = DATE('now')
ORDER BY recorded_at DESC
```

---

## Current Device Support

### Supported Device Types

| Device Type | BLE Service | Status | Data Parsed |
|-------------|-------------|--------|-------------|
| Heart Rate Monitor | `0x180D` | ✅ Full | Heart rate (BPM) |
| **Blood Pressure Cuff** | **`0x1810`** | ✅ **Full** | **Systolic, Diastolic, Pulse** |
| Pulse Oximeter | `0x1822` | ✅ Full | SpO2 (%), Pulse |
| Smart Scale | `0x181D` | ✅ Full | Weight (lbs/kg) |
| Thermometer | `0x1809` | ✅ Full | Temperature (°F/°C) |

### UA-651BLE Blood Pressure Monitor

**Expected BLE Advertisement**:
```javascript
{
  localName: "UA-651BLE",
  serviceUuids: ["1810"],  // Blood Pressure Service
  manufacturerData: Buffer  // May contain manufacturer ID
}
```

**Expected Characteristics**:
- **Service UUID**: `0x1810` (Blood Pressure)
- **Characteristic UUID**: `0x2A35` (Blood Pressure Measurement)
- **Properties**: READ, NOTIFY
- **Format**: Standard BLE GATT format (documented above)

---

## Event Flow Diagram

### Complete Flow: Scan → Discover → Pair → Measure → Store

```
┌─────────────┐
│   Frontend  │
│   (React)   │
└──────┬──────┘
       │
       │ 1. POST /api/ble/scan
       │
┌──────▼──────────────────────────────────────────────────┐
│                    Backend                               │
│  ┌────────────────────────────────────────────┐         │
│  │   Express Route: POST /api/ble/scan        │         │
│  │   Calls: bleScanner.startScan()            │         │
│  └────────────┬───────────────────────────────┘         │
│               │                                          │
│  ┌────────────▼───────────────────────────────┐         │
│  │       BLEScanner.startScan()               │         │
│  │   - Validates Bluetooth state              │         │
│  │   - Clears previous devices                │         │
│  │   - noble.startScanning([], true)          │         │
│  │   - Sets 30s timeout                       │         │
│  │   - Emits 'bleScanStatus' (scanning)       │         │
│  └────────────┬───────────────────────────────┘         │
│               │                                          │
│               │ 2. WebSocket broadcast                   │
│               │    { type: 'ble-scan-status',           │
│               │      status: 'scanning' }               │
│               │                                          │
└───────────────┼──────────────────────────────────────────┘
                │
                │ 3. Bluetooth LE scanning active
                │
    ┌───────────▼───────────┐
    │   BLE Adapter scans   │
    │   for advertisements  │
    └───────────┬───────────┘
                │
                │ 4. Advertisement received
                │    from UA-651BLE
                │
┌───────────────▼──────────────────────────────────────────┐
│                     Noble                                 │
│  Event: 'discover' fired                                 │
│  Peripheral: {                                           │
│    address: "AA:BB:CC:DD:EE:FF",                        │
│    advertisement: {                                      │
│      localName: "UA-651BLE",                            │
│      serviceUuids: ["1810"]                             │
│    },                                                    │
│    rssi: -45                                            │
│  }                                                       │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 5. noble.on('discover') callback
                │
┌───────────────▼──────────────────────────────────────────┐
│              BLEScanner                                   │
│  handleDeviceDiscovery(address, name, rssi)              │
│  - Normalizes MAC address                                │
│  - Creates device object                                 │
│  - Updates discoveredDevices Map                         │
│  - Emits 'bleDeviceDiscovered' event                     │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 6. bleScanner.on('bleDeviceDiscovered')
                │
┌───────────────▼──────────────────────────────────────────┐
│           WebSocket Broadcast (index.js)                 │
│  broadcast({                                             │
│    type: 'ble-device',                                   │
│    device: {                                             │
│      id: "aabbccddeeff",                                 │
│      name: "UA-651BLE",                                  │
│      address: "AA:BB:CC:DD:EE:FF",                       │
│      rssi: -45,                                          │
│      lastSeen: "2024-12-04T18:30:15.123Z"                │
│    }                                                     │
│  })                                                      │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 7. WebSocket message sent
                │
    ┌───────────▼───────────┐
    │     Frontend          │
    │   Receives device     │
    │   Shows in UI         │
    │   User clicks "Pair"  │
    └───────────┬───────────┘
                │
                │ 8. User initiates pairing
                │    (future implementation)
                │
┌───────────────▼──────────────────────────────────────────┐
│         Future: Device Pairing/Connection                │
│  - noble.connect(peripheral)                             │
│  - peripheral.discoverServices(['1810'])                 │
│  - service.discoverCharacteristics(['2a35'])             │
│  - characteristic.subscribe()                            │
│  - characteristic.on('data', (buffer) => {...})          │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 9. Device sends measurement
                │
┌───────────────▼──────────────────────────────────────────┐
│     BLEHealthProcessor.parseBloodPressureMeasurement     │
│  Input: Buffer [0x00, 0x78, 0x00, 0x50, 0x00, ...]      │
│  Output: {                                               │
│    type: 'blood_pressure',                               │
│    systolic: 120,                                        │
│    diastolic: 80,                                        │
│    pulseRate: 72,                                        │
│    unit: 'mmHg'                                          │
│  }                                                       │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 10. processBloodPressure() called
                │
┌───────────────▼──────────────────────────────────────────┐
│     BLEHealthProcessor.processBloodPressure()            │
│  - Checks debouncing (prevents duplicates)               │
│  - Stores to database via VitalsRepo                     │
│  - Emits 'vitalRecorded' event                           │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 11. Database INSERT
                │
    ┌───────────▼───────────┐
    │   SQLite Database     │
    │   vital_readings      │
    │   + 1 new row         │
    └───────────┬───────────┘
                │
                │ 12. bleHealthProcessor.on('vitalRecorded')
                │
┌───────────────▼──────────────────────────────────────────┐
│           WebSocket Broadcast (index.js)                 │
│  broadcast({                                             │
│    type: 'vital-update',                                 │
│    vitalType: 'blood_pressure',                          │
│    vital: { id, user_id, vital_type, ... },              │
│    deviceAddress: "AA:BB:CC:DD:EE:FF",                   │
│    timestamp: "2024-12-04T18:30:20.123Z"                 │
│  })                                                      │
└───────────────┬──────────────────────────────────────────┘
                │
                │ 13. WebSocket message sent
                │
    ┌───────────▼───────────┐
    │     Frontend          │
    │   Receives vital      │
    │   Updates UI          │
    │   Shows: 120/80 mmHg  │
    └───────────────────────┘
```

---

## Adding New Device Support

### Steps to Support UA-651BLE (or any BLE device)

#### 1. Discovery (CURRENT - ✅ WORKING)
The device will appear in scan results with:
- Name: "UA-651BLE"
- Service UUID: "1810" (Blood Pressure)

**No code changes needed** - scanning is generic and finds all devices.

#### 2. Connection (TODO - ⚠️ NOT YET IMPLEMENTED)
Need to add connection logic using Noble:

```javascript
// In bleScanner.js or new bleConnection.js

async connectToDevice(peripheralAddress) {
  // Find peripheral from scan results
  const peripheral = this.getPeripheralByAddress(peripheralAddress)

  // Connect
  await peripheral.connectAsync()

  // Discover services (Blood Pressure = 0x1810)
  const services = await peripheral.discoverServicesAsync(['1810'])
  const bpService = services[0]

  // Discover characteristics (BP Measurement = 0x2A35)
  const characteristics = await bpService.discoverCharacteristicsAsync(['2a35'])
  const bpCharacteristic = characteristics[0]

  // Subscribe to notifications
  await bpCharacteristic.subscribeAsync()

  // Listen for data
  bpCharacteristic.on('data', (buffer) => {
    this.handleBloodPressureData(peripheralAddress, buffer)
  })
}

handleBloodPressureData(address, buffer) {
  // Parse using existing parser
  const parsed = bleHealthProcessor.parseBloodPressureMeasurement(buffer)

  // Store using existing processor
  bleHealthProcessor.processBloodPressure(
    address,
    parsed.systolic,
    parsed.diastolic,
    {
      pulseRate: parsed.pulseRate,
      deviceName: 'UA-651BLE'
    }
  )
}
```

#### 3. Data Parsing (CURRENT - ✅ WORKING)
Already implemented in `BLEHealthProcessor.parseBloodPressureMeasurement()`

**Standard BLE GATT format is supported** - should work with UA-651BLE out of box.

#### 4. Storage (CURRENT - ✅ WORKING)
Already implemented in `BLEHealthProcessor.processBloodPressure()`

Automatically stores to database and broadcasts via WebSocket.

#### 5. Frontend Display (CURRENT - ✅ WORKING)
WebSocket broadcasts vitals - frontend can listen and display.

---

## Missing Pieces for UA-651BLE

### What Works Now ✅
1. **Scanning** - Device will appear in scan results
2. **Device discovery** - Name, address, RSSI displayed
3. **Data parsing** - Standard BP format parser ready
4. **Database storage** - Vitals stored automatically
5. **WebSocket broadcast** - Real-time updates to frontend

### What Needs Implementation ⚠️
1. **Device connection** - `noble.connect()` not yet implemented
2. **Service discovery** - Need to find service 0x1810
3. **Characteristic subscription** - Need to subscribe to 0x2A35
4. **Data reception** - Handle characteristic notifications
5. **Device pairing UI** - Frontend button to initiate connection
6. **Connection management** - Handle disconnects, reconnects

### Recommended Next Steps

**Step 1**: Add connection method to BLEScanner
```javascript
async connectToDevice(peripheralAddress) {
  // Store peripherals during scan
  // Connect when user clicks "Pair"
}
```

**Step 2**: Add API endpoint for pairing
```javascript
// POST /api/ble/connect
router.post('/connect', async (req, res) => {
  const { address } = req.body
  await bleScanner.connectToDevice(address)
})
```

**Step 3**: Wire up characteristic notifications
```javascript
characteristic.on('data', (buffer) => {
  // Calls existing parser + processor
})
```

**Step 4**: Test with actual UA-651BLE device

---

## Debugging & Logging

### Log Locations

**BLEScanner logs**:
```
[BLEScanner] Initializing...
[BLEScanner] Noble state changed to poweredOn
[BLEScanner] 🔍 Starting BLE scan for 30 seconds using Noble...
[BLEScanner] Discovered peripheral: AA:BB:CC:DD:EE:FF
[BLEScanner] 📱 BLE Device Updated/Added: UA-651BLE (AA:BB:CC:DD:EE:FF) - RSSI: -45
[BLEScanner] ✅ Scan complete. Found 3 devices
```

**BLEHealthProcessor logs**:
```
[BLEHealthProcessor] Initialized
[BLEHealthProcessor] Registered device: UA-651BLE (AA:BB:CC:DD:EE:FF) as blood_pressure_cuff
[BLEHealthProcessor] Stored blood pressure: 120/80 mmHg from AA:BB:CC:DD:EE:FF
[BLEHealthProcessor] Debounced duplicate blood_pressure reading from AA:BB:CC:DD:EE:FF
```

### Common Issues

**Issue**: "Bluetooth not powered on"
- **Cause**: Bluetooth adapter is disabled
- **Solution**: Enable Bluetooth on the host machine

**Issue**: Device not appearing in scan
- **Cause**: Device not in pairing mode
- **Solution**: Press pairing button on UA-651BLE

**Issue**: Duplicate readings stored
- **Cause**: Debouncing window too short
- **Solution**: Increase `DEBOUNCE_WINDOW_MS` (currently 5000ms)

**Issue**: Cannot connect to device
- **Cause**: Connection logic not implemented yet
- **Solution**: Implement `connectToDevice()` method

---

## Summary for AI Integration

### Key Points for UA-651BLE Integration

1. **Device Discovery**: ✅ **Working** - Device will appear automatically when scanning

2. **Device Identification**:
   - Name: "UA-651BLE"
   - Service: `0x1810` (Blood Pressure)
   - Characteristic: `0x2A35` (BP Measurement)

3. **Data Format**: Standard BLE GATT - parser already implemented

4. **Storage**: Automatic storage to SQLite via VitalsRepo

5. **Real-time Updates**: WebSocket broadcasts to all connected clients

6. **Missing**: Device connection/pairing logic (need to implement `noble.connect()`)

### Immediate Action Items

To pair and receive data from UA-651BLE:

1. ✅ Scan for device (already works)
2. ⚠️ Implement `connectToDevice(address)` method
3. ⚠️ Subscribe to characteristic `0x2A35` notifications
4. ✅ Parse received data (already implemented)
5. ✅ Store to database (already implemented)
6. ✅ Broadcast to frontend (already implemented)

The infrastructure is 80% complete - only connection logic is missing.

---

**Document Version**: 1.0
**Last Updated**: December 4, 2024
**Status**: Ready for AI consumption
