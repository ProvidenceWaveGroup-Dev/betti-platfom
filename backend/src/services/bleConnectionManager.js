import { EventEmitter } from 'events'
import BleDevicesRepo from '../repos/BleDevicesRepo.js'
import bleScanner from './bleScanner.js'
import bleHealthProcessor from './bleHealthProcessor.js'

/**
 * BLE Connection Manager
 *
 * Background service that:
 * - Listens for device discovery events from bleScanner
 * - Immediately connects when a paired device is discovered (critical for devices like UA-651BLE that only advertise for ~30 seconds)
 * - Subscribes to blood pressure characteristics
 * - Processes notifications and stores vitals
 * - Emits connection status events
 * - Maintains continuous scanning to catch on-demand advertisers
 */

// Standard BLE GATT Service and Characteristic UUIDs
const BLE_SERVICES = {
  BLOOD_PRESSURE: '1810'
}

const BLE_CHARACTERISTICS = {
  BLOOD_PRESSURE_MEASUREMENT: '2a35'
}

class BLEConnectionManager extends EventEmitter {
  constructor() {
    super()

    this.scanInterval = null
    this.scanIntervalMs = 45000 // 45 seconds between scan starts (scan lasts 30s, so 15s gap)
    this.connectedPeripherals = new Map() // MAC -> { peripheral, characteristics, name }
    this.connectingDevices = new Set() // Track devices currently being connected to avoid duplicates
    this.pairedDeviceMACs = new Set() // Normalized MACs of paired devices for quick lookup

    console.log('[BLEConnectionManager] Initialized')
  }

  /**
   * Start the connection manager
   */
  start() {
    if (this.scanInterval) {
      console.log('[BLEConnectionManager] Already running')
      return
    }

    console.log('[BLEConnectionManager] Starting...')

    // Load paired devices into memory for quick lookup
    this.refreshPairedDevices()

    // Listen for device discoveries - connect immediately when paired device found
    bleScanner.on('bleDeviceDiscovered', (device) => this.handleDeviceDiscovered(device))

    // Start continuous scanning
    this.startContinuousScanning()

    console.log('[BLEConnectionManager] Started - listening for paired devices')
  }

  /**
   * Refresh the list of paired device MACs from database
   */
  refreshPairedDevices() {
    const pairedDevices = BleDevicesRepo.findPaired('blood_pressure')
    this.pairedDeviceMACs.clear()

    for (const device of pairedDevices) {
      // Normalize to uppercase without separators for comparison
      const normalizedMAC = device.macAddress.toUpperCase().replace(/[:-]/g, '')
      this.pairedDeviceMACs.add(normalizedMAC)
      console.log(`[BLEConnectionManager] Watching for paired device: ${device.name} (${normalizedMAC})`)
    }

    console.log(`[BLEConnectionManager] Monitoring ${this.pairedDeviceMACs.size} paired device(s)`)
  }

  /**
   * Start continuous scanning loop
   */
  startContinuousScanning() {
    // Start first scan immediately
    this.triggerScan()

    // Set up interval for subsequent scans
    this.scanInterval = setInterval(() => {
      this.triggerScan()
    }, this.scanIntervalMs)
  }

  /**
   * Trigger a BLE scan if not already scanning
   */
  async triggerScan() {
    if (bleScanner.isScanning) {
      console.log('[BLEConnectionManager] Scan already in progress')
      return
    }

    console.log('[BLEConnectionManager] Starting BLE scan...')
    const result = await bleScanner.startScan()

    if (!result.success) {
      console.error(`[BLEConnectionManager] Failed to start scan: ${result.message}`)
    }
  }

  /**
   * Handle device discovery - connect immediately if it's a paired device
   * This is the key change: we don't wait for scan to complete
   */
  async handleDeviceDiscovered(device) {
    // Normalize the discovered device's MAC for comparison
    const normalizedMAC = device.address.replace(/[:-]/g, '').toUpperCase()

    // Check if this is a paired device we're watching for
    if (!this.pairedDeviceMACs.has(normalizedMAC)) {
      return // Not a paired device, ignore
    }

    console.log(`[BLEConnectionManager] 🎯 Paired device discovered: ${device.name} (${device.address})`)

    // Check if already connected
    if (this.isConnectedByNormalizedMAC(normalizedMAC)) {
      console.log(`[BLEConnectionManager] ${device.name} already connected`)
      return
    }

    // Check if already connecting
    if (this.connectingDevices.has(normalizedMAC)) {
      console.log(`[BLEConnectionManager] ${device.name} connection already in progress`)
      return
    }

    // Connect immediately - don't wait!
    this.connectingDevices.add(normalizedMAC)

    try {
      await this.connectToDevice(device.address, device.name)
    } finally {
      this.connectingDevices.delete(normalizedMAC)
    }
  }

  /**
   * Check if device is connected by normalized MAC
   */
  isConnectedByNormalizedMAC(normalizedMAC) {
    for (const [mac] of this.connectedPeripherals) {
      const connectedNormalized = mac.toUpperCase().replace(/[:-]/g, '')
      if (connectedNormalized === normalizedMAC) {
        return true
      }
    }
    return false
  }

  /**
   * Stop the connection manager
   */
  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
    }

    // Remove event listener
    bleScanner.removeAllListeners('bleDeviceDiscovered')

    // Disconnect all connected devices
    for (const [mac] of this.connectedPeripherals) {
      this.disconnectDevice(mac)
    }

    console.log('[BLEConnectionManager] Stopped')
  }

  /**
   * Connect to a BLE device
   */
  async connectToDevice(macAddress, name = 'Unknown Device') {
    try {
      console.log(`[BLEConnectionManager] Connecting to ${name} (${macAddress})...`)

      // Emit connecting status
      this.emit('connection-status', {
        macAddress,
        name,
        status: 'connecting'
      })

      // Get peripheral from scanner cache
      const peripheral = bleScanner.getPeripheralByMac(macAddress)

      if (!peripheral) {
        throw new Error('Peripheral not found in cache')
      }

      console.log(`[BLEConnectionManager] Peripheral found, state: ${peripheral.state}`)

      // Stop scanning before connecting (Noble requirement on some platforms)
      if (bleScanner.isScanning) {
        console.log('[BLEConnectionManager] Stopping scan for connection...')
        await bleScanner.stopScan()
      }

      // Connect if not already connected
      if (peripheral.state !== 'connected') {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout (10s)'))
          }, 10000)

          peripheral.connect((error) => {
            clearTimeout(timeout)
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          })
        })

        console.log(`[BLEConnectionManager] ✓ Connected to ${name}`)
      } else {
        console.log(`[BLEConnectionManager] ${name} already connected`)
      }

      // Discover services and characteristics
      await this.discoverServices(peripheral, macAddress, name)

      // Store connection
      this.connectedPeripherals.set(macAddress, {
        peripheral,
        name,
        connectedAt: new Date().toISOString()
      })

      // Update database
      BleDevicesRepo.updateLastSeen(macAddress)

      // Emit connected status
      this.emit('connection-status', {
        macAddress,
        name,
        status: 'connected'
      })

      // Handle disconnect events
      peripheral.once('disconnect', () => {
        console.log(`[BLEConnectionManager] ${name} disconnected`)
        this.connectedPeripherals.delete(macAddress)

        this.emit('connection-status', {
          macAddress,
          name,
          status: 'disconnected'
        })

        // Resume scanning after disconnect
        this.triggerScan()
      })

    } catch (error) {
      console.error(`[BLEConnectionManager] Failed to connect to ${name}:`, error.message)

      this.emit('connection-error', {
        macAddress,
        name,
        error: error.message
      })

      this.emit('connection-status', {
        macAddress,
        name,
        status: 'disconnected'
      })

      // Resume scanning after failed connection
      this.triggerScan()
    }
  }

  /**
   * Discover services and characteristics, then subscribe
   */
  async discoverServices(peripheral, macAddress, name) {
    return new Promise((resolve, reject) => {
      console.log(`[BLEConnectionManager] Discovering services for ${name}...`)

      peripheral.discoverServices([BLE_SERVICES.BLOOD_PRESSURE], (error, services) => {
        if (error) {
          return reject(new Error('Service discovery failed: ' + error.message))
        }

        if (!services || services.length === 0) {
          return reject(new Error('Blood pressure service not found'))
        }

        const service = services[0]
        console.log(`[BLEConnectionManager] Found blood pressure service on ${name}`)

        // Discover characteristics
        service.discoverCharacteristics([BLE_CHARACTERISTICS.BLOOD_PRESSURE_MEASUREMENT], (error, characteristics) => {
          if (error) {
            return reject(new Error('Characteristic discovery failed: ' + error.message))
          }

          if (!characteristics || characteristics.length === 0) {
            return reject(new Error('Blood pressure measurement characteristic not found'))
          }

          const characteristic = characteristics[0]
          console.log(`[BLEConnectionManager] Found BP characteristic on ${name}`)

          // Subscribe to notifications
          characteristic.subscribe((error) => {
            if (error) {
              return reject(new Error('Failed to subscribe: ' + error.message))
            }

            console.log(`[BLEConnectionManager] ✓ Subscribed to BP notifications for ${name}`)

            // Handle data notifications
            characteristic.on('data', (data) => {
              this.handleBloodPressureNotification(macAddress, name, data)
            })

            resolve()
          })
        })
      })
    })
  }

  /**
   * Handle blood pressure notification data
   */
  handleBloodPressureNotification(macAddress, name, data) {
    try {
      console.log(`[BLEConnectionManager] Received BP data from ${name}`)

      // Parse the data using bleHealthProcessor
      const parsed = bleHealthProcessor.parseBloodPressureMeasurement(data)

      if (!parsed) {
        console.error('[BLEConnectionManager] Failed to parse BP data')
        return
      }

      const { systolic, diastolic, unit } = parsed
      console.log(`[BLEConnectionManager] Parsed: ${systolic}/${diastolic} ${unit}`)

      // Emit event
      this.emit('bp-data-received', {
        macAddress,
        name,
        systolic,
        diastolic,
        unit
      })

      // Process and store the reading (this will trigger WebSocket broadcast)
      bleHealthProcessor.processBloodPressure(macAddress, systolic, diastolic, {
        unit,
        source: `ble_${macAddress}`,
        deviceName: name
      })

      console.log(`[BLEConnectionManager] ✓ Blood pressure reading stored: ${systolic}/${diastolic} ${unit}`)

    } catch (error) {
      console.error('[BLEConnectionManager] Error handling BP notification:', error)
    }
  }

  /**
   * Manually disconnect a device
   */
  async disconnectDevice(macAddress) {
    const connection = this.connectedPeripherals.get(macAddress)
    if (!connection) {
      console.log(`[BLEConnectionManager] Device ${macAddress} not connected`)
      return
    }

    const { peripheral, name } = connection

    return new Promise((resolve) => {
      peripheral.disconnect(() => {
        console.log(`[BLEConnectionManager] Disconnected ${name}`)
        this.connectedPeripherals.delete(macAddress)

        this.emit('connection-status', {
          macAddress,
          name,
          status: 'disconnected'
        })

        resolve()
      })
    })
  }

  /**
   * Get current connection status
   */
  getStatus() {
    const connections = []

    for (const [mac, conn] of this.connectedPeripherals) {
      connections.push({
        macAddress: mac,
        name: conn.name,
        status: 'connected',
        connectedAt: conn.connectedAt
      })
    }

    return {
      isRunning: this.scanInterval !== null,
      scanIntervalMs: this.scanIntervalMs,
      connectedCount: this.connectedPeripherals.size,
      pairedDevicesMonitored: this.pairedDeviceMACs.size,
      connections
    }
  }

  /**
   * Check if a device is connected
   */
  isConnected(macAddress) {
    return this.connectedPeripherals.has(macAddress)
  }

  /**
   * Add a new paired device to monitor (call after pairing a new device)
   */
  addPairedDevice(macAddress) {
    const normalizedMAC = macAddress.toUpperCase().replace(/[:-]/g, '')
    this.pairedDeviceMACs.add(normalizedMAC)
    console.log(`[BLEConnectionManager] Now monitoring paired device: ${normalizedMAC}`)
  }

  /**
   * Remove a paired device from monitoring (call after unpairing)
   */
  removePairedDevice(macAddress) {
    const normalizedMAC = macAddress.toUpperCase().replace(/[:-]/g, '')
    this.pairedDeviceMACs.delete(normalizedMAC)
    console.log(`[BLEConnectionManager] Stopped monitoring: ${normalizedMAC}`)
  }
}

// Export singleton instance
const bleConnectionManager = new BLEConnectionManager()
export default bleConnectionManager
