import noble from '@abandonware/noble'
import { EventEmitter } from 'events'

class BLEScanner extends EventEmitter {
  constructor() {
    console.log('[BLEScanner] Initializing...');
    super()
    this.isScanning = false
    this.scanTimeout = null
    this.discoveredDevices = new Map()
    this.discoveredPeripherals = new Map() // Cache peripheral objects for connection (MAC -> peripheral)
    this.scanDuration = 30000 // 30 seconds
    this.bluetoothState = 'unknown'

    noble.on('stateChange', (state) => {
      console.log(`[BLEScanner] Noble state changed to ${state}`)
      this.bluetoothState = state
      this.emit('bleStateChange', this.bluetoothState)
      if (state === 'poweredOn') {
        // Optionally start scanning immediately if it was requested before noble was ready
        // if (this.isScanning) {
        //   this.startScan()
        // }
      } else {
        if (this.isScanning) {
          console.log('[BLEScanner] Bluetooth is not powered on, stopping scan.');
          this.stopScan()
        }
      }
    })

    noble.on('discover', (peripheral) => {
      console.log('[BLEScanner] Discovered peripheral:', peripheral.address);
      const address = peripheral.address // MAC address
      const name = peripheral.advertisement.localName || peripheral.address
      const rssi = peripheral.rssi

      this.handleDeviceDiscovery(address, name, rssi, peripheral)
    })
  }

  handleDeviceDiscovery(address, name, rssi, peripheral = null) {
    console.log(`[BLEScanner] Handling device discovery: ${name} (${address})`);
    // Normalize MAC address format
    const normalizedAddress = address.toUpperCase()
    const deviceId = normalizedAddress.replace(/:/g, '').toLowerCase()

    const device = {
      id: deviceId,
      name: name || 'Unknown Device',
      address: normalizedAddress,
      rssi: rssi || 0,
      lastSeen: new Date().toISOString(),
      manufacturer: null // Noble might provide this, but for now keep it null
    }

    // Cache peripheral object for connection (key = uppercase MAC WITHOUT separators)
    if (peripheral) {
      const cacheKey = normalizedAddress.replace(/[:-]/g, '') // Remove separators
      console.log(`[BLEScanner] DEBUG: Caching peripheral - normalized: "${normalizedAddress}", cacheKey: "${cacheKey}"`)
      this.discoveredPeripherals.set(cacheKey, peripheral)
      console.log(`[BLEScanner] DEBUG: Cache now has ${this.discoveredPeripherals.size} peripherals`)
    }

    // Check if device is new or needs updating
    const existingDevice = this.discoveredDevices.get(device.id)
    if (!existingDevice || existingDevice.rssi !== device.rssi || (existingDevice.name === 'Unknown Device' && name !== 'Unknown Device')) {
      this.discoveredDevices.set(device.id, device)

      // Emit event for discovered device
      this.emit('bleDeviceDiscovered', device)

      console.log(`[BLEScanner] 📱 BLE Device Updated/Added: ${device.name} (${device.address}) - RSSI: ${device.rssi}`)
    }
  }

  async startScan() {
    console.log('[BLEScanner] startScan called.');
    if (this.isScanning) {
      console.log('[BLEScanner] Scan already in progress')
      return { success: false, message: 'Scan already in progress' }
    }

    if (this.bluetoothState !== 'poweredOn') {
      const message = `[BLEScanner] Bluetooth not powered on. Current state: ${this.bluetoothState}`
      console.error(message)
      this.emit('bleScanStatus', {
        status: 'error',
        error: message
      })
      return { success: false, message: message }
    }

    try {
      // Clear previous discoveries
      this.discoveredDevices.clear()
      this.isScanning = true

      // Emit scan started status
      this.emit('bleScanStatus', {
        status: 'scanning'
      })

      console.log(`[BLEScanner] 🔍 Starting BLE scan for ${this.scanDuration / 1000} seconds using Noble...`)

      await noble.startScanning([], true) // Scan for all services, allow duplicates
      console.log('[BLEScanner] noble.startScanning() called successfully.');

      // Set timeout to stop scanning after duration
      this.scanTimeout = setTimeout(() => {
        console.log('[BLEScanner] Scan timeout reached.');
        this.stopScan()
      }, this.scanDuration)

      return { success: true, message: 'Scan started' }
    } catch (error) {
      console.error('[BLEScanner] Error starting BLE scan:', error)
      this.isScanning = false

      this.emit('bleScanStatus', {
        status: 'error',
        error: error.message
      })

      return { success: false, message: error.message }
    }
  }

  async stopScan() {
    console.log('[BLEScanner] stopScan called.');
    if (!this.isScanning) {
      console.log('[BLEScanner] Not currently scanning.');
      return
    }

    try {
      console.log('[BLEScanner] 🛑 Stopping BLE scan...')

      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout)
        this.scanTimeout = null
      }

      await noble.stopScanning()
      console.log('[BLEScanner] noble.stopScanning() called.');

      this.isScanning = false

      // Emit scan completed status
      this.emit('bleScanStatus', {
        status: 'idle',
        devicesFound: this.discoveredDevices.size
      })

      console.log(`[BLEScanner] ✅ Scan complete. Found ${this.discoveredDevices.size} devices`)
    } catch (error) {
      console.error('[BLEScanner] Error stopping BLE scan:', error)
      this.isScanning = false
    }
  }

  /**
   * Get cached peripheral object by MAC address
   * Required for noble.connect() calls in bleConnectionManager
   */
  getPeripheralByMac(macAddress) {
    // Normalize to uppercase without separators to match cache key format
    const normalizedAddress = macAddress.toUpperCase().replace(/[:-]/g, '')
    console.log(`[BLEScanner] DEBUG: getPeripheralByMac - input: "${macAddress}", normalized: "${normalizedAddress}"`)
    console.log(`[BLEScanner] DEBUG: Cache size: ${this.discoveredPeripherals.size}`)
    const peripheral = this.discoveredPeripherals.get(normalizedAddress)
    if (!peripheral) {
      console.log(`[BLEScanner] DEBUG: Lookup FAILED - available keys:`, Array.from(this.discoveredPeripherals.keys()))
    } else {
      console.log(`[BLEScanner] DEBUG: Lookup SUCCESS - found peripheral`)
    }
    return peripheral || null
  }

  getStatus() {
    console.log('[BLEScanner] getStatus called.');
    return {
      isScanning: this.isScanning,
      bluetoothState: this.bluetoothState,
      devicesFound: this.discoveredDevices.size,
      devices: Array.from(this.discoveredDevices.values())
    }
  }
}

// Create singleton instance
const bleScanner = new BLEScanner()

export default bleScanner
