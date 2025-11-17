import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { createServer as createHttpsServer } from 'https'
import { readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'
import bleRoutes from './routes/ble.js'
import bleScanner from './services/bleScanner.js' // Import bleScanner

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

// Middleware - Allow CORS from all origins in development
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}))
app.use(express.json())

// Try to create HTTPS server if certificates exist, otherwise use HTTP
let server
try {
  // Look for certificates (Vite's basicSsl creates them in node_modules/.vite/basic-ssl)
  const certDir = join(process.cwd(), '../frontend/node_modules/.vite/basic-ssl')
  const cert = readFileSync(join(certDir, '_cert.pem'))
  const key = readFileSync(join(certDir, '_cert.pem')) // basicSsl uses same file for cert and key

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


// Routes
app.use('/api/ble', bleRoutes)

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
})
