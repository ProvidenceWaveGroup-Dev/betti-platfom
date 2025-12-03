import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { createServer as createHttpsServer } from 'https'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'
import bleRoutes from './routes/ble.js'
import vitalsRoutes from './routes/vitals.js'
import fitnessRoutes from './routes/fitness.js'
import medicationsRoutes from './routes/medications.js'
import appointmentsRoutes from './routes/appointments.js'
import hydrationRoutes from './routes/hydration.js'
import nutritionRoutes from './routes/nutrition.js'
import bleScanner from './services/bleScanner.js'
import bleHealthProcessor from './services/bleHealthProcessor.js'
import bleFitnessProcessor from './services/bleFitnessProcessor.js'
import medicationReminder from './services/medicationReminder.js'
import database from './services/database.js'

dotenv.config()

// Initialize database before anything else
try {
  database.init()
} catch (error) {
  console.error('❌ Failed to initialize database:', error.message)
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

// CORS configuration - Allow local dev and ngrok public access
const allowedOrigins = [
  'http://localhost:5173',
  'https://localhost:5173',
  'https://halibut-saved-gannet.ngrok-free.app'
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true)
    // Allow all origins in development or if in allowed list
    if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    // Also allow any ngrok URL
    if (origin.includes('ngrok')) {
      return callback(null, true)
    }
    callback(null, true) // Allow all for now during development
  },
  credentials: true
}))
app.use(express.json())

// Try to create HTTPS server if certificates exist, otherwise use HTTP
let server
try {
  // Look for certificates (Vite's basicSsl creates them in node_modules/.vite/basic-ssl)
  const certDir = join(process.cwd(), '../frontend/node_modules/.vite/basic-ssl')
  const cert = readFileSync(join(certDir, '_cert.pem'))
  const key = readFileSync(join(certDir, '_key.pem'))

  server = createHttpsServer({ cert, key }, app)
  console.log('🔒 HTTPS server will be created')
} catch (error) {
  // Fall back to HTTP if no certificates found
  server = createServer(app)
  console.log('📡 HTTP server will be created (no SSL certificates found)')
}

// Create WebSocket server
const wss = new WebSocketServer({ server })

// Store WebSocket clients
const wsClients = new Set()

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected')
  wsClients.add(ws)

  ws.on('close', () => {
    console.log('WebSocket client disconnected')
    wsClients.delete(ws)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    wsClients.delete(ws)
  })

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to Betti backend'
  }))
})

// Make wsClients available to routes
app.locals.wsClients = wsClients

// Broadcast function for WebSocket
export function broadcast(data) {
  const message = JSON.stringify(data)
  wsClients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message)
    }
  })
}

// Listen for BLEScanner events and broadcast them
bleScanner.on('bleStateChange', (state) => {
  broadcast({
    type: 'ble-state',
    state: state
  })
})

bleScanner.on('bleDeviceDiscovered', (device) => {
  broadcast({
    type: 'ble-device',
    device: device
  })
})

bleScanner.on('bleScanStatus', (status) => {
  broadcast({
    type: 'ble-scan-status',
    status: status.status,
    error: status.error,
    devicesFound: status.devicesFound
  })
})

// Listen for BLE Health Processor events and broadcast vitals updates
bleHealthProcessor.on('vitalRecorded', (data) => {
  broadcast({
    type: 'vital-update',
    vitalType: data.vitalType,
    vital: data.vital,
    deviceAddress: data.deviceAddress,
    timestamp: new Date().toISOString()
  })
})

bleHealthProcessor.on('error', (error) => {
  broadcast({
    type: 'vital-error',
    vitalType: error.type,
    deviceAddress: error.deviceAddress,
    error: error.error
  })
})

// Listen for BLE Fitness Processor events and broadcast activity updates
bleFitnessProcessor.on('activityUpdated', (data) => {
  broadcast({
    type: 'activity-update',
    userId: data.userId,
    date: data.date,
    activity: data.activity,
    deviceAddress: data.deviceAddress,
    source: data.source,
    timestamp: new Date().toISOString()
  })
})

bleFitnessProcessor.on('error', (error) => {
  broadcast({
    type: 'activity-error',
    errorType: error.type,
    deviceAddress: error.deviceAddress,
    error: error.error
  })
})

// Listen for Medication Reminder events and broadcast them
medicationReminder.on('medication-reminder', (data) => {
  broadcast(data)
})

medicationReminder.on('medication-due', (data) => {
  broadcast(data)
})

medicationReminder.on('medication-late', (data) => {
  broadcast(data)
})

medicationReminder.on('error', (error) => {
  broadcast({
    type: 'medication-error',
    error: error.error
  })
})

// Start medication reminder service
medicationReminder.start()

// Routes
app.use('/api/ble', bleRoutes)
app.use('/api/vitals', vitalsRoutes)
app.use('/api/fitness', fitnessRoutes)
app.use('/api/medications', medicationsRoutes)
app.use('/api/appointments', appointmentsRoutes)
app.use('/api/hydration', hydrationRoutes)
app.use('/api/nutrition', nutritionRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocketClients: wsClients.size
  })
})

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🚀 Betti backend server running at http://${HOST}:${PORT}`)
  console.log(`📡 WebSocket server ready`)
  console.log(`🔵 Bluetooth LE scanning available`)

  // Signal to PM2 that app is ready
  if (process.send) {
    process.send('ready')
  }
})

// Graceful shutdown handlers
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`)

  // Close WebSocket connections
  wsClients.forEach(client => {
    try {
      client.close(1000, 'Server shutting down')
    } catch (e) {
      // Ignore errors on close
    }
  })

  // Close the HTTP/HTTPS server
  server.close(() => {
    console.log('🔌 HTTP server closed')

    // Cleanup BLE health processor
    bleHealthProcessor.destroy()

    // Cleanup medication reminder service
    medicationReminder.destroy()

    // Close database connection
    database.close()

    console.log('👋 Goodbye!')
    process.exit(0)
  })

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after timeout')
    database.close()
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
