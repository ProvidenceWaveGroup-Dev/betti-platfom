import React, { useState, useEffect } from 'react'
import nutritionApi from '../services/nutritionApi'
import MealLogModal from './MealLogModal'
import NutritionDetailsModal from './NutritionDetailsModal'
import './Nutrition.css'

function Nutrition({ isCollapsed = false }) {
  const [nutritionData, setNutritionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showMealModal, setShowMealModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    loadNutritionData()
  }, [])

  const loadNutritionData = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await nutritionApi.getNutritionDashboardData()
      setNutritionData(data)
    } catch (error) {
      console.error('Error loading nutrition data:', error)
      setError(error.message)

      // Set fallback data in case backend is down
      setNutritionData({
        dailySummary: {
          calories: { consumed: 1800, target: 2200, percentage: 82 },
          protein: { consumed: 85, target: 110, percentage: 77 },
          carbs: { consumed: 200, target: 275, percentage: 73 },
          fat: { consumed: 65, target: 73, percentage: 89 },
          fiber: { consumed: 18, target: 25, percentage: 72 },
          sodium: { consumed: 1580, target: 2300, percentage: 69 }
        },
        recentFoods: ['Grilled Chicken', 'Greek Yogurt', 'Oatmeal', 'Apple'],
        lastUpdated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMealLogged = () => {
    // Reload nutrition data after logging a meal
    loadNutritionData()
  }

  const handleDeleteMeal = async (mealId) => {
    try {
      await nutritionApi.deleteMeal(mealId)
      loadNutritionData() // Refresh data after deletion
    } catch (error) {
      console.error('Failed to delete meal:', error)
      setError('Failed to delete meal: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className={`nutrition-card ${isCollapsed ? 'nutrition-mini' : ''}`}>
        <div className="card-header">
          <h2 className="card-title">Nutrition</h2>
          <span className="status-indicator status-loading">Loading...</span>
        </div>
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="nutrition-mini">
        <div className="mini-header">
          <span className="mini-icon">🍎</span>
          <span className="mini-title">Nutrition</span>
          <span className="mini-status status-normal">
            ● {nutritionData?.dailySummary?.calories?.consumed || 0} / {nutritionData?.dailySummary?.calories?.target || 2200} kcal
          </span>
        </div>
        <div className="mini-nutrition-grid">
          {nutritionData?.dailySummary && Object.entries(nutritionData.dailySummary)
            .filter(([key]) => ['calories', 'protein', 'carbs', 'fat'].includes(key))
            .map(([key, macro]) => (
            <div key={key} className="mini-nutrition-item">
              <span className="mini-nutrition-icon">
                {key === 'calories' ? '🔥' :
                 key === 'protein' ? '💪' :
                 key === 'carbs' ? '🌾' :
                 key === 'fat' ? '🥑' : '📊'}
              </span>
              <div className="mini-nutrition-info">
                <span className="mini-nutrition-value">{macro.consumed}</span>
                <span className="mini-nutrition-label">{key}</span>
              </div>
              <div className="mini-progress-bar">
                <div
                  className="mini-progress-fill"
                  style={{width: `${Math.min(macro.percentage || 0, 100)}%`}}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const getStatusClass = (percentage) => {
    if (percentage >= 90) return 'status-high'
    if (percentage >= 70) return 'status-normal'
    return 'status-low'
  }

  const getMacroIcon = (macroType) => {
    const icons = {
      calories: '🔥',
      protein: '💪',
      carbs: '🌾',
      fat: '🥑',
      fiber: '🌿',
      sodium: '🧂'
    }
    return icons[macroType] || '📊'
  }

  return (
    <div className="nutrition-card">
      <div className="card-header">
        <h2 className="card-title">Daily Nutrition</h2>
        <span className="status-indicator status-normal">
          <span className="status-dot"></span>
          {nutritionData?.dailySummary?.calories?.consumed || 0} / {nutritionData?.dailySummary?.calories?.target || 2200} kcal
        </span>
      </div>

      <div className="nutrition-grid">
        {nutritionData?.dailySummary && Object.entries(nutritionData.dailySummary)
          .filter(([key]) => ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'].includes(key))
          .map(([macroType, macro]) => (
          <div key={macroType} className="nutrition-item">
            <div className="nutrition-icon-wrapper">
              <span className="nutrition-icon">{getMacroIcon(macroType)}</span>
            </div>
            <div className="nutrition-content">
              <div className="nutrition-label">
                {macroType.charAt(0).toUpperCase() + macroType.slice(1)}
              </div>
              <div className="nutrition-values">
                <span className="nutrition-consumed">{macro.consumed}</span>
                <span className="nutrition-separator">/</span>
                <span className="nutrition-target">{macro.target}</span>
                <span className="nutrition-unit">
                  {macroType === 'calories' ? 'kcal' :
                   macroType === 'sodium' ? 'mg' : 'g'}
                </span>
              </div>
              <div className="nutrition-progress">
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${getStatusClass(macro.percentage || 0)}`}
                    style={{width: `${Math.min(macro.percentage || 0, 100)}%`}}
                  ></div>
                </div>
                <span className="progress-percentage">{macro.percentage || 0}%</span>
              </div>
              {macro.remaining && (
                <div className="nutrition-remaining">
                  {macro.remaining > 0 ? `${macro.remaining} remaining` : 'Goal reached!'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {nutritionData?.dailySummary?.todaysMeals && nutritionData.dailySummary.todaysMeals.length > 0 && (
        <div className="recent-meals">
          <h3 className="recent-meals-title">Today's Meals</h3>
          <div className="meals-list">
            {nutritionData.dailySummary.todaysMeals.slice(-3).map(meal => (
              <div key={meal.id} className="meal-item">
                <div className="meal-info">
                  <div className="meal-time">{meal.time}</div>
                  <div className="meal-type">{meal.mealType}</div>
                  <div className="meal-calories">{meal.totalCalories} kcal</div>
                </div>
                <button
                  className="delete-meal-button"
                  onClick={() => handleDeleteMeal(meal.id)}
                  title="Delete meal"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="nutrition-actions">
        <button
          className="action-button primary"
          onClick={() => {
            console.log('🍽️ Log Meal button clicked')
            setShowMealModal(true)
          }}
        >
          <span className="button-icon">➕</span>
          Log Meal
        </button>
        <button
          className="action-button secondary"
          onClick={() => setShowDetailsModal(true)}
        >
          <span className="button-icon">📊</span>
          View Details
        </button>
      </div>

      <MealLogModal
        isOpen={showMealModal}
        onClose={() => setShowMealModal(false)}
        onMealLogged={handleMealLogged}
      />

      <NutritionDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </div>
  )
}

export default Nutrition