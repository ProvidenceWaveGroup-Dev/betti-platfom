import express from 'express'
import { MedicationRepo } from '../services/database.js'

const router = express.Router()

// Default user ID (until auth is implemented)
const DEFAULT_USER_ID = 1

/**
 * GET /api/medications - List all medications for user
 * Query: userId, activeOnly (default true)
 */
router.get('/', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const activeOnly = req.query.activeOnly !== 'false'

    const medications = MedicationRepo.getByUser(userId, activeOnly)

    res.json({
      success: true,
      data: medications,
      count: medications.length
    })
  } catch (error) {
    console.error('Error fetching medications:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medications'
    })
  }
})

/**
 * POST /api/medications - Add new medication with schedules
 * Body: {
 *   name, dosage, dosage_unit, instructions, is_prn, prn_max_daily,
 *   prescriber, pharmacy, rx_number, refills_left, start_date, end_date, notes,
 *   schedules: [{
 *     schedule_time: "08:00",
 *     dosage_amount: 1,
 *     frequency_type: "daily" | "specific_days" | "interval" | "prn",
 *     days_of_week: "mon,tue,wed,thu,fri",
 *     interval_days: 2,
 *     interval_start: "2025-12-01"
 *   }]
 * }
 */
router.post('/', (req, res) => {
  try {
    const {
      name,
      dosage,
      dosage_unit,
      instructions,
      prescriber,
      pharmacy,
      rx_number,
      refills_left,
      start_date,
      end_date,
      is_prn,
      prn_max_daily,
      notes,
      schedules
    } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Medication name is required'
      })
    }

    const medication = MedicationRepo.create(
      {
        user_id: DEFAULT_USER_ID,
        name,
        dosage,
        dosage_unit,
        instructions,
        prescriber,
        pharmacy,
        rx_number,
        refills_left,
        start_date,
        end_date,
        is_prn: is_prn ? 1 : 0,
        prn_max_daily,
        notes
      },
      schedules || []
    )

    console.log('Medication created:', medication)

    res.status(201).json({
      success: true,
      data: medication
    })
  } catch (error) {
    console.error('Error creating medication:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create medication'
    })
  }
})

/**
 * GET /api/medications/today - Get today's medication schedule with status
 * Returns: { scheduled: [...], prn: [...] }
 *
 * scheduled items have: medication_id, medication_name, dosage, dosage_unit,
 *   dosage_amount, instructions, schedule_id, scheduled_time, frequency_type,
 *   status ('pending' | 'taken' | 'skipped' | 'late'), taken_at, notes
 *
 * prn items have: medication_id, medication_name, dosage, dosage_unit,
 *   instructions, is_prn, prn_max_daily, doses_taken_today, can_take_more, notes
 */
router.get('/today', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const schedule = MedicationRepo.getTodaySchedule(userId)

    res.json({
      success: true,
      data: schedule,
      date: new Date().toISOString().split('T')[0]
    })
  } catch (error) {
    console.error('Error fetching today\'s schedule:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s medication schedule'
    })
  }
})

/**
 * GET /api/medications/adherence - Get adherence stats for past N days
 * Query: userId, days (default 7)
 */
router.get('/adherence', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const days = parseInt(req.query.days) || 7

    const stats = MedicationRepo.getAdherenceStats(userId, days)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching adherence stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch adherence statistics'
    })
  }
})

/**
 * GET /api/medications/overview - Get medication overview with weekly schedules
 * Query: userId
 * Returns: { medications: [...], today_summary: { scheduled_doses: [...], prn_medications: [...] } }
 */
router.get('/overview', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const overview = MedicationRepo.getOverview(userId)

    res.json({
      success: true,
      data: overview,
      date: new Date().toISOString().split('T')[0]
    })
  } catch (error) {
    console.error('Error fetching medication overview:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication overview'
    })
  }
})

/**
 * GET /api/medications/:id - Get medication with schedules
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const medication = MedicationRepo.getById(parseInt(id))

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    res.json({
      success: true,
      data: medication
    })
  } catch (error) {
    console.error('Error fetching medication:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication'
    })
  }
})

/**
 * GET /api/medications/:id/history - Get medication log history
 * Query: days (default 30)
 */
router.get('/:id/history', (req, res) => {
  try {
    const { id } = req.params
    const days = parseInt(req.query.days) || 30

    // Check if medication exists
    const existing = MedicationRepo.getById(parseInt(id))
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    const history = MedicationRepo.getHistory(parseInt(id), days)

    res.json({
      success: true,
      data: history,
      medication: existing,
      days
    })
  } catch (error) {
    console.error('Error fetching medication history:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication history'
    })
  }
})

/**
 * PUT /api/medications/:id - Update medication details and schedules
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      dosage,
      dosage_unit,
      instructions,
      prescriber,
      pharmacy,
      rx_number,
      refills_left,
      start_date,
      end_date,
      is_prn,
      prn_max_daily,
      notes,
      schedules
    } = req.body

    // Check if medication exists
    const existing = MedicationRepo.getById(parseInt(id))
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    const updated = MedicationRepo.update(parseInt(id), {
      name,
      dosage,
      dosage_unit,
      instructions,
      prescriber,
      pharmacy,
      rx_number,
      refills_left,
      start_date,
      end_date,
      is_prn: is_prn !== undefined ? (is_prn ? 1 : 0) : undefined,
      prn_max_daily,
      notes,
      schedules
    })

    console.log('Medication updated:', updated)

    res.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating medication:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update medication'
    })
  }
})

/**
 * DELETE /api/medications/:id - Soft delete (set is_active = 0)
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const deleted = MedicationRepo.softDelete(parseInt(id))

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    console.log('Medication soft deleted:', id)

    res.json({
      success: true,
      message: 'Medication deactivated successfully'
    })
  } catch (error) {
    console.error('Error deleting medication:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete medication'
    })
  }
})

/**
 * POST /api/medications/:id/take - Mark medication as taken
 * Body: { scheduleId?, dosage_amount?, notes? }
 */
router.post('/:id/take', (req, res) => {
  try {
    const { id } = req.params
    const { scheduleId, dosage_amount, notes } = req.body

    // Check if medication exists
    const existing = MedicationRepo.getById(parseInt(id))
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    const logEntry = MedicationRepo.markTaken(
      parseInt(id),
      scheduleId ? parseInt(scheduleId) : null,
      { dosage_amount, notes }
    )

    console.log('Medication marked as taken:', logEntry)

    res.json({
      success: true,
      message: 'Medication marked as taken',
      data: logEntry
    })
  } catch (error) {
    console.error('Error marking medication as taken:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to mark medication as taken'
    })
  }
})

/**
 * POST /api/medications/:id/skip - Mark medication as skipped
 * Body: { scheduleId?, reason? }
 */
router.post('/:id/skip', (req, res) => {
  try {
    const { id } = req.params
    const { scheduleId, reason } = req.body

    // Check if medication exists
    const existing = MedicationRepo.getById(parseInt(id))
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    const logEntry = MedicationRepo.markSkipped(
      parseInt(id),
      scheduleId ? parseInt(scheduleId) : null,
      reason
    )

    console.log('Medication marked as skipped:', logEntry)

    res.json({
      success: true,
      message: 'Medication marked as skipped',
      data: logEntry
    })
  } catch (error) {
    console.error('Error marking medication as skipped:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to mark medication as skipped'
    })
  }
})

/**
 * PUT /api/medications/:id/schedule - Update medication schedule (per-day format)
 * Body: {
 *   schedules: [
 *     { time: "07:00", doses: { mon: 25, tue: 25, wed: 25, thu: 25, fri: 25, sat: 50, sun: 50 } },
 *     { time: "18:00", doses: { mon: 500, tue: 500, wed: 500, ... } }
 *   ]
 * }
 */
router.put('/:id/schedule', (req, res) => {
  try {
    const { id } = req.params
    const { schedules } = req.body

    // Validate input
    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({
        success: false,
        error: 'schedules array is required'
      })
    }

    // Validate each schedule entry
    const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    for (const schedule of schedules) {
      if (!schedule.time || !/^\d{2}:\d{2}$/.test(schedule.time)) {
        return res.status(400).json({
          success: false,
          error: 'Each schedule must have a valid time in HH:MM format'
        })
      }
      if (!schedule.doses || typeof schedule.doses !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Each schedule must have a doses object'
        })
      }
    }

    // Check if medication exists
    const existing = MedicationRepo.getById(parseInt(id))
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      })
    }

    // Update the schedule using the new per-day format
    const result = MedicationRepo.updateSchedulePerDay(parseInt(id), schedules)

    console.log('Medication schedule updated:', id)

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      data: result
    })
  } catch (error) {
    console.error('Error updating medication schedule:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update medication schedule'
    })
  }
})

export default router
