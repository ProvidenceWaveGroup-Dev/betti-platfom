import express from 'express'
import { getDatabase } from '../services/database.js'

const router = express.Router()

// Default user ID (until auth is implemented)
const DEFAULT_USER_ID = 1

/**
 * POST /api/hydration/log - Log water intake
 * Body: { amount_oz, beverage_type? (default 'water'), recorded_at? }
 */
router.post('/log', (req, res) => {
  try {
    const { amount_oz, beverage_type = 'water', recorded_at } = req.body

    // Validation
    if (!amount_oz || amount_oz <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount_oz is required'
      })
    }

    const db = getDatabase()

    // Use provided timestamp or current time
    const timestamp = recorded_at || new Date().toISOString()

    const result = db.prepare(`
      INSERT INTO hydration_log (user_id, amount_oz, beverage_type, recorded_at)
      VALUES (?, ?, ?, ?)
    `).run(DEFAULT_USER_ID, amount_oz, beverage_type, timestamp)

    const drink = db.prepare(`
      SELECT * FROM hydration_log WHERE id = ?
    `).get(result.lastInsertRowid)

    res.status(201).json({
      success: true,
      data: drink,
      message: 'Hydration logged successfully'
    })
  } catch (error) {
    console.error('Error logging hydration:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to log hydration'
    })
  }
})

/**
 * GET /api/hydration/today - Get today's hydration summary
 * Returns: { consumed, target, remaining, percentage, drinks: [...] }
 */
router.get('/today', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const db = getDatabase()

    // Get today's drinks
    const drinks = db.prepare(`
      SELECT * FROM hydration_log
      WHERE user_id = ?
        AND date(recorded_at) = date('now')
      ORDER BY recorded_at DESC
    `).all(userId)

    // Calculate total consumed today
    const consumed = drinks.reduce((sum, drink) => sum + drink.amount_oz, 0)

    // Get current goal
    const goalRecord = db.prepare(`
      SELECT daily_goal_oz FROM hydration_goals
      WHERE user_id = ?
        AND effective_date <= date('now')
      ORDER BY effective_date DESC
      LIMIT 1
    `).get(userId)

    const target = goalRecord ? goalRecord.daily_goal_oz : 64 // Default 64oz

    const remaining = Math.max(0, target - consumed)
    const percentage = Math.min(100, Math.round((consumed / target) * 100))

    res.json({
      success: true,
      data: {
        consumed: Math.round(consumed * 10) / 10, // Round to 1 decimal
        target,
        remaining: Math.round(remaining * 10) / 10,
        percentage,
        drinks
      }
    })
  } catch (error) {
    console.error('Error fetching today\'s hydration:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s hydration'
    })
  }
})

/**
 * GET /api/hydration/history - Get hydration history
 * Query: userId, days (default 7)
 */
router.get('/history', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const days = parseInt(req.query.days) || 7
    const db = getDatabase()

    // Get goal for reference
    const goalRecord = db.prepare(`
      SELECT daily_goal_oz FROM hydration_goals
      WHERE user_id = ?
        AND effective_date <= date('now')
      ORDER BY effective_date DESC
      LIMIT 1
    `).get(userId)

    const dailyGoal = goalRecord ? goalRecord.daily_goal_oz : 64

    // Get history grouped by day
    const history = db.prepare(`
      SELECT
        date(recorded_at) as date,
        SUM(amount_oz) as total_oz,
        COUNT(*) as drink_count,
        GROUP_CONCAT(beverage_type) as beverage_types
      FROM hydration_log
      WHERE user_id = ?
        AND date(recorded_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(recorded_at)
      ORDER BY date DESC
    `).all(userId, days)

    // Add percentage and goal to each day
    const enrichedHistory = history.map(day => ({
      ...day,
      total_oz: Math.round(day.total_oz * 10) / 10,
      goal_oz: dailyGoal,
      percentage: Math.min(100, Math.round((day.total_oz / dailyGoal) * 100)),
      beverage_types: day.beverage_types ? day.beverage_types.split(',') : []
    }))

    res.json({
      success: true,
      data: enrichedHistory,
      count: enrichedHistory.length
    })
  } catch (error) {
    console.error('Error fetching hydration history:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hydration history'
    })
  }
})

/**
 * PUT /api/hydration/goal - Update daily hydration goal
 * Body: { daily_goal_oz }
 */
router.put('/goal', (req, res) => {
  try {
    const { daily_goal_oz } = req.body
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID

    // Validation
    if (!daily_goal_oz || daily_goal_oz <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid daily_goal_oz is required'
      })
    }

    const db = getDatabase()

    // Insert or update goal for today
    db.prepare(`
      INSERT INTO hydration_goals (user_id, daily_goal_oz, effective_date)
      VALUES (?, ?, date('now'))
      ON CONFLICT(user_id, effective_date)
      DO UPDATE SET daily_goal_oz = ?
    `).run(userId, daily_goal_oz, daily_goal_oz)

    res.json({
      success: true,
      data: { daily_goal_oz },
      message: 'Hydration goal updated successfully'
    })
  } catch (error) {
    console.error('Error updating hydration goal:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update hydration goal'
    })
  }
})

/**
 * GET /api/hydration/goal - Get current hydration goal
 */
router.get('/goal', (req, res) => {
  try {
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const db = getDatabase()

    const goal = db.prepare(`
      SELECT daily_goal_oz, effective_date FROM hydration_goals
      WHERE user_id = ?
        AND effective_date <= date('now')
      ORDER BY effective_date DESC
      LIMIT 1
    `).get(userId)

    if (!goal) {
      // Return default goal if none set
      return res.json({
        success: true,
        data: {
          daily_goal_oz: 64,
          effective_date: new Date().toISOString().split('T')[0],
          is_default: true
        }
      })
    }

    res.json({
      success: true,
      data: {
        ...goal,
        is_default: false
      }
    })
  } catch (error) {
    console.error('Error fetching hydration goal:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hydration goal'
    })
  }
})

/**
 * DELETE /api/hydration/:id - Remove a logged drink (for mistakes)
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const userId = parseInt(req.query.userId) || DEFAULT_USER_ID
    const db = getDatabase()

    // Check if drink exists and belongs to user
    const drink = db.prepare(`
      SELECT * FROM hydration_log WHERE id = ? AND user_id = ?
    `).get(id, userId)

    if (!drink) {
      return res.status(404).json({
        success: false,
        error: 'Drink log not found'
      })
    }

    // Delete the drink
    db.prepare(`
      DELETE FROM hydration_log WHERE id = ? AND user_id = ?
    `).run(id, userId)

    res.json({
      success: true,
      message: 'Drink log removed successfully'
    })
  } catch (error) {
    console.error('Error deleting hydration log:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete hydration log'
    })
  }
})

export default router
