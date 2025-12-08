import express from 'express'
import nutritionService from '../services/nutritionService.js'

const router = express.Router()

// GET /api/nutrition/daily - Get daily nutrition summary
router.get('/daily', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0]
    const dailyData = await nutritionService.getDailySummary(date)

    res.json({
      success: true,
      data: dailyData
    })
  } catch (error) {
    console.error('Error in /api/nutrition/daily:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// POST /api/nutrition/log-meal - Add new meal entry
router.post('/log-meal', async (req, res) => {
  try {
    const { mealType, foods } = req.body

    if (!mealType || !foods || !Array.isArray(foods)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mealType and foods array'
      })
    }

    const meal = await nutritionService.logMeal(mealType, foods)

    res.json({
      success: true,
      data: meal,
      message: 'Meal logged successfully'
    })
  } catch (error) {
    console.error('Error in /api/nutrition/log-meal:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /api/nutrition/foods - Search food database
router.get('/foods', async (req, res) => {
  try {
    console.log('🔍 Backend: Food search request received', req.query)
    const { query, limit = 20 } = req.query

    if (!query) {
      console.log('🔍 Backend: No query parameter provided')
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      })
    }

    console.log('🔍 Backend: Searching for foods with query:', query, 'limit:', limit)
    const foods = await nutritionService.searchFoods(query, parseInt(limit))
    console.log('🔍 Backend: Found foods:', foods.length, 'results')

    res.json({
      success: true,
      data: foods
    })
  } catch (error) {
    console.error('🔍 Backend: Error in /api/nutrition/foods:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /api/nutrition/goals - Get nutrition goals
router.get('/goals', async (req, res) => {
  try {
    const goals = await nutritionService.getNutritionGoals()

    res.json({
      success: true,
      data: goals
    })
  } catch (error) {
    console.error('Error in /api/nutrition/goals:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// PUT /api/nutrition/goals - Update nutrition goals
router.put('/goals', async (req, res) => {
  try {
    const { calories, protein, carbs, fat, fiber, sodium } = req.body

    const updatedGoals = await nutritionService.updateNutritionGoals({
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sodium
    })

    res.json({
      success: true,
      data: updatedGoals,
      message: 'Nutrition goals updated successfully'
    })
  } catch (error) {
    console.error('Error in /api/nutrition/goals:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /api/nutrition/history - Get historical nutrition data
router.get('/history', async (req, res) => {
  try {
    const { startDate, endDate, days = 7 } = req.query

    const history = await nutritionService.getNutritionHistory({
      startDate,
      endDate,
      days: parseInt(days)
    })

    res.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('Error in /api/nutrition/history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /api/nutrition/meal/:mealId - Get a single meal with its foods
router.get('/meal/:mealId', async (req, res) => {
  try {
    const { mealId } = req.params

    const meal = await nutritionService.getMeal(mealId)

    res.json({
      success: true,
      data: meal
    })
  } catch (error) {
    console.error('Error in GET /api/nutrition/meal/:mealId:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// PUT /api/nutrition/meal/:mealId - Update a meal
router.put('/meal/:mealId', async (req, res) => {
  try {
    const { mealId } = req.params
    const { mealType, foods } = req.body

    if (!foods || !Array.isArray(foods)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: foods array'
      })
    }

    const meal = await nutritionService.updateMeal(mealId, mealType, foods)

    res.json({
      success: true,
      data: meal,
      message: 'Meal updated successfully'
    })
  } catch (error) {
    console.error('Error in PUT /api/nutrition/meal/:mealId:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// DELETE /api/nutrition/meal/:mealId - Delete a meal
router.delete('/meal/:mealId', async (req, res) => {
  try {
    const { mealId } = req.params

    await nutritionService.deleteMeal(mealId)

    res.json({
      success: true,
      message: 'Meal deleted successfully'
    })
  } catch (error) {
    console.error('Error in /api/nutrition/meal/:mealId:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// GET /api/nutrition/recent-foods - Get recently used foods
router.get('/recent-foods', async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const recentFoods = await nutritionService.getRecentFoods(parseInt(limit))

    res.json({
      success: true,
      data: recentFoods
    })
  } catch (error) {
    console.error('Error in /api/nutrition/recent-foods:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router