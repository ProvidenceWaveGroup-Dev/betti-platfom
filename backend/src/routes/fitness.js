import express from 'express'
import { WorkoutRepo } from '../services/database.js'
import bleFitnessProcessor from '../services/bleFitnessProcessor.js'

const router = express.Router()

// Default user ID (until auth is implemented)
const DEFAULT_USER_ID = 1

/**
 * POST /api/fitness/workout - Log a workout
 * Body: { workout_type, duration_min, calories_burned?, distance_miles?, steps?,
 *         heart_rate_avg?, intensity?, video_id?, notes?, started_at, ended_at? }
 */
router.post('/workout', (req, res) => {
  try {
    const {
      workout_type,
      duration_min,
      calories_burned,
      distance_miles,
      steps,
      heart_rate_avg,
      intensity,
      video_id,
      notes,
      started_at,
      ended_at
    } = req.body

    // Validate required fields
    if (!workout_type || !duration_min || !started_at) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workout_type, duration_min, and started_at are required'
      })
    }

    // Create workout using WorkoutRepo
    const workout = WorkoutRepo.create({
      user_id: DEFAULT_USER_ID,
      workout_type,
      duration_min: parseInt(duration_min),
      calories_burned: calories_burned ? parseInt(calories_burned) : Math.round(duration_min * 8),
      distance_miles: distance_miles ? parseFloat(distance_miles) : null,
      steps: steps ? parseInt(steps) : null,
      heart_rate_avg: heart_rate_avg ? parseInt(heart_rate_avg) : null,
      intensity: intensity || 'moderate',
      video_id: video_id || null,
      notes: notes || null,
      started_at: new Date(started_at).toISOString(),
      ended_at: ended_at ? new Date(ended_at).toISOString() : null
    })

    console.log('Workout logged:', workout)

    res.status(201).json({
      success: true,
      data: workout
    })
  } catch (error) {
    console.error('Error logging workout:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to log workout'
    })
  }
})

/**
 * GET /api/fitness/workouts - Get workout history
 * Query: userId, startDate?, endDate?, type?, limit (default 20)
 */
router.get('/workouts', (req, res) => {
  try {
    const { startDate, endDate, type, limit = 20 } = req.query
    const userId = DEFAULT_USER_ID

    let workouts

    if (type) {
      // Filter by workout type
      workouts = WorkoutRepo.getByType(userId, type, parseInt(limit))
    } else if (startDate && endDate) {
      // Filter by date range
      workouts = WorkoutRepo.getByDateRange(userId, startDate, endDate, parseInt(limit))
    } else if (startDate) {
      // From start date to today
      const today = new Date().toISOString().split('T')[0]
      workouts = WorkoutRepo.getByDateRange(userId, startDate, today, parseInt(limit))
    } else {
      // Get recent workouts (last 30 days by default)
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      workouts = WorkoutRepo.getByDateRange(userId, startDate.toISOString().split('T')[0], endDate, parseInt(limit))
    }

    res.json({
      success: true,
      data: workouts,
      total: workouts.length,
      limit: parseInt(limit)
    })
  } catch (error) {
    console.error('Error fetching workouts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workouts'
    })
  }
})

/**
 * GET /api/fitness/workout/:id - Get single workout details
 */
router.get('/workout/:id', (req, res) => {
  try {
    const { id } = req.params
    const workout = WorkoutRepo.getById(parseInt(id))

    if (!workout) {
      return res.status(404).json({
        success: false,
        error: 'Workout not found'
      })
    }

    res.json({
      success: true,
      data: workout
    })
  } catch (error) {
    console.error('Error fetching workout:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workout'
    })
  }
})

/**
 * DELETE /api/fitness/workout/:id - Delete a workout
 */
router.delete('/workout/:id', (req, res) => {
  try {
    const { id } = req.params
    const deleted = WorkoutRepo.delete(parseInt(id))

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Workout not found'
      })
    }

    console.log('Workout deleted:', id)

    res.json({
      success: true,
      message: 'Workout deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting workout:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete workout'
    })
  }
})

/**
 * GET /api/fitness/today - Get today's activity summary
 * Returns: { steps, active_minutes, calories_burned, workouts: [...] }
 */
router.get('/today', (req, res) => {
  try {
    const userId = DEFAULT_USER_ID
    const summary = WorkoutRepo.getTodaySummary(userId)

    res.json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Error fetching today\'s activity:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s activity'
    })
  }
})

/**
 * PUT /api/fitness/daily - Update daily activity totals (from wearable sync)
 * Body: { date?, steps, active_minutes, calories_burned, floors_climbed?, distance_miles? }
 */
router.put('/daily', (req, res) => {
  try {
    const {
      date,
      steps,
      active_minutes,
      calories_burned,
      floors_climbed,
      distance_miles,
      source
    } = req.body

    const userId = DEFAULT_USER_ID
    const activityDate = date || new Date().toISOString().split('T')[0]

    const updatedActivity = WorkoutRepo.updateDailyActivity(userId, activityDate, {
      steps: steps !== undefined ? parseInt(steps) : undefined,
      active_minutes: active_minutes !== undefined ? parseInt(active_minutes) : undefined,
      calories_burned: calories_burned !== undefined ? parseInt(calories_burned) : undefined,
      floors_climbed: floors_climbed !== undefined ? parseInt(floors_climbed) : undefined,
      distance_miles: distance_miles !== undefined ? parseFloat(distance_miles) : undefined,
      source: source || 'manual'
    })

    console.log('Daily activity updated:', updatedActivity)

    res.json({
      success: true,
      data: updatedActivity
    })
  } catch (error) {
    console.error('Error updating daily activity:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update daily activity'
    })
  }
})

/**
 * GET /api/fitness/weekly - Get 7-day activity summary
 */
router.get('/weekly', (req, res) => {
  try {
    const userId = DEFAULT_USER_ID
    const summary = WorkoutRepo.getWeeklySummary(userId)

    res.json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Error fetching weekly activity:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly activity'
    })
  }
})

// ============================================================
// BLE FITNESS DEVICE ENDPOINTS
// ============================================================

/**
 * POST /api/fitness/device/register - Register a BLE fitness device
 * Body: { address, name, type, userId? }
 * Types: 'fitness_band', 'smartwatch', 'pedometer'
 */
router.post('/device/register', (req, res) => {
  try {
    const { address, name, type, userId } = req.body

    if (!address || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: address and name are required'
      })
    }

    const validTypes = ['fitness_band', 'smartwatch', 'pedometer', 'heart_rate_monitor']
    const deviceType = validTypes.includes(type) ? type : 'fitness_band'

    bleFitnessProcessor.registerDevice(
      address,
      name,
      deviceType,
      userId || DEFAULT_USER_ID
    )

    res.status(201).json({
      success: true,
      message: `Device ${name} registered successfully`,
      data: {
        address: address.toUpperCase(),
        name,
        type: deviceType,
        userId: userId || DEFAULT_USER_ID
      }
    })
  } catch (error) {
    console.error('Error registering device:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to register device'
    })
  }
})

/**
 * DELETE /api/fitness/device/:address - Unregister a BLE fitness device
 */
router.delete('/device/:address', (req, res) => {
  try {
    const { address } = req.params

    bleFitnessProcessor.unregisterDevice(address)

    res.json({
      success: true,
      message: `Device ${address} unregistered successfully`
    })
  } catch (error) {
    console.error('Error unregistering device:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to unregister device'
    })
  }
})

/**
 * GET /api/fitness/devices - Get all registered fitness devices
 * Query: userId? - Filter by user ID
 */
router.get('/devices', (req, res) => {
  try {
    const { userId } = req.query

    let devices
    if (userId) {
      devices = bleFitnessProcessor.getDevicesForUser(parseInt(userId))
    } else {
      devices = bleFitnessProcessor.getRegisteredDevices()
    }

    res.json({
      success: true,
      data: devices,
      count: devices.length
    })
  } catch (error) {
    console.error('Error fetching devices:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices'
    })
  }
})

/**
 * POST /api/fitness/device/activity - Submit activity data from a BLE device
 * Body: { deviceAddress, steps?, calories?, active_minutes?, distance_miles?, floors_climbed?, deviceName? }
 * This is the main endpoint for devices to push activity updates
 */
router.post('/device/activity', async (req, res) => {
  try {
    const {
      deviceAddress,
      steps,
      calories,
      active_minutes,
      distance_miles,
      floors_climbed,
      deviceName
    } = req.body

    if (!deviceAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: deviceAddress'
      })
    }

    // At least one activity metric should be provided
    if (steps === undefined && calories === undefined && active_minutes === undefined &&
        distance_miles === undefined && floors_climbed === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one activity metric is required (steps, calories, active_minutes, distance_miles, or floors_climbed)'
      })
    }

    const activityData = {
      steps: steps !== undefined ? parseInt(steps) : undefined,
      calories: calories !== undefined ? parseInt(calories) : undefined,
      active_minutes: active_minutes !== undefined ? parseInt(active_minutes) : undefined,
      distance_miles: distance_miles !== undefined ? parseFloat(distance_miles) : undefined,
      floors_climbed: floors_climbed !== undefined ? parseInt(floors_climbed) : undefined
    }

    // Remove undefined values
    Object.keys(activityData).forEach(key => {
      if (activityData[key] === undefined) delete activityData[key]
    })

    const result = await bleFitnessProcessor.processActivityData(
      deviceAddress,
      activityData,
      { deviceName }
    )

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process activity data'
      })
    }

    res.json({
      success: true,
      message: 'Activity data processed successfully',
      data: result
    })
  } catch (error) {
    console.error('Error processing device activity:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process activity data'
    })
  }
})

/**
 * POST /api/fitness/device/sync - Full day sync from a BLE device
 * Body: { deviceAddress, steps, calories, active_minutes, distance_miles?, floors_climbed?, deviceName? }
 * Use this for end-of-day or periodic full sync from a device
 */
router.post('/device/sync', async (req, res) => {
  try {
    const {
      deviceAddress,
      steps,
      calories,
      active_minutes,
      distance_miles,
      floors_climbed,
      deviceName
    } = req.body

    if (!deviceAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: deviceAddress'
      })
    }

    const syncData = {
      steps: steps !== undefined ? parseInt(steps) : 0,
      calories: calories !== undefined ? parseInt(calories) : 0,
      active_minutes: active_minutes !== undefined ? parseInt(active_minutes) : 0,
      distance_miles: distance_miles !== undefined ? parseFloat(distance_miles) : 0,
      floors_climbed: floors_climbed !== undefined ? parseInt(floors_climbed) : 0
    }

    const result = await bleFitnessProcessor.processFullSync(
      deviceAddress,
      syncData,
      { deviceName }
    )

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process sync data'
      })
    }

    res.json({
      success: true,
      message: 'Full sync completed successfully',
      data: result
    })
  } catch (error) {
    console.error('Error processing device sync:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process sync data'
    })
  }
})

/**
 * PUT /api/fitness/device/timezone - Set timezone offset for activity calculations
 * Body: { offsetMinutes } - Offset in minutes from UTC (negative = west of UTC)
 * Example: EST = -300 (5 hours * 60 minutes)
 */
router.put('/device/timezone', (req, res) => {
  try {
    const { offsetMinutes } = req.body

    if (offsetMinutes === undefined || typeof offsetMinutes !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid offsetMinutes (must be a number)'
      })
    }

    bleFitnessProcessor.setTimezoneOffset(offsetMinutes)

    res.json({
      success: true,
      message: `Timezone offset set to ${offsetMinutes} minutes`,
      data: {
        offsetMinutes,
        offsetHours: offsetMinutes / 60,
        currentDate: bleFitnessProcessor.getTodayDate()
      }
    })
  } catch (error) {
    console.error('Error setting timezone:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to set timezone'
    })
  }
})

/**
 * GET /api/fitness/device/current - Get current activity from BLE processor
 * Returns the real-time aggregated activity from all devices
 */
router.get('/device/current', (req, res) => {
  try {
    const userId = DEFAULT_USER_ID
    const activity = bleFitnessProcessor.getCurrentActivity(userId)

    res.json({
      success: true,
      data: activity,
      date: bleFitnessProcessor.getTodayDate()
    })
  } catch (error) {
    console.error('Error fetching current activity:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current activity'
    })
  }
})

export default router
