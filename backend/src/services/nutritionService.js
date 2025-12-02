import { getDatabase } from './database.js'

// Default user ID (single-user mode for now)
const DEFAULT_USER_ID = 1

class NutritionService {
  constructor() {
    // Database is initialized by the server before this service is used
  }

  // Get database instance
  get db() {
    return getDatabase()
  }

  // Get daily nutrition summary
  async getDailySummary(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0]

    // Get nutrition goals
    const goals = await this.getNutritionGoals()

    // Get meals for the target date
    const meals = this.db.prepare(`
      SELECT m.*,
             COALESCE(SUM(mf.calories), 0) as totalCalories,
             COALESCE(SUM(mf.protein), 0) as totalProtein,
             COALESCE(SUM(mf.carbs), 0) as totalCarbs,
             COALESCE(SUM(mf.fat), 0) as totalFat,
             COALESCE(SUM(mf.fiber), 0) as totalFiber,
             COALESCE(SUM(mf.sodium), 0) as totalSodium
      FROM meals m
      LEFT JOIN meal_foods mf ON m.id = mf.meal_id
      WHERE m.user_id = ? AND m.meal_date = ?
      GROUP BY m.id
      ORDER BY m.created_at
    `).all(DEFAULT_USER_ID, targetDate)

    // Get foods for each meal
    const todaysMeals = meals.map(meal => {
      const foods = this.db.prepare(`
        SELECT food_name as name, quantity, unit, calories, protein, carbs, fat, fiber, sodium
        FROM meal_foods WHERE meal_id = ?
      `).all(meal.id)

      return {
        id: meal.id,
        date: meal.meal_date,
        mealType: meal.meal_type,
        time: meal.meal_time,
        foods,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
        totalFiber: meal.totalFiber,
        totalSodium: meal.totalSodium,
        createdAt: meal.created_at
      }
    })

    // Calculate totals from all meals
    const totals = todaysMeals.reduce((acc, meal) => ({
      calories: acc.calories + (meal.totalCalories || 0),
      protein: acc.protein + (meal.totalProtein || 0),
      carbs: acc.carbs + (meal.totalCarbs || 0),
      fat: acc.fat + (meal.totalFat || 0),
      fiber: acc.fiber + (meal.totalFiber || 0),
      sodium: acc.sodium + (meal.totalSodium || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })

    // Build summary with percentages
    const summary = {}
    for (const [key, consumed] of Object.entries(totals)) {
      const target = goals[key] || 0
      summary[key] = {
        consumed: Math.round(consumed),
        target,
        remaining: Math.max(0, target - consumed),
        percentage: target > 0 ? Math.round((consumed / target) * 100) : 0
      }
    }

    return {
      date: targetDate,
      ...summary,
      todaysMeals
    }
  }

  // Log a new meal
  async logMeal(mealType, foods) {
    const currentDate = new Date().toISOString().split('T')[0]
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    // Insert meal
    const insertMeal = this.db.prepare(`
      INSERT INTO meals (user_id, meal_date, meal_type, meal_time)
      VALUES (?, ?, ?, ?)
    `)
    const mealResult = insertMeal.run(DEFAULT_USER_ID, currentDate, mealType.toLowerCase(), currentTime)
    const mealId = mealResult.lastInsertRowid

    // Insert meal foods
    const insertFood = this.db.prepare(`
      INSERT INTO meal_foods (meal_id, food_id, food_name, quantity, unit, calories, protein, carbs, fat, fiber, sodium)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }

    for (const food of foods) {
      // Try to find food in database
      const dbFood = this.db.prepare('SELECT id FROM foods WHERE LOWER(name) = LOWER(?)').get(food.name)

      insertFood.run(
        mealId,
        dbFood?.id || null,
        food.name,
        food.quantity || 1,
        food.unit || 'serving',
        food.calories || 0,
        food.protein || 0,
        food.carbs || 0,
        food.fat || 0,
        food.fiber || 0,
        food.sodium || 0
      )

      // Update recent foods tracking
      if (dbFood) {
        this.db.prepare(`
          INSERT INTO recent_foods (user_id, food_id, use_count, last_used)
          VALUES (?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, food_id) DO UPDATE SET
            use_count = use_count + 1,
            last_used = CURRENT_TIMESTAMP
        `).run(DEFAULT_USER_ID, dbFood.id)
      }

      // Accumulate totals
      totals.calories += food.calories || 0
      totals.protein += food.protein || 0
      totals.carbs += food.carbs || 0
      totals.fat += food.fat || 0
      totals.fiber += food.fiber || 0
      totals.sodium += food.sodium || 0
    }

    return {
      id: Number(mealId),
      date: currentDate,
      mealType: mealType.toLowerCase(),
      time: currentTime,
      foods,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFat: totals.fat,
      totalFiber: totals.fiber,
      totalSodium: totals.sodium,
      createdAt: new Date().toISOString()
    }
  }

  // Search foods in database
  async searchFoods(query, limit = 20) {
    const searchTerm = `%${query.toLowerCase()}%`

    const foods = this.db.prepare(`
      SELECT id, name, category, calories, protein, carbs, fat, fiber, sodium, serving_unit as unit
      FROM foods
      WHERE LOWER(name) LIKE ? OR LOWER(category) LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, limit)

    return foods
  }

  // Get nutrition goals
  async getNutritionGoals() {
    const goals = this.db.prepare(`
      SELECT calories, protein, carbs, fat, fiber, sodium
      FROM nutrition_goals
      WHERE user_id = ?
      ORDER BY effective_date DESC
      LIMIT 1
    `).get(DEFAULT_USER_ID)

    // Return defaults if no goals found
    return goals || {
      calories: 2000,
      protein: 100,
      carbs: 250,
      fat: 65,
      fiber: 25,
      sodium: 2300
    }
  }

  // Update nutrition goals
  async updateNutritionGoals(newGoals) {
    const currentGoals = await this.getNutritionGoals()

    const updatedGoals = {
      ...currentGoals,
      ...Object.fromEntries(
        Object.entries(newGoals).filter(([_, value]) => value !== undefined)
      )
    }

    // Upsert goals for today
    this.db.prepare(`
      INSERT INTO nutrition_goals (user_id, calories, protein, carbs, fat, fiber, sodium, effective_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))
      ON CONFLICT(user_id, effective_date) DO UPDATE SET
        calories = excluded.calories,
        protein = excluded.protein,
        carbs = excluded.carbs,
        fat = excluded.fat,
        fiber = excluded.fiber,
        sodium = excluded.sodium
    `).run(
      DEFAULT_USER_ID,
      updatedGoals.calories,
      updatedGoals.protein,
      updatedGoals.carbs,
      updatedGoals.fat,
      updatedGoals.fiber,
      updatedGoals.sodium
    )

    return updatedGoals
  }

  // Get nutrition history for date range
  async getNutritionHistory({ startDate, endDate, days = 7 }) {
    let filterStartDate, filterEndDate

    if (startDate && endDate) {
      filterStartDate = startDate
      filterEndDate = endDate
    } else {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - days + 1)
      filterStartDate = start.toISOString().split('T')[0]
      filterEndDate = end.toISOString().split('T')[0]
    }

    // Use the v_daily_nutrition view
    const dailyData = this.db.prepare(`
      SELECT meal_date as date, total_calories, total_protein, total_carbs, total_fat, total_fiber, total_sodium, meal_count
      FROM v_daily_nutrition
      WHERE user_id = ? AND meal_date BETWEEN ? AND ?
      ORDER BY meal_date DESC
    `).all(DEFAULT_USER_ID, filterStartDate, filterEndDate)

    const goals = await this.getNutritionGoals()

    // Format history entries to match original API response
    const history = dailyData.map(day => {
      const summary = {}
      const nutrientMap = {
        total_calories: 'calories',
        total_protein: 'protein',
        total_carbs: 'carbs',
        total_fat: 'fat',
        total_fiber: 'fiber',
        total_sodium: 'sodium'
      }

      for (const [dbKey, apiKey] of Object.entries(nutrientMap)) {
        const consumed = day[dbKey] || 0
        const target = goals[apiKey] || 0
        summary[apiKey] = {
          consumed: Math.round(consumed),
          target,
          remaining: Math.max(0, target - consumed),
          percentage: target > 0 ? Math.round((consumed / target) * 100) : 0
        }
      }

      return {
        date: day.date,
        ...summary
      }
    })

    return {
      startDate: filterStartDate,
      endDate: filterEndDate,
      history
    }
  }

  // Delete a meal
  async deleteMeal(mealId) {
    // meal_foods will be deleted via CASCADE
    const result = this.db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?')
      .run(mealId, DEFAULT_USER_ID)

    if (result.changes === 0) {
      throw new Error('Meal not found')
    }
  }

  // Get recently used foods
  async getRecentFoods(limit = 10) {
    const recentFoods = this.db.prepare(`
      SELECT f.id, f.name, f.category, f.calories, f.protein, f.carbs, f.fat, f.fiber, f.sodium, f.serving_unit as unit,
             rf.use_count, rf.last_used
      FROM recent_foods rf
      JOIN foods f ON rf.food_id = f.id
      WHERE rf.user_id = ?
      ORDER BY rf.use_count DESC, rf.last_used DESC
      LIMIT ?
    `).all(DEFAULT_USER_ID, limit)

    // Return just the food objects without the tracking metadata
    return recentFoods.map(({ use_count, last_used, ...food }) => food)
  }
}

// Export singleton instance
export default new NutritionService()
