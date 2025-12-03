import express from 'express'
import { AppointmentRepo, getDatabase } from '../services/database.js'
import { expandRecurringAppointments } from '../services/recurrenceService.js'

const router = express.Router()

// Default user ID (until auth is implemented)
const DEFAULT_USER_ID = 1

/**
 * GET /api/appointments - Get appointments with optional filters
 * Query: userId, startDate, endDate, status, type, limit
 */
router.get('/', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const { startDate, endDate, status, type, limit } = req.query

    let appointments

    if (startDate && endDate) {
      appointments = AppointmentRepo.getByDateRange(userId, startDate, endDate)
    } else {
      // Default to upcoming 30 days
      appointments = AppointmentRepo.getUpcoming(userId, 30, parseInt(limit) || 100)
    }

    // Apply filters
    if (status) {
      appointments = appointments.filter(apt => apt.status === status)
    }
    if (type) {
      appointments = appointments.filter(apt => apt.appointment_type === type)
    }

    res.json({
      success: true,
      data: appointments,
      count: appointments.length
    })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    })
  }
})

/**
 * GET /api/appointments/today - Get today's appointments as a to-do list
 * Returns: [{ id, title, time, type, status, location, provider }]
 */
router.get('/today', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const appointments = AppointmentRepo.getToday(userId)

    // Calculate today's date range
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    // Expand recurring appointments for today
    const db = getDatabase()
    const expandedAppointments = expandRecurringAppointments(appointments, startOfDay, endOfDay, db)

    res.json({
      success: true,
      data: expandedAppointments,
      count: expandedAppointments.length
    })
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s appointments'
    })
  }
})

/**
 * GET /api/appointments/upcoming - Get upcoming appointments (next N days)
 * Query: userId, days (default 30), limit
 */
router.get('/upcoming', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const days = parseInt(req.query.days) || 30
    const limit = parseInt(req.query.limit) || 20

    const appointments = AppointmentRepo.getUpcoming(userId, days, limit)

    // Calculate date range for upcoming days
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)
    endDate.setHours(23, 59, 59, 999)

    // Expand recurring appointments
    const db = getDatabase()
    const expandedAppointments = expandRecurringAppointments(appointments, startDate, endDate, db)

    // Apply limit after expansion
    const limitedAppointments = expandedAppointments.slice(0, limit)

    res.json({
      success: true,
      data: limitedAppointments,
      count: limitedAppointments.length
    })
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming appointments'
    })
  }
})

/**
 * GET /api/appointments/month/:year/:month - Get all appointments for a specific month
 * Returns: { [date]: [appointments] }
 */
router.get('/month/:year/:month', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year or month'
      })
    }

    const appointments = AppointmentRepo.getByMonth(userId, year, month)

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1) // First day of month
    const endDate = new Date(year, month, 0) // Last day of month
    endDate.setHours(23, 59, 59, 999) // End of last day

    // Expand recurring appointments for this month
    const db = getDatabase()
    const expandedAppointments = expandRecurringAppointments(appointments, startDate, endDate, db)

    // Group by date for calendar view
    const grouped = {}
    for (const apt of expandedAppointments) {
      const dateKey = apt.starts_at.split('T')[0] // Get YYYY-MM-DD
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(apt)
    }

    res.json({
      success: true,
      data: grouped,
      appointments: expandedAppointments,
      count: expandedAppointments.length
    })
  } catch (error) {
    console.error('Error fetching month appointments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch month appointments'
    })
  }
})

/**
 * GET /api/appointments/:id - Get single appointment details
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const appointment = AppointmentRepo.getById(id)

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    res.json({
      success: true,
      data: appointment
    })
  } catch (error) {
    console.error('Error fetching appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment'
    })
  }
})

/**
 * POST /api/appointments - Create new appointment
 * Body: { title, description?, location?, appointment_type, provider_name?,
 *         provider_phone?, starts_at, ends_at?, all_day?, reminder_min?, notes? }
 */
router.post('/', (req, res) => {
  try {
    const {
      title,
      description,
      location,
      appointment_type,
      provider_name,
      provider_phone,
      starts_at,
      ends_at,
      all_day,
      reminder_min,
      notes,
      is_recurring,
      recurrence_rule
    } = req.body

    // Validation
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Appointment title is required'
      })
    }

    if (!starts_at) {
      return res.status(400).json({
        success: false,
        error: 'Appointment start time is required'
      })
    }

    const appointment = AppointmentRepo.create({
      user_id: DEFAULT_USER_ID,
      title,
      description,
      location,
      appointment_type: appointment_type || 'personal',
      provider_name,
      provider_phone,
      starts_at,
      ends_at,
      all_day: all_day || false,
      reminder_min: reminder_min || 60,
      notes,
      is_recurring: is_recurring || false,
      recurrence_rule: recurrence_rule || null
    })

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Appointment created successfully'
    })
  } catch (error) {
    console.error('Error creating appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create appointment'
    })
  }
})

/**
 * PUT /api/appointments/:id - Update appointment
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updates = req.body

    // Check if appointment exists
    const existing = AppointmentRepo.getById(id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    const result = AppointmentRepo.update(id, updates)

    res.json({
      success: true,
      data: { id, ...updates },
      message: 'Appointment updated successfully'
    })
  } catch (error) {
    console.error('Error updating appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    })
  }
})

/**
 * DELETE /api/appointments/:id - Delete appointment
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)

    // Check if appointment exists
    const existing = AppointmentRepo.getById(id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    AppointmentRepo.delete(id)

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete appointment'
    })
  }
})

/**
 * POST /api/appointments/:id/complete - Mark appointment as completed
 * Body: { notes?, instance_date? }
 */
router.post('/:id/complete', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { notes, instance_date } = req.body

    // Check if appointment exists
    const existing = AppointmentRepo.getById(id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    // If this is a recurring instance, track completion separately
    if (instance_date && existing.is_recurring) {
      const db = getDatabase()

      // Insert or update completion record for this specific instance
      db.prepare(`
        INSERT INTO recurring_appointment_completions (appointment_id, instance_date, status, notes, completed_at)
        VALUES (?, ?, 'completed', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(appointment_id, instance_date)
        DO UPDATE SET status = 'completed', notes = ?, completed_at = CURRENT_TIMESTAMP
      `).run(id, instance_date, notes || null, notes || null)

      res.json({
        success: true,
        message: 'Recurring appointment instance marked as completed'
      })
    } else {
      // Normal appointment - update the appointment itself
      AppointmentRepo.complete(id, notes)

      res.json({
        success: true,
        message: 'Appointment marked as completed'
      })
    }
  } catch (error) {
    console.error('Error completing appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to complete appointment'
    })
  }
})

/**
 * POST /api/appointments/:id/uncomplete - Mark appointment as scheduled again
 * Body: { instance_date? }
 */
router.post('/:id/uncomplete', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { instance_date } = req.body

    // Check if appointment exists
    const existing = AppointmentRepo.getById(id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    // If this is a recurring instance, remove completion record
    if (instance_date && existing.is_recurring) {
      const db = getDatabase()

      // Delete completion record for this specific instance
      db.prepare(`
        DELETE FROM recurring_appointment_completions
        WHERE appointment_id = ? AND instance_date = ?
      `).run(id, instance_date)

      res.json({
        success: true,
        message: 'Recurring appointment instance marked as scheduled'
      })
    } else {
      // Normal appointment - update the appointment itself
      AppointmentRepo.uncomplete(id)

      res.json({
        success: true,
        message: 'Appointment marked as scheduled'
      })
    }
  } catch (error) {
    console.error('Error uncompleting appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to uncomplete appointment'
    })
  }
})

/**
 * POST /api/appointments/:id/cancel - Mark appointment as cancelled
 * Body: { reason? }
 */
router.post('/:id/cancel', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { reason } = req.body

    // Check if appointment exists
    const existing = AppointmentRepo.getById(id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    AppointmentRepo.cancel(id, reason)

    res.json({
      success: true,
      message: 'Appointment cancelled'
    })
  } catch (error) {
    console.error('Error cancelling appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to cancel appointment'
    })
  }
})

/**
 * POST /api/appointments/:id/reschedule - Reschedule appointment
 * Body: { starts_at, ends_at? }
 */
router.post('/:id/reschedule', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { starts_at, ends_at } = req.body

    if (!starts_at) {
      return res.status(400).json({
        success: false,
        error: 'New start time is required'
      })
    }

    // Check if appointment exists
    const existing = AppointmentRepo.getById(id)
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      })
    }

    AppointmentRepo.reschedule(id, starts_at, ends_at)

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully'
    })
  } catch (error) {
    console.error('Error rescheduling appointment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule appointment'
    })
  }
})

export default router
