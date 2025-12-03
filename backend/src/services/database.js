import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Database singleton
let db = null

/**
 * Initialize the SQLite database connection
 * Creates the database and runs schema if it doesn't exist
 */
export function initDatabase() {
  if (db) {
    console.log('📦 Database already initialized')
    return db
  }

  const dbPath = join(__dirname, '../../data/betti.db')
  const schemaPath = join(__dirname, '../schema/betti-schema.sql')

  const dbExists = existsSync(dbPath)

  try {
    db = new Database(dbPath)

    // Enable foreign keys and WAL mode
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')

    if (!dbExists) {
      console.log('📦 Creating new database...')
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf8')
        db.exec(schema)
        console.log('📦 Schema applied successfully')
      } else {
        console.warn('⚠️ Schema file not found at:', schemaPath)
      }
    }

    // Verify database is working
    const tableCount = db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
    ).get()

    console.log(`📦 Database initialized: ${dbPath}`)
    console.log(`   Tables: ${tableCount.count}`)

    return db
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message)
    throw error
  }
}

/**
 * Get the database instance
 * Throws if database hasn't been initialized
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Close the database connection gracefully
 */
export function closeDatabase() {
  if (db) {
    try {
      db.close()
      db = null
      console.log('📦 Database connection closed')
    } catch (error) {
      console.error('❌ Error closing database:', error.message)
    }
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected() {
  return db !== null && db.open
}

// ============================================================================
// WORKOUT REPOSITORY
// ============================================================================

export const WorkoutRepo = {
  /**
   * Create a new workout
   * @param {Object} workout - Workout data
   * @returns {Object} Created workout with id
   */
  create(workout) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO workouts (
        user_id, workout_type, duration_min, calories_burned, distance_miles,
        steps, heart_rate_avg, heart_rate_max, intensity, video_id, notes,
        started_at, ended_at
      ) VALUES (
        @user_id, @workout_type, @duration_min, @calories_burned, @distance_miles,
        @steps, @heart_rate_avg, @heart_rate_max, @intensity, @video_id, @notes,
        @started_at, @ended_at
      )
    `)

    const result = stmt.run({
      user_id: workout.user_id || 1,
      workout_type: workout.workout_type,
      duration_min: workout.duration_min || null,
      calories_burned: workout.calories_burned || null,
      distance_miles: workout.distance_miles || null,
      steps: workout.steps || null,
      heart_rate_avg: workout.heart_rate_avg || null,
      heart_rate_max: workout.heart_rate_max || null,
      intensity: workout.intensity || 'moderate',
      video_id: workout.video_id || null,
      notes: workout.notes || null,
      started_at: workout.started_at,
      ended_at: workout.ended_at || null
    })

    return { id: result.lastInsertRowid, ...workout }
  },

  /**
   * Get a workout by ID
   * @param {number} id - Workout ID
   * @returns {Object|null} Workout or null if not found
   */
  getById(id) {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM workouts WHERE id = ?')
    return stmt.get(id) || null
  },

  /**
   * Get workouts within a date range
   * @param {number} userId - User ID
   * @param {string} startDate - Start date (YYYY-MM-DD or ISO string)
   * @param {string} endDate - End date (YYYY-MM-DD or ISO string)
   * @param {number} limit - Max results (default 50)
   * @returns {Array} List of workouts
   */
  getByDateRange(userId, startDate, endDate, limit = 50) {
    const db = getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM workouts
      WHERE user_id = ?
        AND date(started_at) >= date(?)
        AND date(started_at) <= date(?)
      ORDER BY started_at DESC
      LIMIT ?
    `)
    return stmt.all(userId, startDate, endDate, limit)
  },

  /**
   * Get workouts by type
   * @param {number} userId - User ID
   * @param {string} workoutType - Type of workout
   * @param {number} limit - Max results (default 20)
   * @returns {Array} List of workouts
   */
  getByType(userId, workoutType, limit = 20) {
    const db = getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM workouts
      WHERE user_id = ?
        AND LOWER(workout_type) = LOWER(?)
      ORDER BY started_at DESC
      LIMIT ?
    `)
    return stmt.all(userId, workoutType, limit)
  },

  /**
   * Delete a workout by ID
   * @param {number} id - Workout ID
   * @returns {boolean} True if deleted, false if not found
   */
  delete(id) {
    const db = getDatabase()
    const stmt = db.prepare('DELETE FROM workouts WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  /**
   * Get today's activity summary including workouts
   * @param {number} userId - User ID
   * @returns {Object} Today's summary with workouts array
   */
  getTodaySummary(userId) {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]

    // Get today's workouts
    const workoutsStmt = db.prepare(`
      SELECT * FROM workouts
      WHERE user_id = ?
        AND date(started_at) = date(?)
      ORDER BY started_at DESC
    `)
    const workouts = workoutsStmt.all(userId, today)

    // Get daily activity record if exists
    const activityStmt = db.prepare(`
      SELECT * FROM daily_activity
      WHERE user_id = ? AND activity_date = ?
    `)
    const activity = activityStmt.get(userId, today)

    // Calculate workout totals
    const workoutTotals = workouts.reduce((acc, w) => ({
      duration_min: acc.duration_min + (w.duration_min || 0),
      calories_burned: acc.calories_burned + (w.calories_burned || 0),
      steps: acc.steps + (w.steps || 0),
      distance_miles: acc.distance_miles + (w.distance_miles || 0)
    }), { duration_min: 0, calories_burned: 0, steps: 0, distance_miles: 0 })

    return {
      date: today,
      steps: activity?.steps || workoutTotals.steps,
      active_minutes: activity?.active_minutes || workoutTotals.duration_min,
      calories_burned: activity?.calories_burned || workoutTotals.calories_burned,
      floors_climbed: activity?.floors_climbed || 0,
      distance_miles: activity?.distance_miles || workoutTotals.distance_miles,
      workouts_count: workouts.length,
      workouts: workouts
    }
  },

  /**
   * Get weekly activity summary (past 7 days)
   * @param {number} userId - User ID
   * @returns {Object} Weekly summary with daily breakdown
   */
  getWeeklySummary(userId) {
    const db = getDatabase()

    // Generate last 7 days
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }

    // Get daily activity for the week
    const activityStmt = db.prepare(`
      SELECT * FROM daily_activity
      WHERE user_id = ?
        AND activity_date >= ?
        AND activity_date <= ?
      ORDER BY activity_date
    `)
    const activities = activityStmt.all(userId, dates[0], dates[6])
    const activityMap = new Map(activities.map(a => [a.activity_date, a]))

    // Get workouts for the week
    const workoutsStmt = db.prepare(`
      SELECT date(started_at) as workout_date,
             COUNT(*) as workout_count,
             COALESCE(SUM(duration_min), 0) as total_duration,
             COALESCE(SUM(calories_burned), 0) as total_calories,
             COALESCE(SUM(steps), 0) as total_steps,
             COALESCE(SUM(distance_miles), 0) as total_distance
      FROM workouts
      WHERE user_id = ?
        AND date(started_at) >= ?
        AND date(started_at) <= ?
      GROUP BY date(started_at)
    `)
    const workoutsByDay = workoutsStmt.all(userId, dates[0], dates[6])
    const workoutMap = new Map(workoutsByDay.map(w => [w.workout_date, w]))

    // Build daily summaries
    const days = dates.map(date => {
      const activity = activityMap.get(date)
      const workout = workoutMap.get(date)

      return {
        date,
        steps: activity?.steps || workout?.total_steps || 0,
        active_minutes: activity?.active_minutes || workout?.total_duration || 0,
        calories_burned: activity?.calories_burned || workout?.total_calories || 0,
        floors_climbed: activity?.floors_climbed || 0,
        distance_miles: activity?.distance_miles || workout?.total_distance || 0,
        workouts_count: workout?.workout_count || 0
      }
    })

    // Calculate totals
    const totals = days.reduce((acc, day) => ({
      steps: acc.steps + day.steps,
      active_minutes: acc.active_minutes + day.active_minutes,
      calories_burned: acc.calories_burned + day.calories_burned,
      floors_climbed: acc.floors_climbed + day.floors_climbed,
      distance_miles: acc.distance_miles + day.distance_miles,
      workouts_count: acc.workouts_count + day.workouts_count
    }), { steps: 0, active_minutes: 0, calories_burned: 0, floors_climbed: 0, distance_miles: 0, workouts_count: 0 })

    // Calculate averages
    const averages = {
      steps: Math.round(totals.steps / 7),
      active_minutes: Math.round(totals.active_minutes / 7),
      calories_burned: Math.round(totals.calories_burned / 7),
      floors_climbed: Math.round(totals.floors_climbed / 7),
      distance_miles: Math.round(totals.distance_miles * 10 / 7) / 10
    }

    return {
      start_date: dates[0],
      end_date: dates[6],
      days,
      totals,
      averages
    }
  },

  /**
   * Update or insert daily activity record (upsert)
   * @param {number} userId - User ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {Object} data - Activity data to update
   * @returns {Object} Updated daily activity record
   */
  updateDailyActivity(userId, date, data) {
    const db = getDatabase()

    // Check if record exists
    const existingStmt = db.prepare(`
      SELECT * FROM daily_activity WHERE user_id = ? AND activity_date = ?
    `)
    const existing = existingStmt.get(userId, date)

    if (existing) {
      // Update existing record
      const updateStmt = db.prepare(`
        UPDATE daily_activity SET
          steps = COALESCE(@steps, steps),
          active_minutes = COALESCE(@active_minutes, active_minutes),
          calories_burned = COALESCE(@calories_burned, calories_burned),
          floors_climbed = COALESCE(@floors_climbed, floors_climbed),
          distance_miles = COALESCE(@distance_miles, distance_miles),
          source = COALESCE(@source, source),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = @user_id AND activity_date = @activity_date
      `)

      updateStmt.run({
        user_id: userId,
        activity_date: date,
        steps: data.steps ?? null,
        active_minutes: data.active_minutes ?? null,
        calories_burned: data.calories_burned ?? null,
        floors_climbed: data.floors_climbed ?? null,
        distance_miles: data.distance_miles ?? null,
        source: data.source ?? null
      })
    } else {
      // Insert new record
      const insertStmt = db.prepare(`
        INSERT INTO daily_activity (
          user_id, activity_date, steps, active_minutes, calories_burned,
          floors_climbed, distance_miles, source
        ) VALUES (
          @user_id, @activity_date, @steps, @active_minutes, @calories_burned,
          @floors_climbed, @distance_miles, @source
        )
      `)

      insertStmt.run({
        user_id: userId,
        activity_date: date,
        steps: data.steps || 0,
        active_minutes: data.active_minutes || 0,
        calories_burned: data.calories_burned || 0,
        floors_climbed: data.floors_climbed || 0,
        distance_miles: data.distance_miles || 0,
        source: data.source || 'manual'
      })
    }

    // Return the updated record
    return existingStmt.get(userId, date)
  }
}

// ============================================================================
// MEDICATION REPOSITORY
// ============================================================================

export const MedicationRepo = {
  /**
   * Run database migrations for medication tables
   */
  runMigrations() {
    const db = getDatabase()

    // Check if we need to add new columns
    const columns = db.prepare("PRAGMA table_info(medications)").all()
    const columnNames = columns.map(c => c.name)

    // Add new medication columns if they don't exist
    if (!columnNames.includes('dosage_unit')) {
      try { db.exec("ALTER TABLE medications ADD COLUMN dosage_unit TEXT DEFAULT 'tablet'") } catch (e) {}
    }
    if (!columnNames.includes('start_date')) {
      try { db.exec("ALTER TABLE medications ADD COLUMN start_date DATE") } catch (e) {}
    }
    if (!columnNames.includes('end_date')) {
      try { db.exec("ALTER TABLE medications ADD COLUMN end_date DATE") } catch (e) {}
    }
    if (!columnNames.includes('is_prn')) {
      try { db.exec("ALTER TABLE medications ADD COLUMN is_prn INTEGER DEFAULT 0") } catch (e) {}
    }
    if (!columnNames.includes('prn_max_daily')) {
      try { db.exec("ALTER TABLE medications ADD COLUMN prn_max_daily INTEGER") } catch (e) {}
    }
    if (!columnNames.includes('notes')) {
      try { db.exec("ALTER TABLE medications ADD COLUMN notes TEXT") } catch (e) {}
    }

    // Check schedule columns
    const schedCols = db.prepare("PRAGMA table_info(medication_schedules)").all()
    const schedColNames = schedCols.map(c => c.name)

    if (!schedColNames.includes('dosage_amount')) {
      try { db.exec("ALTER TABLE medication_schedules ADD COLUMN dosage_amount REAL DEFAULT 1") } catch (e) {}
    }
    if (!schedColNames.includes('frequency_type')) {
      try { db.exec("ALTER TABLE medication_schedules ADD COLUMN frequency_type TEXT DEFAULT 'daily'") } catch (e) {}
    }
    if (!schedColNames.includes('interval_days')) {
      try { db.exec("ALTER TABLE medication_schedules ADD COLUMN interval_days INTEGER") } catch (e) {}
    }
    if (!schedColNames.includes('interval_start')) {
      try { db.exec("ALTER TABLE medication_schedules ADD COLUMN interval_start DATE") } catch (e) {}
    }
    if (!schedColNames.includes('created_at')) {
      try { db.exec("ALTER TABLE medication_schedules ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP") } catch (e) {}
    }
    // Add day_of_week for per-day dosing (Option A schema)
    if (!schedColNames.includes('day_of_week')) {
      try { db.exec("ALTER TABLE medication_schedules ADD COLUMN day_of_week TEXT") } catch (e) {}
    }

    // Create index if not exists
    try {
      db.exec("CREATE INDEX IF NOT EXISTS idx_med_schedules_med ON medication_schedules(medication_id, is_active)")
    } catch (e) {}

    // Create unique index for per-day scheduling
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_med_schedule_unique
               ON medication_schedules(medication_id, day_of_week, schedule_time)
               WHERE day_of_week IS NOT NULL AND is_active = 1`)
    } catch (e) {}
  },

  /**
   * Create a new medication with optional schedules
   * @param {Object} medication - Medication data
   * @param {Array} schedules - Optional array of schedule objects
   * @returns {Object} Created medication with id and schedules
   */
  create(medication, schedules = []) {
    const db = getDatabase()
    this.runMigrations()

    const stmt = db.prepare(`
      INSERT INTO medications (
        user_id, name, dosage, dosage_unit, instructions, prescriber,
        pharmacy, rx_number, refills_left, start_date, end_date,
        is_active, is_prn, prn_max_daily, notes
      ) VALUES (
        @user_id, @name, @dosage, @dosage_unit, @instructions, @prescriber,
        @pharmacy, @rx_number, @refills_left, @start_date, @end_date,
        @is_active, @is_prn, @prn_max_daily, @notes
      )
    `)

    const result = stmt.run({
      user_id: medication.user_id || 1,
      name: medication.name,
      dosage: medication.dosage || null,
      dosage_unit: medication.dosage_unit || 'tablet',
      instructions: medication.instructions || null,
      prescriber: medication.prescriber || null,
      pharmacy: medication.pharmacy || null,
      rx_number: medication.rx_number || null,
      refills_left: medication.refills_left ?? null,
      start_date: medication.start_date || null,
      end_date: medication.end_date || null,
      is_active: medication.is_active ?? 1,
      is_prn: medication.is_prn ?? 0,
      prn_max_daily: medication.prn_max_daily ?? null,
      notes: medication.notes || null
    })

    const medicationId = result.lastInsertRowid

    // Add schedules if provided
    const createdSchedules = []
    if (schedules.length > 0) {
      const scheduleStmt = db.prepare(`
        INSERT INTO medication_schedules (
          medication_id, dosage_amount, schedule_time, frequency_type,
          days_of_week, interval_days, interval_start, is_active
        ) VALUES (
          @medication_id, @dosage_amount, @schedule_time, @frequency_type,
          @days_of_week, @interval_days, @interval_start, @is_active
        )
      `)

      for (const schedule of schedules) {
        const scheduleResult = scheduleStmt.run({
          medication_id: medicationId,
          dosage_amount: schedule.dosage_amount ?? 1,
          schedule_time: schedule.time || schedule.schedule_time,
          frequency_type: schedule.frequency_type || 'daily',
          days_of_week: schedule.days || schedule.days_of_week || 'daily',
          interval_days: schedule.interval_days ?? null,
          interval_start: schedule.interval_start || null,
          is_active: schedule.is_active ?? 1
        })
        createdSchedules.push({
          id: scheduleResult.lastInsertRowid,
          dosage_amount: schedule.dosage_amount ?? 1,
          schedule_time: schedule.time || schedule.schedule_time,
          frequency_type: schedule.frequency_type || 'daily',
          days_of_week: schedule.days || schedule.days_of_week || 'daily',
          interval_days: schedule.interval_days ?? null,
          interval_start: schedule.interval_start || null,
          is_active: 1
        })
      }
    }

    return {
      id: medicationId,
      ...medication,
      schedules: createdSchedules
    }
  },

  /**
   * Get a medication by ID with its schedules
   * @param {number} id - Medication ID
   * @returns {Object|null} Medication with schedules or null
   */
  getById(id) {
    const db = getDatabase()
    this.runMigrations()

    const medStmt = db.prepare('SELECT * FROM medications WHERE id = ?')
    const medication = medStmt.get(id)

    if (!medication) return null

    const scheduleStmt = db.prepare(`
      SELECT * FROM medication_schedules WHERE medication_id = ? AND is_active = 1
      ORDER BY schedule_time
    `)
    medication.schedules = scheduleStmt.all(id)

    return medication
  },

  /**
   * Get all medications for a user
   * @param {number} userId - User ID
   * @param {boolean} activeOnly - Only return active medications (default true)
   * @returns {Array} List of medications with schedules
   */
  getByUser(userId, activeOnly = true) {
    const db = getDatabase()
    this.runMigrations()

    let query = 'SELECT * FROM medications WHERE user_id = ?'
    if (activeOnly) {
      query += ' AND is_active = 1'
    }
    query += ' ORDER BY name'

    const medications = db.prepare(query).all(userId)

    // Get schedules for each medication
    const scheduleStmt = db.prepare(`
      SELECT * FROM medication_schedules WHERE medication_id = ? AND is_active = 1
      ORDER BY schedule_time
    `)

    for (const med of medications) {
      med.schedules = scheduleStmt.all(med.id)
    }

    return medications
  },

  /**
   * Update a medication
   * @param {number} id - Medication ID
   * @param {Object} data - Fields to update
   * @returns {Object|null} Updated medication or null
   */
  update(id, data) {
    const db = getDatabase()
    this.runMigrations()

    const updateStmt = db.prepare(`
      UPDATE medications SET
        name = COALESCE(@name, name),
        dosage = COALESCE(@dosage, dosage),
        dosage_unit = COALESCE(@dosage_unit, dosage_unit),
        instructions = COALESCE(@instructions, instructions),
        prescriber = COALESCE(@prescriber, prescriber),
        pharmacy = COALESCE(@pharmacy, pharmacy),
        rx_number = COALESCE(@rx_number, rx_number),
        refills_left = COALESCE(@refills_left, refills_left),
        start_date = COALESCE(@start_date, start_date),
        end_date = COALESCE(@end_date, end_date),
        is_active = COALESCE(@is_active, is_active),
        is_prn = COALESCE(@is_prn, is_prn),
        prn_max_daily = COALESCE(@prn_max_daily, prn_max_daily),
        notes = COALESCE(@notes, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `)

    updateStmt.run({
      id,
      name: data.name ?? null,
      dosage: data.dosage ?? null,
      dosage_unit: data.dosage_unit ?? null,
      instructions: data.instructions ?? null,
      prescriber: data.prescriber ?? null,
      pharmacy: data.pharmacy ?? null,
      rx_number: data.rx_number ?? null,
      refills_left: data.refills_left ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      is_active: data.is_active ?? null,
      is_prn: data.is_prn ?? null,
      prn_max_daily: data.prn_max_daily ?? null,
      notes: data.notes ?? null
    })

    // Update schedules if provided
    if (data.schedules) {
      // Deactivate existing schedules
      db.prepare('UPDATE medication_schedules SET is_active = 0 WHERE medication_id = ?').run(id)

      // Add new schedules
      const scheduleStmt = db.prepare(`
        INSERT INTO medication_schedules (
          medication_id, dosage_amount, schedule_time, frequency_type,
          days_of_week, interval_days, interval_start, is_active
        ) VALUES (
          @medication_id, @dosage_amount, @schedule_time, @frequency_type,
          @days_of_week, @interval_days, @interval_start, 1
        )
      `)

      for (const schedule of data.schedules) {
        scheduleStmt.run({
          medication_id: id,
          dosage_amount: schedule.dosage_amount ?? 1,
          schedule_time: schedule.time || schedule.schedule_time,
          frequency_type: schedule.frequency_type || 'daily',
          days_of_week: schedule.days || schedule.days_of_week || 'daily',
          interval_days: schedule.interval_days ?? null,
          interval_start: schedule.interval_start || null
        })
      }
    }

    return this.getById(id)
  },

  /**
   * Soft delete a medication (set is_active = 0)
   * @param {number} id - Medication ID
   * @returns {boolean} True if updated
   */
  softDelete(id) {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE medications SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  /**
   * Check if a date matches an interval schedule
   * @param {Date} checkDate - Date to check
   * @param {number} intervalDays - Interval in days
   * @param {string} intervalStart - Start date (YYYY-MM-DD)
   * @returns {boolean} True if date matches interval
   */
  isIntervalDay(checkDate, intervalDays, intervalStart) {
    if (!intervalDays || !intervalStart) return false

    const startDate = new Date(intervalStart)
    const diffTime = checkDate.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return diffDays >= 0 && diffDays % intervalDays === 0
  },

  /**
   * Get today's medication schedule with status
   * Handles complex scheduling: daily, specific_days, interval, prn
   * @param {number} userId - User ID
   * @returns {Object} { scheduled: [...], prn: [...] }
   */
  getTodaySchedule(userId) {
    const db = getDatabase()
    this.runMigrations()

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()]
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5)

    // Get all active medications with their schedules
    const query = `
      SELECT
        m.id as medication_id,
        m.name as medication_name,
        m.dosage,
        m.dosage_unit,
        m.instructions,
        m.is_prn,
        m.prn_max_daily,
        m.notes as medication_notes,
        ms.id as schedule_id,
        ms.dosage_amount,
        ms.schedule_time,
        ms.frequency_type,
        ms.days_of_week,
        ms.interval_days,
        ms.interval_start,
        ml.id as log_id,
        ml.status,
        ml.taken_at,
        ml.notes as log_notes
      FROM medications m
      LEFT JOIN medication_schedules ms ON m.id = ms.medication_id AND ms.is_active = 1
      LEFT JOIN medication_log ml ON m.id = ml.medication_id
        AND (ml.schedule_id = ms.id OR (ms.id IS NULL AND ml.schedule_id IS NULL))
        AND ml.scheduled_date = ?
      WHERE m.user_id = ?
        AND m.is_active = 1
        AND (m.end_date IS NULL OR m.end_date >= ?)
        AND (m.start_date IS NULL OR m.start_date <= ?)
      ORDER BY ms.schedule_time NULLS LAST
    `

    const rows = db.prepare(query).all(todayStr, userId, todayStr, todayStr)

    const scheduled = []
    const prn = []
    const processedScheduleIds = new Set()

    for (const row of rows) {
      // Skip if we've already processed this schedule
      const schedKey = `${row.medication_id}_${row.schedule_id || 'prn'}`
      if (processedScheduleIds.has(schedKey)) continue
      processedScheduleIds.add(schedKey)

      // Handle PRN (as-needed) medications separately
      if (row.is_prn) {
        // Count today's PRN doses
        const prnCount = db.prepare(`
          SELECT COUNT(*) as count FROM medication_log
          WHERE medication_id = ? AND scheduled_date = ? AND status = 'taken'
        `).get(row.medication_id, todayStr)

        prn.push({
          medication_id: row.medication_id,
          medication_name: row.medication_name,
          dosage: row.dosage,
          dosage_unit: row.dosage_unit,
          instructions: row.instructions,
          is_prn: true,
          prn_max_daily: row.prn_max_daily,
          doses_taken_today: prnCount?.count || 0,
          can_take_more: !row.prn_max_daily || (prnCount?.count || 0) < row.prn_max_daily,
          notes: row.medication_notes
        })
        continue
      }

      // Skip if no schedule (shouldn't happen for non-PRN)
      if (!row.schedule_id) continue

      // Determine if this schedule applies today
      let appliesToday = false
      const frequencyType = row.frequency_type || 'daily'

      switch (frequencyType) {
        case 'daily':
          appliesToday = true
          break

        case 'specific_days':
          const daysOfWeek = (row.days_of_week || 'daily').toLowerCase()
          appliesToday = daysOfWeek === 'daily' || daysOfWeek.includes(dayOfWeek)
          break

        case 'interval':
          appliesToday = this.isIntervalDay(today, row.interval_days, row.interval_start)
          break

        case 'prn':
          // PRN schedules are handled separately
          continue
      }

      if (!appliesToday) continue

      // Determine status
      let status = row.status || 'pending'
      if (!row.log_id && row.schedule_time < currentTime) {
        const scheduledMinutes = parseInt(row.schedule_time.split(':')[0]) * 60 +
                                  parseInt(row.schedule_time.split(':')[1])
        const currentMinutes = now.getHours() * 60 + now.getMinutes()

        if (currentMinutes - scheduledMinutes > 30) {
          status = 'late'
        }
      }

      scheduled.push({
        medication_id: row.medication_id,
        medication_name: row.medication_name,
        dosage: row.dosage,
        dosage_unit: row.dosage_unit,
        dosage_amount: row.dosage_amount,
        instructions: row.instructions,
        schedule_id: row.schedule_id,
        scheduled_time: row.schedule_time,
        frequency_type: frequencyType,
        status,
        taken_at: row.taken_at,
        notes: row.log_notes || row.medication_notes
      })
    }

    // Sort scheduled by time
    scheduled.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))

    return { scheduled, prn }
  },

  /**
   * Mark medication as taken
   * @param {number} medicationId - Medication ID
   * @param {number|null} scheduleId - Schedule ID (optional, for PRN)
   * @param {Object} options - { dosage_amount, notes }
   * @returns {Object} The log entry
   */
  markTaken(medicationId, scheduleId = null, options = {}) {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    const { dosage_amount, notes } = options

    let logId
    if (scheduleId) {
      const existingLog = db.prepare(`
        SELECT id FROM medication_log
        WHERE medication_id = ? AND schedule_id = ? AND scheduled_date = ?
      `).get(medicationId, scheduleId, today)

      if (existingLog) {
        db.prepare(`
          UPDATE medication_log SET status = 'taken', taken_at = ?, notes = COALESCE(?, notes)
          WHERE id = ?
        `).run(now, notes, existingLog.id)
        logId = existingLog.id
      } else {
        const schedule = db.prepare('SELECT schedule_time, dosage_amount FROM medication_schedules WHERE id = ?').get(scheduleId)
        const result = db.prepare(`
          INSERT INTO medication_log (medication_id, schedule_id, scheduled_date, scheduled_time, status, taken_at, notes)
          VALUES (?, ?, ?, ?, 'taken', ?, ?)
        `).run(medicationId, scheduleId, today, schedule?.schedule_time, now, notes)
        logId = result.lastInsertRowid
      }
    } else {
      // PRN medication - just log it
      const result = db.prepare(`
        INSERT INTO medication_log (medication_id, scheduled_date, status, taken_at, notes)
        VALUES (?, ?, 'taken', ?, ?)
      `).run(medicationId, today, now, notes)
      logId = result.lastInsertRowid
    }

    return db.prepare('SELECT * FROM medication_log WHERE id = ?').get(logId)
  },

  /**
   * Mark medication as skipped
   * @param {number} medicationId - Medication ID
   * @param {number|null} scheduleId - Schedule ID (optional)
   * @param {string|null} reason - Reason for skipping
   * @returns {Object} The log entry
   */
  markSkipped(medicationId, scheduleId = null, reason = null) {
    const db = getDatabase()
    const today = new Date().toISOString().split('T')[0]

    let logId
    if (scheduleId) {
      const existingLog = db.prepare(`
        SELECT id FROM medication_log
        WHERE medication_id = ? AND schedule_id = ? AND scheduled_date = ?
      `).get(medicationId, scheduleId, today)

      if (existingLog) {
        db.prepare(`
          UPDATE medication_log SET status = 'skipped', notes = COALESCE(?, notes)
          WHERE id = ?
        `).run(reason, existingLog.id)
        logId = existingLog.id
      } else {
        const schedule = db.prepare('SELECT schedule_time FROM medication_schedules WHERE id = ?').get(scheduleId)
        const result = db.prepare(`
          INSERT INTO medication_log (medication_id, schedule_id, scheduled_date, scheduled_time, status, notes)
          VALUES (?, ?, ?, ?, 'skipped', ?)
        `).run(medicationId, scheduleId, today, schedule?.schedule_time, reason)
        logId = result.lastInsertRowid
      }
    } else {
      const result = db.prepare(`
        INSERT INTO medication_log (medication_id, scheduled_date, status, notes)
        VALUES (?, ?, 'skipped', ?)
      `).run(medicationId, today, reason)
      logId = result.lastInsertRowid
    }

    return db.prepare('SELECT * FROM medication_log WHERE id = ?').get(logId)
  },

  /**
   * Get medication history
   * @param {number} medicationId - Medication ID
   * @param {number} days - Number of days (default 30)
   * @returns {Array} Log entries
   */
  getHistory(medicationId, days = 30) {
    const db = getDatabase()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    return db.prepare(`
      SELECT ml.*, ms.schedule_time, ms.dosage_amount
      FROM medication_log ml
      LEFT JOIN medication_schedules ms ON ml.schedule_id = ms.id
      WHERE ml.medication_id = ?
        AND ml.scheduled_date >= ?
      ORDER BY ml.scheduled_date DESC, ml.scheduled_time DESC
    `).all(medicationId, startDateStr)
  },

  /**
   * Get adherence statistics for past N days
   * @param {number} userId - User ID
   * @param {number} days - Number of days to look back (default 7)
   * @returns {Object} Adherence statistics
   */
  getAdherenceStats(userId, days = 7) {
    const db = getDatabase()
    this.runMigrations()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = new Date().toISOString().split('T')[0]

    // Get all logs for the period (excluding PRN)
    const logs = db.prepare(`
      SELECT ml.*, m.name as medication_name, m.is_prn
      FROM medication_log ml
      JOIN medications m ON ml.medication_id = m.id
      WHERE m.user_id = ?
        AND ml.scheduled_date >= ?
        AND ml.scheduled_date <= ?
        AND m.is_prn = 0
    `).all(userId, startDateStr, endDateStr)

    const taken = logs.filter(l => l.status === 'taken').length
    const skipped = logs.filter(l => l.status === 'skipped').length
    const late = logs.filter(l => l.status === 'late').length
    const pending = logs.filter(l => l.status === 'pending').length
    const total = logs.length

    // Group by day
    const byDay = {}
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      byDay[dateStr] = { taken: 0, skipped: 0, late: 0, pending: 0, total: 0 }
    }

    for (const log of logs) {
      if (byDay[log.scheduled_date]) {
        byDay[log.scheduled_date][log.status]++
        byDay[log.scheduled_date].total++
      }
    }

    // Group by medication
    const byMedication = {}
    for (const log of logs) {
      if (!byMedication[log.medication_name]) {
        byMedication[log.medication_name] = { taken: 0, skipped: 0, late: 0, pending: 0, total: 0 }
      }
      byMedication[log.medication_name][log.status]++
      byMedication[log.medication_name].total++
    }

    return {
      period: { start: startDateStr, end: endDateStr, days },
      summary: {
        total,
        taken,
        skipped,
        late,
        pending,
        adherence_rate: total > 0 ? Math.round((taken / total) * 100) : 100
      },
      by_day: Object.entries(byDay).map(([date, stats]) => ({
        date,
        ...stats,
        adherence_rate: stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 100
      })).sort((a, b) => a.date.localeCompare(b.date)),
      by_medication: Object.entries(byMedication).map(([name, stats]) => ({
        medication_name: name,
        ...stats,
        adherence_rate: stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 100
      }))
    }
  },

  /**
   * Get medication overview with weekly schedules
   * Supports both old schema (frequency_type/days_of_week) and new schema (day_of_week per row)
   * @param {number} userId - User ID
   * @returns {Object} { medications: [...], today_summary: { scheduled_doses: [...], prn_medications: [...] } }
   */
  getOverview(userId) {
    const db = getDatabase()
    this.runMigrations()

    const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const today = new Date()
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()]

    // Get all active medications
    const medications = db.prepare(`
      SELECT m.*
      FROM medications m
      WHERE m.user_id = ?
        AND m.is_active = 1
      ORDER BY m.name
    `).all(userId)

    // Build overview for each medication
    const medicationsWithSchedules = medications.map(med => {
      // Get schedules for this medication
      const schedules = db.prepare(`
        SELECT * FROM medication_schedules
        WHERE medication_id = ? AND is_active = 1
        ORDER BY day_of_week, schedule_time
      `).all(med.id)

      // Check if using new per-day schema (day_of_week populated)
      const usesPerDaySchema = schedules.some(s => s.day_of_week != null)

      // Build weekly schedule
      const weeklySchedule = {
        mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
      }

      if (usesPerDaySchema) {
        // New schema: one row per day-time combination
        for (const schedule of schedules) {
          if (schedule.day_of_week && weeklySchedule[schedule.day_of_week]) {
            weeklySchedule[schedule.day_of_week].push({
              time: schedule.schedule_time,
              dose: schedule.dosage_amount || 1,
              schedule_id: schedule.id
            })
          }
        }
      } else {
        // Old schema: use frequency_type and days_of_week
        for (const schedule of schedules) {
          const frequencyType = schedule.frequency_type || 'daily'

          for (let i = 0; i < 7; i++) {
            const dayName = DAYS_OF_WEEK[i]
            let appliesToday = false

            switch (frequencyType) {
              case 'daily':
                appliesToday = true
                break
              case 'specific_days':
                const days = (schedule.days_of_week || 'daily').toLowerCase()
                appliesToday = days === 'daily' || days.includes(dayName)
                break
              case 'interval':
                if (schedule.interval_days === 2) {
                  appliesToday = i % 2 === 0
                } else {
                  appliesToday = i % (schedule.interval_days || 1) === 0
                }
                break
              case 'prn':
                appliesToday = false
                break
              default:
                appliesToday = true
            }

            if (appliesToday) {
              weeklySchedule[dayName].push({
                time: schedule.schedule_time,
                dose: schedule.dosage_amount || 1,
                schedule_id: schedule.id
              })
            }
          }
        }
      }

      // Sort each day by time
      for (const day of DAYS_OF_WEEK) {
        weeklySchedule[day].sort((a, b) => a.time.localeCompare(b.time))
      }

      // Determine schedule type
      let scheduleType = 'daily'
      if (med.is_prn) {
        scheduleType = 'prn'
      } else {
        // Check if doses vary across days
        const allDoses = DAYS_OF_WEEK.flatMap(day =>
          weeklySchedule[day].map(s => s.dose)
        )
        const uniqueDosages = new Set(allDoses)

        // Check if schedule varies across days
        const dayPatterns = DAYS_OF_WEEK.map(day =>
          weeklySchedule[day].map(s => `${s.time}:${s.dose}`).join(',')
        )
        const uniquePatterns = new Set(dayPatterns)

        if (uniqueDosages.size > 1 || uniquePatterns.size > 1) {
          scheduleType = 'variable'
        }
      }

      // Generate schedule description
      let scheduleDescription = ''
      if (med.is_prn) {
        scheduleDescription = `As needed${med.prn_max_daily ? ` (max ${med.prn_max_daily}/day)` : ''}`
      } else {
        // Analyze the schedule pattern
        const dayPatterns = {}
        for (const day of DAYS_OF_WEEK) {
          const pattern = weeklySchedule[day].map(s => `${s.dose}`).join('+') || '0'
          if (!dayPatterns[pattern]) {
            dayPatterns[pattern] = []
          }
          dayPatterns[pattern].push(day)
        }

        const parts = []
        for (const [pattern, days] of Object.entries(dayPatterns)) {
          if (pattern === '0') continue // Skip days with no doses

          let daysStr
          if (days.length === 7) {
            daysStr = 'daily'
          } else if (days.join(',') === 'mon,tue,wed,thu,fri') {
            daysStr = 'weekdays'
          } else if (days.join(',') === 'sat,sun') {
            daysStr = 'weekends'
          } else {
            daysStr = days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')
          }

          const doses = pattern.split('+').map(Number)
          const doseStr = doses.length === 1
            ? `${doses[0]}${med.dosage_unit || ''}`
            : `${doses.join('+')}${med.dosage_unit || ''}`

          parts.push(`${doseStr} ${daysStr}`)
        }

        if (parts.length === 1 && parts[0].includes('daily')) {
          // Get times for daily schedule
          const times = weeklySchedule.mon.map(s => {
            const [h, m] = s.time.split(':').map(Number)
            const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h)
            const ampm = h >= 12 ? 'PM' : 'AM'
            return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
          })
          scheduleDescription = `Daily at ${times.join(', ')}`
        } else {
          scheduleDescription = parts.join('; ') || 'No schedule'
        }
      }

      return {
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        dosage_unit: med.dosage_unit,
        instructions: med.instructions,
        is_prn: !!med.is_prn,
        prn_max_daily: med.prn_max_daily,
        weekly_schedule: weeklySchedule,
        schedule_type: scheduleType,
        schedule_description: scheduleDescription,
        schedules: schedules.map(s => ({
          id: s.id,
          schedule_time: s.schedule_time,
          dosage_amount: s.dosage_amount,
          day_of_week: s.day_of_week,
          frequency_type: s.frequency_type,
          days_of_week: s.days_of_week,
          interval_days: s.interval_days,
          interval_start: s.interval_start
        }))
      }
    })

    // Get today's summary using existing method
    const todaySummary = this.getTodaySchedule(userId)

    return {
      medications: medicationsWithSchedules,
      today_summary: {
        date: today.toISOString().split('T')[0],
        day_of_week: dayOfWeek,
        scheduled_doses: todaySummary.scheduled,
        prn_medications: todaySummary.prn
      }
    }
  },

  /**
   * Update medication schedule using per-day format
   * @param {number} medicationId - Medication ID
   * @param {Array} schedules - Array of { time, doses: { mon, tue, wed, thu, fri, sat, sun } }
   */
  updateSchedulePerDay(medicationId, schedules) {
    const db = getDatabase()
    this.runMigrations()

    const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

    const transaction = db.transaction(() => {
      // Deactivate existing schedules
      db.prepare('UPDATE medication_schedules SET is_active = 0 WHERE medication_id = ?').run(medicationId)

      // Insert new schedules (one row per day-time combination)
      const insertStmt = db.prepare(`
        INSERT INTO medication_schedules (medication_id, day_of_week, schedule_time, dosage_amount, is_active)
        VALUES (?, ?, ?, ?, 1)
      `)

      for (const schedule of schedules) {
        for (const day of DAYS_OF_WEEK) {
          const dose = schedule.doses[day]
          if (dose > 0) {
            insertStmt.run(medicationId, day, schedule.time, dose)
          }
        }
      }
    })

    transaction()

    return { success: true }
  }
}

// ============================================================================
// APPOINTMENTS REPOSITORY
// ============================================================================

export const AppointmentRepo = {
  /**
   * Get appointments for a date range
   * @param {number} userId - User ID
   * @param {string} startDate - Start date in ISO format
   * @param {string} endDate - End date in ISO format
   * @returns {Array} Array of appointments
   */
  getByDateRange(userId, startDate, endDate) {
    const db = getDatabase()
    return db
      .prepare(
        `SELECT * FROM appointments
         WHERE user_id = ? AND starts_at BETWEEN ? AND ?
         ORDER BY starts_at`
      )
      .all(userId, startDate, endDate)
  },

  /**
   * Get today's appointments as to-do list
   * @param {number} userId - User ID
   * @returns {Array} Array of today's appointments
   */
  getToday(userId) {
    const db = getDatabase()
    // Get all appointments that:
    // 1. Start today, OR
    // 2. Are recurring and started before or on today
    return db
      .prepare(
        `SELECT * FROM appointments
         WHERE user_id = ?
           AND (
             date(starts_at) = date('now')
             OR (is_recurring = 1 AND date(starts_at) <= date('now'))
           )
         ORDER BY all_day DESC, starts_at`
      )
      .all(userId)
  },

  /**
   * Get appointments for a specific month (for calendar view)
   * @param {number} userId - User ID
   * @param {number} year - Year (e.g., 2025)
   * @param {number} month - Month (1-12)
   * @returns {Array} Array of appointments for the month
   */
  getByMonth(userId, year, month) {
    const db = getDatabase()
    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-31`

    // Get all appointments that:
    // 1. Start within this month, OR
    // 2. Are recurring and started before or during this month
    return db
      .prepare(
        `SELECT * FROM appointments
         WHERE user_id = ?
           AND (
             (date(starts_at) >= ? AND date(starts_at) <= ?)
             OR (is_recurring = 1 AND date(starts_at) <= ?)
           )
         ORDER BY starts_at`
      )
      .all(userId, startOfMonth, endOfMonth, endOfMonth)
  },

  /**
   * Get upcoming appointments
   * @param {number} userId - User ID
   * @param {number} days - Number of days to look ahead (default 30)
   * @param {number} limit - Maximum number of appointments (default 20)
   * @returns {Array} Array of upcoming appointments
   */
  getUpcoming(userId, days = 30, limit = 20) {
    const db = getDatabase()
    // Get all appointments that:
    // 1. Start within the upcoming period, OR
    // 2. Are recurring and started before the end of the period
    return db
      .prepare(
        `SELECT * FROM appointments
         WHERE user_id = ?
           AND (
             (starts_at >= datetime('now') AND starts_at <= datetime('now', '+' || ? || ' days'))
             OR (is_recurring = 1 AND starts_at <= datetime('now', '+' || ? || ' days'))
           )
           AND status = 'scheduled'
         ORDER BY starts_at
         LIMIT ?`
      )
      .all(userId, days, days, limit)
  },

  /**
   * Get a single appointment by ID
   * @param {number} id - Appointment ID
   * @returns {Object|null} Appointment or null if not found
   */
  getById(id) {
    const db = getDatabase()
    return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) || null
  },

  /**
   * Create a new appointment
   * @param {Object} appointment - Appointment data
   * @returns {Object} Created appointment with id
   */
  create(appointment) {
    const db = getDatabase()
    const stmt = db.prepare(
      `INSERT INTO appointments (
        user_id, title, description, location, appointment_type,
        provider_name, provider_phone, starts_at, ends_at, all_day,
        reminder_min, is_recurring, recurrence_rule, notes
      ) VALUES (
        @user_id, @title, @description, @location, @appointment_type,
        @provider_name, @provider_phone, @starts_at, @ends_at, @all_day,
        @reminder_min, @is_recurring, @recurrence_rule, @notes
      )`
    )

    const result = stmt.run({
      user_id: appointment.user_id || 1,
      title: appointment.title,
      description: appointment.description || null,
      location: appointment.location || null,
      appointment_type: appointment.appointment_type || 'personal',
      provider_name: appointment.provider_name || null,
      provider_phone: appointment.provider_phone || null,
      starts_at: appointment.starts_at,
      ends_at: appointment.ends_at || null,
      all_day: appointment.all_day ? 1 : 0,
      reminder_min: appointment.reminder_min || 60,
      is_recurring: appointment.is_recurring ? 1 : 0,
      recurrence_rule: appointment.recurrence_rule || null,
      notes: appointment.notes || null
    })

    return { id: result.lastInsertRowid, ...appointment }
  },

  /**
   * Update an appointment
   * @param {number} id - Appointment ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Update result
   */
  update(id, updates) {
    const db = getDatabase()

    // Build dynamic SET clause
    const allowedFields = [
      'title', 'description', 'location', 'appointment_type',
      'provider_name', 'provider_phone', 'starts_at', 'ends_at',
      'all_day', 'reminder_min', 'is_recurring', 'recurrence_rule', 'notes', 'status'
    ]

    const fields = Object.keys(updates)
      .filter(k => allowedFields.includes(k))
      .map(k => `${k} = @${k}`)
      .join(', ')

    if (fields.length === 0) {
      return { changes: 0 }
    }

    const stmt = db.prepare(
      `UPDATE appointments
       SET ${fields}, updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`
    )

    return stmt.run({ id, ...updates })
  },

  /**
   * Mark an appointment as completed
   * @param {number} id - Appointment ID
   * @param {string} notes - Optional completion notes
   * @returns {Object} Update result
   */
  complete(id, notes = null) {
    const db = getDatabase()
    return db
      .prepare(
        `UPDATE appointments
         SET status = 'completed',
             completed_at = CURRENT_TIMESTAMP,
             notes = COALESCE(?, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(notes, id)
  },

  /**
   * Mark an appointment as scheduled again (uncheck)
   * @param {number} id - Appointment ID
   * @returns {Object} Update result
   */
  uncomplete(id) {
    const db = getDatabase()
    return db
      .prepare(
        `UPDATE appointments
         SET status = 'scheduled',
             completed_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(id)
  },

  /**
   * Mark an appointment as cancelled
   * @param {number} id - Appointment ID
   * @param {string} reason - Optional cancellation reason
   * @returns {Object} Update result
   */
  cancel(id, reason = null) {
    const db = getDatabase()
    return db
      .prepare(
        `UPDATE appointments
         SET status = 'cancelled',
             notes = COALESCE(?, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(reason, id)
  },

  /**
   * Reschedule an appointment
   * @param {number} id - Appointment ID
   * @param {string} starts_at - New start time
   * @param {string} ends_at - New end time (optional)
   * @returns {Object} Update result
   */
  reschedule(id, starts_at, ends_at = null) {
    const db = getDatabase()
    return db
      .prepare(
        `UPDATE appointments
         SET starts_at = ?,
             ends_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(starts_at, ends_at, id)
  },

  /**
   * Delete an appointment
   * @param {number} id - Appointment ID
   * @returns {Object} Delete result
   */
  delete(id) {
    const db = getDatabase()
    return db.prepare('DELETE FROM appointments WHERE id = ?').run(id)
  }
}

// Export the database instance getter as default
export default {
  init: initDatabase,
  get: getDatabase,
  close: closeDatabase,
  isConnected: isDatabaseConnected,
  WorkoutRepo,
  MedicationRepo,
  AppointmentRepo
}
