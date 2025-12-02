import { EventEmitter } from 'events'
import { WorkoutRepo } from './database.js'

/**
 * BLE Fitness Data Processor
 *
 * Processes incoming activity data from BLE fitness devices/wearables.
 * Handles step counts, active minutes, calories, distance from devices
 * like fitness bands, smartwatches, and pedometers.
 *
 * Features:
 * - Aggregates data into daily_activity table
 * - Handles multiple devices (uses highest value strategy)
 * - Broadcasts updates via WebSocket for real-time dashboard
 * - Timezone-aware "today" calculations
 *
 * Standard BLE Fitness Service UUIDs:
 * - Running Speed and Cadence: 0x1814
 * - Cycling Speed and Cadence: 0x1816
 * - Fitness Machine: 0x1826
 */

// BLE Service UUIDs for fitness devices
const BLE_FITNESS_SERVICES = {
  RUNNING_SPEED_CADENCE: '1814',
  CYCLING_SPEED_CADENCE: '1816',
  FITNESS_MACHINE: '1826',
  USER_DATA: '181c'
}

// Aggregation strategies for multiple devices
const AGGREGATION_STRATEGY = {
  HIGHEST: 'highest',  // Use the highest reported value (for steps, calories)
  SUM: 'sum',          // Sum all device values (for distance from different activities)
  LATEST: 'latest'     // Use the most recent value
}

// Default timezone offset (can be overridden per user)
const DEFAULT_TIMEZONE_OFFSET = -5 * 60 // EST (-5 hours in minutes)

class BLEFitnessProcessor extends EventEmitter {
  constructor() {
    super()

    // Track device readings for aggregation
    // Key: `${date}_${deviceAddress}`, Value: { steps, calories, distance, active_minutes, timestamp }
    this.deviceReadings = new Map()

    // Registered fitness devices
    // Key: deviceAddress, Value: { name, type, lastSeen, userId }
    this.knownDevices = new Map()

    // Current timezone offset in minutes (negative = west of UTC)
    this.timezoneOffset = DEFAULT_TIMEZONE_OFFSET

    // Cleanup interval for old readings (keep 2 days)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldReadings()
    }, 60000) // Run every minute

    console.log('[BLEFitnessProcessor] Initialized')
  }

  /**
   * Set the timezone offset for "today" calculations
   * @param {number} offsetMinutes - Offset in minutes from UTC (negative = west)
   */
  setTimezoneOffset(offsetMinutes) {
    this.timezoneOffset = offsetMinutes
    console.log(`[BLEFitnessProcessor] Timezone offset set to ${offsetMinutes} minutes`)
  }

  /**
   * Get the current date string in the configured timezone
   * @returns {string} Date string in YYYY-MM-DD format
   */
  getTodayDate() {
    const now = new Date()
    // Apply timezone offset
    const localTime = new Date(now.getTime() + (this.timezoneOffset * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000))
    return localTime.toISOString().split('T')[0]
  }

  /**
   * Register a fitness device
   * @param {string} address - Device MAC address
   * @param {string} name - Device name
   * @param {string} type - Device type: 'fitness_band', 'smartwatch', 'pedometer'
   * @param {number} userId - User ID this device belongs to
   */
  registerDevice(address, name, type, userId = 1) {
    const normalizedAddress = address.toUpperCase()
    this.knownDevices.set(normalizedAddress, {
      name,
      type,
      userId,
      registeredAt: new Date().toISOString(),
      lastSeen: null
    })
    console.log(`[BLEFitnessProcessor] Registered fitness device: ${name} (${normalizedAddress}) for user ${userId}`)
  }

  /**
   * Unregister a device
   * @param {string} address - Device MAC address
   */
  unregisterDevice(address) {
    const normalizedAddress = address.toUpperCase()
    this.knownDevices.delete(normalizedAddress)
    console.log(`[BLEFitnessProcessor] Unregistered device: ${normalizedAddress}`)
  }

  /**
   * Get user ID for a device (defaults to 1 if unknown)
   * @param {string} deviceAddress - Device MAC address
   * @returns {number} User ID
   */
  getUserIdForDevice(deviceAddress) {
    const device = this.knownDevices.get(deviceAddress.toUpperCase())
    return device?.userId || 1
  }

  /**
   * Process activity data from a BLE fitness device
   * @param {string} deviceAddress - Device MAC address
   * @param {object} data - Activity data
   * @param {number} data.steps - Step count
   * @param {number} data.calories - Calories burned
   * @param {number} data.active_minutes - Active minutes
   * @param {number} data.distance_miles - Distance in miles
   * @param {number} data.floors_climbed - Floors climbed
   * @param {object} options - Additional options
   * @returns {object} Updated daily activity
   */
  async processActivityData(deviceAddress, data, options = {}) {
    const normalizedAddress = deviceAddress.toUpperCase()
    const userId = this.getUserIdForDevice(normalizedAddress)
    const today = this.getTodayDate()
    const readingKey = `${today}_${normalizedAddress}`

    try {
      // Store this device's reading
      const reading = {
        steps: data.steps || 0,
        calories: data.calories || data.calories_burned || 0,
        active_minutes: data.active_minutes || 0,
        distance_miles: data.distance_miles || 0,
        floors_climbed: data.floors_climbed || 0,
        timestamp: new Date().toISOString(),
        deviceName: options.deviceName || this.knownDevices.get(normalizedAddress)?.name || normalizedAddress
      }

      this.deviceReadings.set(readingKey, reading)

      // Update device last seen
      this.updateDeviceLastSeen(normalizedAddress)

      // Aggregate readings from all devices for this user and date
      const aggregated = this.aggregateDeviceReadings(userId, today)

      // Update the daily_activity table
      const updatedActivity = WorkoutRepo.updateDailyActivity(userId, today, {
        steps: aggregated.steps,
        active_minutes: aggregated.active_minutes,
        calories_burned: aggregated.calories,
        floors_climbed: aggregated.floors_climbed,
        distance_miles: aggregated.distance_miles,
        source: `ble_device:${normalizedAddress}`
      })

      console.log(`[BLEFitnessProcessor] Updated daily activity for user ${userId}: ${aggregated.steps} steps, ${aggregated.calories} cal, ${aggregated.active_minutes} min`)

      // Emit event for WebSocket broadcast
      this.emit('activityUpdated', {
        userId,
        date: today,
        activity: updatedActivity,
        deviceAddress: normalizedAddress,
        source: 'ble_device'
      })

      return updatedActivity
    } catch (error) {
      console.error(`[BLEFitnessProcessor] Error processing activity data:`, error)
      this.emit('error', {
        type: 'activity_update',
        deviceAddress: normalizedAddress,
        error: error.message
      })
      return null
    }
  }

  /**
   * Process step count update
   * @param {string} deviceAddress - Device MAC address
   * @param {number} steps - Current step count
   * @param {object} options - Additional options
   */
  async processSteps(deviceAddress, steps, options = {}) {
    return this.processActivityData(deviceAddress, { steps }, options)
  }

  /**
   * Process calories update
   * @param {string} deviceAddress - Device MAC address
   * @param {number} calories - Calories burned
   * @param {object} options - Additional options
   */
  async processCalories(deviceAddress, calories, options = {}) {
    return this.processActivityData(deviceAddress, { calories }, options)
  }

  /**
   * Process active minutes update
   * @param {string} deviceAddress - Device MAC address
   * @param {number} activeMinutes - Active minutes
   * @param {object} options - Additional options
   */
  async processActiveMinutes(deviceAddress, activeMinutes, options = {}) {
    return this.processActivityData(deviceAddress, { active_minutes: activeMinutes }, options)
  }

  /**
   * Process distance update
   * @param {string} deviceAddress - Device MAC address
   * @param {number} distanceMiles - Distance in miles
   * @param {object} options - Additional options
   */
  async processDistance(deviceAddress, distanceMiles, options = {}) {
    return this.processActivityData(deviceAddress, { distance_miles: distanceMiles }, options)
  }

  /**
   * Process full sync from a fitness device (e.g., end of day sync)
   * @param {string} deviceAddress - Device MAC address
   * @param {object} data - Full activity data for the day
   * @param {object} options - Additional options
   */
  async processFullSync(deviceAddress, data, options = {}) {
    console.log(`[BLEFitnessProcessor] Full sync from ${deviceAddress}:`, data)
    return this.processActivityData(deviceAddress, data, options)
  }

  /**
   * Aggregate readings from all devices for a user on a specific date
   * Uses "highest" strategy for most metrics (assumes devices track the same activity)
   * @param {number} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {object} Aggregated activity data
   */
  aggregateDeviceReadings(userId, date) {
    const aggregated = {
      steps: 0,
      calories: 0,
      active_minutes: 0,
      distance_miles: 0,
      floors_climbed: 0,
      deviceCount: 0
    }

    // Find all readings for this date from devices belonging to this user
    for (const [key, reading] of this.deviceReadings.entries()) {
      if (!key.startsWith(date)) continue

      const deviceAddress = key.split('_')[1]
      const deviceUserId = this.getUserIdForDevice(deviceAddress)

      if (deviceUserId !== userId) continue

      aggregated.deviceCount++

      // Use highest value strategy for each metric
      // This handles cases where multiple devices track the same activity
      aggregated.steps = Math.max(aggregated.steps, reading.steps)
      aggregated.calories = Math.max(aggregated.calories, reading.calories)
      aggregated.active_minutes = Math.max(aggregated.active_minutes, reading.active_minutes)
      aggregated.floors_climbed = Math.max(aggregated.floors_climbed, reading.floors_climbed)

      // For distance, sum across devices (different activities might be tracked separately)
      // If this causes issues, can switch to highest
      aggregated.distance_miles = Math.max(aggregated.distance_miles, reading.distance_miles)
    }

    return aggregated
  }

  /**
   * Get current activity summary for a user
   * @param {number} userId - User ID
   * @returns {object} Current daily activity
   */
  getCurrentActivity(userId) {
    const today = this.getTodayDate()
    return WorkoutRepo.getTodaySummary(userId)
  }

  /**
   * Update device last seen timestamp
   * @param {string} deviceAddress - Device MAC address
   */
  updateDeviceLastSeen(deviceAddress) {
    const device = this.knownDevices.get(deviceAddress)
    if (device) {
      device.lastSeen = new Date().toISOString()
    }
  }

  /**
   * Get all registered fitness devices
   * @returns {Array} List of registered devices
   */
  getRegisteredDevices() {
    return Array.from(this.knownDevices.entries()).map(([address, info]) => ({
      address,
      ...info
    }))
  }

  /**
   * Get devices for a specific user
   * @param {number} userId - User ID
   * @returns {Array} List of devices for this user
   */
  getDevicesForUser(userId) {
    return this.getRegisteredDevices().filter(d => d.userId === userId)
  }

  /**
   * Clean up readings older than 2 days
   */
  cleanupOldReadings() {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const cutoffDate = twoDaysAgo.toISOString().split('T')[0]

    let cleaned = 0
    for (const key of this.deviceReadings.keys()) {
      const readingDate = key.split('_')[0]
      if (readingDate < cutoffDate) {
        this.deviceReadings.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`[BLEFitnessProcessor] Cleaned up ${cleaned} old readings`)
    }
  }

  /**
   * Parse Running Speed and Cadence characteristic data
   * @param {Buffer} data - Raw BLE data
   * @returns {object} Parsed data
   */
  parseRunningSpeedCadence(data) {
    const flags = data[0]
    let offset = 1

    const result = {
      type: 'running',
      instantSpeed: null,      // m/s
      instantCadence: null,    // steps/min
      strideLength: null,      // cm
      totalDistance: null      // m
    }

    // Instantaneous Speed (always present)
    result.instantSpeed = data.readUInt16LE(offset) / 256 // m/s with 1/256 resolution
    offset += 2

    // Instantaneous Cadence
    result.instantCadence = data[offset]
    offset += 1

    // Stride Length (if present)
    if (flags & 0x01) {
      result.strideLength = data.readUInt16LE(offset)
      offset += 2
    }

    // Total Distance (if present)
    if (flags & 0x02) {
      result.totalDistance = data.readUInt32LE(offset) / 10 // decimeters to meters
    }

    return result
  }

  /**
   * Convert meters to miles
   * @param {number} meters - Distance in meters
   * @returns {number} Distance in miles
   */
  metersToMiles(meters) {
    return meters * 0.000621371
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.deviceReadings.clear()
    this.knownDevices.clear()
    this.removeAllListeners()
    console.log('[BLEFitnessProcessor] Destroyed')
  }
}

// Create singleton instance
const bleFitnessProcessor = new BLEFitnessProcessor()

export default bleFitnessProcessor
export { BLE_FITNESS_SERVICES, AGGREGATION_STRATEGY }
