import { EventEmitter } from 'events'
import bleScanner from './bleScanner.js'

/**
 * BLE Halo Environmental Sensor Processor
 *
 * Handles connection and data processing for the Halo environmental sensor.
 * Monitors: Temperature, Humidity, Ambient Light, IMU (Accelerometer)
 *
 * Halo Sensor BLE Protocol:
 * - Device Name: 'halo_test'
 * - Environmental Sensing Service: 0x181A
 *   - Temperature Characteristic: 0x2A6E (Int16LE / 100 = °C)
 *   - Humidity Characteristic: 0x2A6F (UInt16LE / 100 = %)
 *   - Ambient Light Characteristic: c8546913-bfd9-45eb-8dde-9f8754f4a32e (UInt32LE / 100 = Lux)
 * - Automation IO Service: 0x1815
 *   - Digital Characteristic: 0x2A56 (Button state)
 * - IMU Service: a4e649f4-4be5-11e5-885d-feff819cdc9f
 *   - Acceleration Characteristic: c4c1f6e2-4be5-11e5-885d-feff819cdc9f (3x Int16LE / 1000 = g)
 */

// Halo device identification
const HALO_DEVICE_NAME = 'halo_test'

// Service UUIDs (lowercase, no dashes for Noble comparison)
const ENV_SENSING_SERVICE_UUID = '181a'
const AUTOMATION_IO_SERVICE_UUID = '1815'
const IMU_SERVICE_UUID = 'a4e649f44be511e5885dfeff819cdc9f'

// Characteristic UUIDs (lowercase, no dashes for Noble comparison)
const TEMP_CHAR_UUID = '2a6e'
const HUMIDITY_CHAR_UUID = '2a6f'
const AMBIENT_LIGHT_CHAR_UUID = 'c8546913bfd945eb8dde9f8754f4a32e'
const DIGITAL_CHAR_UUID = '2a56' // Button
const ACCELERATION_CHAR_UUID = 'c4c1f6e24be511e5885dfeff819cdc9f'

class BLEHaloProcessor extends EventEmitter {
  constructor() {
    super()

    this.connectedPeripheral = null
    this.isConnecting = false
    this.connectionState = 'disconnected' // disconnected, connecting, connected
    this.characteristics = new Map()
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 5000 // 5 seconds

    // Latest sensor values
    this.sensorData = {
      temperature: null,      // °F
      temperatureC: null,     // °C (raw)
      humidity: null,         // %
      light: null,            // Lux
      imu: { x: null, y: null, z: null }, // g (acceleration)
      button: null,           // 0 or 1
      lastUpdate: null
    }

    // Polling interval for environmental sensors (they don't notify)
    this.pollInterval = null
    this.pollIntervalMs = 5000 // Read temp/humidity/light every 5 seconds

    console.log('[BLEHaloProcessor] Initialized')
  }

  /**
   * Start listening for Halo device discovery
   */
  start() {
    // Prevent multiple start calls
    if (this._started) {
      console.log('[BLEHaloProcessor] Already started, skipping...')
      return
    }
    this._started = true

    console.log('[BLEHaloProcessor] Starting - listening for Halo device...')

    // Bind handler so we can remove it later
    this._deviceHandler = (device) => this.handleDeviceDiscovered(device)
    bleScanner.on('bleDeviceDiscovered', this._deviceHandler)

    // If already discovered, try to connect
    const status = bleScanner.getStatus()
    for (const device of status.devices) {
      if (device.name === HALO_DEVICE_NAME) {
        console.log('[BLEHaloProcessor] Halo device already discovered, connecting...')
        this.connectToHalo(device.address)
        break
      }
    }
  }

  /**
   * Stop the processor and disconnect
   */
  stop() {
    console.log('[BLEHaloProcessor] Stopping...')

    // Remove only our handler, not all listeners
    if (this._deviceHandler) {
      bleScanner.off('bleDeviceDiscovered', this._deviceHandler)
      this._deviceHandler = null
    }

    this._started = false

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    this.disconnect()
  }

  /**
   * Handle device discovery - auto-connect to Halo
   */
  async handleDeviceDiscovered(device) {
    if (device.name !== HALO_DEVICE_NAME) {
      return
    }

    console.log(`[BLEHaloProcessor] Halo device discovered: ${device.name} (${device.address})`)

    // Don't connect if already connected or connecting
    if (this.connectionState !== 'disconnected') {
      console.log(`[BLEHaloProcessor] Already ${this.connectionState}, skipping...`)
      return
    }

    await this.connectToHalo(device.address)
  }

  /**
   * Connect to the Halo sensor
   */
  async connectToHalo(macAddress) {
    if (this.isConnecting) {
      console.log('[BLEHaloProcessor] Connection already in progress')
      return
    }

    this.isConnecting = true
    this.connectionState = 'connecting'
    this.emitConnectionStatus()

    try {
      console.log(`[BLEHaloProcessor] Connecting to Halo at ${macAddress}...`)

      // Get peripheral from scanner cache
      const peripheral = bleScanner.getPeripheralByMac(macAddress)

      if (!peripheral) {
        console.log('[BLEHaloProcessor] Peripheral not in cache, triggering new scan...')
        this.connectionState = 'disconnected'
        this.isConnecting = false
        // Trigger a new scan to rediscover the device
        if (bleScanner.bluetoothState === 'poweredOn' && !bleScanner.isScanning) {
          bleScanner.startScan()
        }
        return
      }

      // Stop scanning before connecting
      if (bleScanner.isScanning) {
        console.log('[BLEHaloProcessor] Stopping scan for connection...')
        await bleScanner.stopScan()
      }

      // Connect
      if (peripheral.state !== 'connected') {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout (15s)'))
          }, 15000)

          peripheral.connect((error) => {
            clearTimeout(timeout)
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          })
        })
      }

      console.log('[BLEHaloProcessor] Connected to Halo')
      this.connectedPeripheral = peripheral
      this.connectionState = 'connected'
      this.reconnectAttempts = 0

      // Stop scanning to reduce noise in logs
      if (bleScanner.isScanning) {
        console.log('[BLEHaloProcessor] Stopping BLE scanner after connection')
        await bleScanner.stopScan()
      }

      // Discover and subscribe to characteristics
      await this.discoverAndSubscribe(peripheral)

      // Set up disconnect handler
      peripheral.once('disconnect', () => {
        console.log('[BLEHaloProcessor] Halo disconnected')
        this.handleDisconnect()
      })

      this.emitConnectionStatus()

    } catch (error) {
      console.error('[BLEHaloProcessor] Connection failed:', error.message)
      this.connectionState = 'disconnected'
      this.emitConnectionStatus()

      // Schedule reconnect
      this.scheduleReconnect()

    } finally {
      this.isConnecting = false
    }
  }

  /**
   * Discover services and subscribe to characteristics
   */
  async discoverAndSubscribe(peripheral) {
    return new Promise((resolve, reject) => {
      console.log('[BLEHaloProcessor] Discovering services and characteristics...')

      peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
        if (error) {
          return reject(new Error('Discovery failed: ' + error.message))
        }

        console.log(`[BLEHaloProcessor] Found ${services.length} services, ${characteristics.length} characteristics`)

        // Log discovered services for debugging
        services.forEach(s => console.log(`  - Service: ${s.uuid}`))

        // Cache characteristics by UUID and log them
        console.log('[BLEHaloProcessor] Caching characteristics:')
        characteristics.forEach(char => {
          console.log(`  - Char: ${char.uuid} (service: ${char._serviceUuid})`)
          this.characteristics.set(char.uuid, char)
        })

        // Log expected UUIDs for debugging
        console.log('[BLEHaloProcessor] Looking for:')
        console.log(`  - Temp: ${TEMP_CHAR_UUID}`)
        console.log(`  - Humidity: ${HUMIDITY_CHAR_UUID}`)
        console.log(`  - Light: ${AMBIENT_LIGHT_CHAR_UUID}`)
        console.log(`  - IMU: ${ACCELERATION_CHAR_UUID}`)
        console.log(`  - Button: ${DIGITAL_CHAR_UUID}`)

        // Subscribe to IMU notifications
        const accelChar = this.characteristics.get(ACCELERATION_CHAR_UUID)
        if (accelChar) {
          console.log('[BLEHaloProcessor] Subscribing to IMU notifications...')
          accelChar.subscribe((error) => {
            if (error) {
              console.error('[BLEHaloProcessor] IMU subscription failed:', error)
            } else {
              console.log('[BLEHaloProcessor] IMU subscription successful')
            }
          })
          accelChar.on('data', (data) => this.handleIMUData(data))
        } else {
          console.warn('[BLEHaloProcessor] IMU characteristic not found')
        }

        // Subscribe to button notifications
        const buttonChar = this.characteristics.get(DIGITAL_CHAR_UUID)
        if (buttonChar) {
          console.log('[BLEHaloProcessor] Subscribing to button notifications...')
          buttonChar.subscribe((error) => {
            if (error) {
              console.error('[BLEHaloProcessor] Button subscription failed:', error)
            } else {
              console.log('[BLEHaloProcessor] Button subscription successful')
            }
          })
          buttonChar.on('data', (data) => this.handleButtonData(data))
        } else {
          console.warn('[BLEHaloProcessor] Button characteristic not found')
        }

        // Start polling for environmental sensors
        this.startPolling()

        // Do initial read
        this.readEnvironmentalSensors()

        resolve()
      })
    })
  }

  /**
   * Start polling environmental sensors
   */
  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }

    console.log(`[BLEHaloProcessor] Starting environmental sensor polling (every ${this.pollIntervalMs / 1000}s)`)

    this.pollInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.readEnvironmentalSensors()
      }
    }, this.pollIntervalMs)
  }

  /**
   * Read temperature, humidity, and light sensors
   */
  async readEnvironmentalSensors() {
    if (this.connectionState !== 'connected') {
      return
    }

    console.log('[BLEHaloProcessor] Reading environmental sensors...')

    try {
      // Read temperature
      const tempChar = this.characteristics.get(TEMP_CHAR_UUID)
      if (tempChar) {
        const tempData = await this.readCharacteristic(tempChar)
        if (tempData) {
          const tempC = tempData.readInt16LE(0) / 100.0
          const tempF = (tempC * 9 / 5) + 32
          this.sensorData.temperatureC = parseFloat(tempC.toFixed(2))
          this.sensorData.temperature = parseFloat(tempF.toFixed(1))
          console.log(`[BLEHaloProcessor] Temp: ${tempF.toFixed(1)}°F (${tempC.toFixed(2)}°C)`)
        }
      } else {
        console.log('[BLEHaloProcessor] Temperature characteristic NOT found')
      }

      // Read humidity
      const humidityChar = this.characteristics.get(HUMIDITY_CHAR_UUID)
      if (humidityChar) {
        const humidityData = await this.readCharacteristic(humidityChar)
        if (humidityData) {
          this.sensorData.humidity = parseFloat((humidityData.readUInt16LE(0) / 100.0).toFixed(1))
          console.log(`[BLEHaloProcessor] Humidity: ${this.sensorData.humidity}%`)
        }
      } else {
        console.log('[BLEHaloProcessor] Humidity characteristic NOT found')
      }

      // Read ambient light
      const lightChar = this.characteristics.get(AMBIENT_LIGHT_CHAR_UUID)
      if (lightChar) {
        const lightData = await this.readCharacteristic(lightChar)
        if (lightData) {
          this.sensorData.light = parseFloat((lightData.readUInt32LE(0) / 100.0).toFixed(1))
          console.log(`[BLEHaloProcessor] Light: ${this.sensorData.light} Lux`)
        }
      } else {
        console.log('[BLEHaloProcessor] Light characteristic NOT found')
      }

      this.sensorData.lastUpdate = new Date().toISOString()
      console.log('[BLEHaloProcessor] Emitting sensor update:', JSON.stringify(this.sensorData))
      this.emitSensorUpdate()

    } catch (error) {
      console.error('[BLEHaloProcessor] Error reading sensors:', error.message)
    }
  }

  /**
   * Read a characteristic value
   */
  readCharacteristic(characteristic) {
    return new Promise((resolve, reject) => {
      characteristic.read((error, data) => {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    })
  }

  /**
   * Handle IMU acceleration data notification
   */
  handleIMUData(data) {
    try {
      const x = data.readInt16LE(0) / 1000.0
      const y = data.readInt16LE(2) / 1000.0
      const z = data.readInt16LE(4) / 1000.0

      console.log(`[BLEHaloProcessor] IMU data: X=${x.toFixed(3)}, Y=${y.toFixed(3)}, Z=${z.toFixed(3)}`)

      this.sensorData.imu = {
        x: parseFloat(x.toFixed(3)),
        y: parseFloat(y.toFixed(3)),
        z: parseFloat(z.toFixed(3))
      }
      this.sensorData.lastUpdate = new Date().toISOString()

      this.emitSensorUpdate()
    } catch (error) {
      console.error('[BLEHaloProcessor] Error parsing IMU data:', error)
    }
  }

  /**
   * Handle button state notification
   */
  handleButtonData(data) {
    try {
      const state = data.readUInt8(0)
      this.sensorData.button = state
      this.sensorData.lastUpdate = new Date().toISOString()

      console.log(`[BLEHaloProcessor] Button: ${state === 1 ? 'Pressed' : 'Released'}`)

      this.emit('button-press', {
        pressed: state === 1,
        timestamp: this.sensorData.lastUpdate
      })

      this.emitSensorUpdate()
    } catch (error) {
      console.error('[BLEHaloProcessor] Error parsing button data:', error)
    }
  }

  /**
   * Handle disconnect - attempt reconnect
   */
  handleDisconnect() {
    this.connectionState = 'disconnected'
    this.connectedPeripheral = null
    this.characteristics.clear()

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    this.emitConnectionStatus()
    this.scheduleReconnect()
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[BLEHaloProcessor] Max reconnect attempts reached, waiting for new discovery')
      this.reconnectAttempts = 0
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts

    console.log(`[BLEHaloProcessor] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay / 1000}s`)

    setTimeout(() => {
      // Trigger a scan to find the device again
      if (bleScanner.bluetoothState === 'poweredOn' && !bleScanner.isScanning) {
        bleScanner.startScan()
      }
    }, delay)
  }

  /**
   * Disconnect from Halo
   */
  async disconnect() {
    if (this.connectedPeripheral && this.connectedPeripheral.state === 'connected') {
      return new Promise((resolve) => {
        this.connectedPeripheral.disconnect(() => {
          console.log('[BLEHaloProcessor] Disconnected from Halo')
          this.connectedPeripheral = null
          this.connectionState = 'disconnected'
          this.characteristics.clear()

          if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
          }

          this.emitConnectionStatus()
          resolve()
        })
      })
    }
  }

  /**
   * Emit connection status update
   */
  emitConnectionStatus() {
    this.emit('connection-status', {
      deviceName: HALO_DEVICE_NAME,
      status: this.connectionState,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Emit sensor data update
   */
  emitSensorUpdate() {
    this.emit('sensor-update', {
      ...this.sensorData,
      deviceName: HALO_DEVICE_NAME
    })
  }

  /**
   * Get current sensor data
   */
  getSensorData() {
    return {
      ...this.sensorData,
      connectionState: this.connectionState,
      deviceName: HALO_DEVICE_NAME
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      deviceName: HALO_DEVICE_NAME,
      connectionState: this.connectionState,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      sensorData: this.sensorData
    }
  }
}

// Create singleton instance
const bleHaloProcessor = new BLEHaloProcessor()

export default bleHaloProcessor
export { HALO_DEVICE_NAME }
