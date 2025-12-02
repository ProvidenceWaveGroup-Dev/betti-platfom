import { useState, useEffect } from 'react'
import nutritionApi from '../services/nutritionApi'
import '../styles/mobileNutrition.scss'

const MobileNutrition = ({ onNavigate }) => {
  const [nutritionData, setNutritionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMealModal, setShowMealModal] = useState(false)
  const [currentStep, setCurrentStep] = useState('mealType')
  const [mealType, setMealType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFoods, setSelectedFoods] = useState([])
  const [mealLoading, setMealLoading] = useState(false)
  const [mealError, setMealError] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [currentView, setCurrentView] = useState('history')
  const [nutritionHistory, setNutritionHistory] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    loadNutritionData()
  }, [])

  const loadNutritionData = async () => {
    try {
      setLoading(true)

      // Fetch from the same API as desktop
      const data = await nutritionApi.getNutritionDashboardData()
      setNutritionData(data)
    } catch (error) {
      console.error('Error loading nutrition data:', error)

      // Fallback data if API fails
      setNutritionData({
        dailySummary: {
          calories: { consumed: 0, target: 2200, percentage: 0 },
          protein: { consumed: 0, target: 110, percentage: 0 },
          carbs: { consumed: 0, target: 275, percentage: 0 },
          fat: { consumed: 0, target: 73, percentage: 0 },
          fiber: { consumed: 0, target: 25, percentage: 0 },
          sodium: { consumed: 0, target: 2300, percentage: 0 }
        },
        todaysMeals: [],
        lastUpdated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
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

  const getMacroColor = (macroType) => {
    const colors = {
      calories: '#f59e0b',
      protein: '#8b5cf6',
      carbs: '#22c55e',
      fat: '#06b6d4',
      fiber: '#10b981',
      sodium: '#ef4444'
    }
    return colors[macroType] || '#6b7280'
  }

  const getStatusClass = (percentage) => {
    if (percentage >= 90) return 'status-high'
    if (percentage >= 70) return 'status-normal'
    return 'status-low'
  }

  const formatTime = (time) => {
    return time
  }

  // Food search with debounce - use nutritionApi
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeoutId = setTimeout(async () => {
        try {
          setMealLoading(true)

          // Use the same API as desktop - API returns { data: [...] }
          const response = await nutritionApi.searchFoods(searchQuery)
          const foods = response.data || response || []
          setSearchResults(Array.isArray(foods) ? foods.slice(0, 10) : [])
        } catch (error) {
          console.error('Food search error:', error)
          setSearchResults([])
        } finally {
          setMealLoading(false)
        }
      }, 300)

      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  const handleMealTypeSelect = (type) => {
    setMealType(type)
    setCurrentStep('foodSearch')
  }

  const addFood = (food) => {
    const existingIndex = selectedFoods.findIndex(f => f.name === food.name)

    if (existingIndex >= 0) {
      // Increase quantity if food already selected
      const updated = [...selectedFoods]
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1,
        calories: food.calories * (updated[existingIndex].quantity + 1),
        protein: food.protein * (updated[existingIndex].quantity + 1),
        carbs: food.carbs * (updated[existingIndex].quantity + 1),
        fat: food.fat * (updated[existingIndex].quantity + 1)
      }
      setSelectedFoods(updated)
    } else {
      // Add new food
      setSelectedFoods([...selectedFoods, {
        ...food,
        quantity: 1,
        unit: food.unit || 'serving'
      }])
    }
    setSearchQuery('')
  }

  const removeFood = (index) => {
    setSelectedFoods(selectedFoods.filter((_, i) => i !== index))
  }

  const updateFoodQuantity = (index, quantity) => {
    if (quantity <= 0) {
      removeFood(index)
      return
    }

    const updated = [...selectedFoods]
    const food = updated[index]
    const baseFood = {
      calories: food.calories / food.quantity,
      protein: food.protein / food.quantity,
      carbs: food.carbs / food.quantity,
      fat: food.fat / food.quantity
    }

    updated[index] = {
      ...food,
      quantity: parseFloat(quantity),
      calories: baseFood.calories * quantity,
      protein: baseFood.protein * quantity,
      carbs: baseFood.carbs * quantity,
      fat: baseFood.fat * quantity
    }
    setSelectedFoods(updated)
  }

  const handleMealSubmit = async () => {
    if (selectedFoods.length === 0) {
      setMealError('Please add at least one food item')
      return
    }

    try {
      setMealLoading(true)

      // Format foods for API
      const foods = selectedFoods.map(food => ({
        name: food.name,
        quantity: food.quantity,
        unit: food.unit || 'serving',
        calories: Math.round(food.calories / food.quantity), // Per serving
        protein: Math.round(food.protein / food.quantity),
        carbs: Math.round(food.carbs / food.quantity),
        fat: Math.round(food.fat / food.quantity)
      }))

      // Submit to API - logMeal takes (mealType, foods) as separate arguments
      await nutritionApi.logMeal(mealType, foods)

      // Reload data from API to get updated totals
      await loadNutritionData()

      // Close modal and reset
      setShowMealModal(false)
      setCurrentStep('mealType')
      setMealType('')
      setSearchQuery('')
      setSearchResults([])
      setSelectedFoods([])
      setMealError(null)

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }

    } catch (error) {
      console.error('Failed to log meal:', error)
      setMealError('Failed to log meal: ' + error.message)
    } finally {
      setMealLoading(false)
    }
  }

  const resetMealModal = () => {
    setCurrentStep('mealType')
    setMealType('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedFoods([])
    setMealError(null)
  }

  const loadNutritionDetails = async () => {
    try {
      setDetailsLoading(true)

      // Try to fetch history from API
      const history = await nutritionApi.getNutritionHistory(7)
      setNutritionHistory(history || [])
    } catch (error) {
      console.error('Error loading nutrition details:', error)
      setNutritionHistory([])
    } finally {
      setDetailsLoading(false)
    }
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    } catch (error) {
      return dateString || 'Unknown Date'
    }
  }

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return '#f59e0b' // Orange for high
    if (percentage >= 70) return '#22c55e' // Green for good
    return '#ef4444' // Red for low
  }

  const handleViewDetails = () => {
    setShowDetailsModal(true)
    setCurrentView('history')
    loadNutritionDetails()

    if (navigator.vibrate) {
      navigator.vibrate(30)
    }
  }

  const getMealTypeIcon = (mealType) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast': return '🌅'
      case 'lunch': return '☀️'
      case 'dinner': return '🌙'
      case 'snack': return '🍪'
      default: return '🍽️'
    }
  }

  if (loading) {
    return (
      <div className="mobile-nutrition">
        <h2>Nutrition Tracker</h2>
        <div className="loading-state">
          <span>Loading nutrition data...</span>
        </div>
      </div>
    )
  }

  const caloriesData = nutritionData?.dailySummary?.calories
  const todaysMeals = nutritionData?.dailySummary?.todaysMeals || []
  const totalCaloriesToday = todaysMeals.reduce((sum, meal) => sum + meal.totalCalories, 0) || 0

  return (
    <div className="mobile-nutrition">
      <h2>Nutrition Tracker</h2>

      {/* Calorie Overview */}
      <section className="calorie-overview">
        <div className="calorie-summary">
          <div className="calorie-main">
            <span className="calorie-consumed">{caloriesData?.consumed || totalCaloriesToday}</span>
            <span className="calorie-separator">/</span>
            <span className="calorie-target">{caloriesData?.target || 2200}</span>
            <span className="calorie-unit">kcal</span>
          </div>
          <div className="calorie-remaining">
            {(caloriesData?.target || 2200) - (caloriesData?.consumed || totalCaloriesToday)} kcal remaining
          </div>
        </div>
        <div className="calorie-progress-ring">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="35"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="40"
              cy="40"
              r="35"
              stroke={getMacroColor('calories')}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 35}`}
              strokeDashoffset={`${2 * Math.PI * 35 * (1 - (caloriesData?.percentage || 0) / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="calorie-percentage">
            {caloriesData?.percentage || 0}%
          </div>
        </div>
      </section>

      {/* Macros Grid */}
      <section className="macros-section">
        <h3>Macronutrients</h3>
        <div className="macros-grid">
          {nutritionData?.dailySummary && Object.entries(nutritionData.dailySummary)
            .filter(([key]) => ['protein', 'carbs', 'fat', 'fiber', 'sodium'].includes(key))
            .map(([macroType, macro]) => (
            <div key={macroType} className={`macro-item ${getStatusClass(macro.percentage || 0)}`}>
              <div className="macro-header">
                <span
                  className="macro-icon"
                  style={{ color: getMacroColor(macroType) }}
                >
                  {getMacroIcon(macroType)}
                </span>
                <span className="macro-label">
                  {macroType.charAt(0).toUpperCase() + macroType.slice(1)}
                </span>
              </div>
              <div className="macro-values">
                <span className="macro-consumed">{macro.consumed}</span>
                <span className="macro-separator">/</span>
                <span className="macro-target">{macro.target}</span>
                <span className="macro-unit">
                  {macroType === 'sodium' ? 'mg' : 'g'}
                </span>
              </div>
              <div className="macro-progress">
                <div className="macro-progress-bar">
                  <div
                    className="macro-progress-fill"
                    style={{
                      width: `${Math.min(macro.percentage || 0, 100)}%`,
                      backgroundColor: getMacroColor(macroType)
                    }}
                  ></div>
                </div>
                <span className="macro-percentage">{macro.percentage || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Today's Meals */}
      {todaysMeals.length > 0 && (
        <section className="meals-section">
          <h3>Today's Meals</h3>
          <div className="meals-list">
            {todaysMeals.map(meal => (
              <div key={meal.id} className="meal-item">
                <div className="meal-icon">
                  {getMealTypeIcon(meal.mealType)}
                </div>
                <div className="meal-content">
                  <div className="meal-header">
                    <div className="meal-type">{meal.mealType}</div>
                    <div className="meal-time">{formatTime(meal.time)}</div>
                  </div>
                  <div className="meal-calories">
                    {meal.totalCalories} calories
                  </div>
                </div>
                <div className="meal-status">
                  ✓
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="nutrition-actions">
        <button
          className="action-btn primary"
          onClick={() => {
            // Haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate(50)
            }
            setShowMealModal(true)
            resetMealModal()
          }}
        >
          <span className="action-icon">➕</span>
          Log Meal
        </button>
        <button
          className="action-btn secondary"
          onClick={handleViewDetails}
        >
          <span className="action-icon">📊</span>
          View Details
        </button>
      </section>

      {/* Meal Logging Modal */}
      {showMealModal && (
        <div className="modal-overlay" onClick={() => setShowMealModal(false)}>
          <div className="meal-log-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Meal</h2>
              <button
                className="close-button"
                onClick={() => setShowMealModal(false)}
              >
                ✕
              </button>
            </div>

            {mealError && (
              <div className="error-message">
                {mealError}
              </div>
            )}

            {currentStep === 'mealType' && (
              <div className="meal-type-step">
                <h3>What type of meal?</h3>
                <div className="meal-type-grid">
                  {[
                    { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
                    { id: 'lunch', label: 'Lunch', icon: '🌞' },
                    { id: 'dinner', label: 'Dinner', icon: '🌙' },
                    { id: 'snack', label: 'Snack', icon: '🍎' }
                  ].map(type => (
                    <button
                      key={type.id}
                      className="meal-type-button"
                      onClick={() => handleMealTypeSelect(type.id)}
                    >
                      <span className="meal-icon">{type.icon}</span>
                      <span className="meal-label">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'foodSearch' && (
              <div className="food-search-step">
                <div className="step-header">
                  <button
                    className="back-button"
                    onClick={() => setCurrentStep('mealType')}
                  >
                    ← Back
                  </button>
                  <h3>Add Foods to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h3>
                </div>

                <div className="food-search">
                  <input
                    type="text"
                    placeholder="Search for foods..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="food-search-input"
                  />

                  {mealLoading && <div className="search-loading">Searching...</div>}

                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map((food, index) => (
                        <div key={index} className="search-result-item" onClick={() => addFood(food)}>
                          <div className="food-info">
                            <div className="food-name">{food.name}</div>
                            <div className="food-details">
                              {food.calories} cal • {food.protein}g protein
                            </div>
                          </div>
                          <button className="add-food-button">+</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedFoods.length > 0 && (
                  <div className="selected-foods">
                    <h4>Selected Foods:</h4>
                    {selectedFoods.map((food, index) => (
                      <div key={index} className="selected-food-item">
                        <div className="food-details">
                          <div className="food-name">{food.name}</div>
                          <div className="food-nutrition">
                            {Math.round(food.calories)} cal • {Math.round(food.protein)}g protein
                          </div>
                        </div>
                        <div className="quantity-controls">
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={food.quantity}
                            onChange={(e) => updateFoodQuantity(index, e.target.value)}
                            className="quantity-input"
                          />
                          <span className="quantity-unit">{food.unit}</span>
                          <button
                            className="remove-button"
                            onClick={() => removeFood(index)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="modal-actions">
                      <button
                        className="submit-button"
                        onClick={handleMealSubmit}
                        disabled={mealLoading}
                      >
                        {mealLoading ? 'Logging...' : 'Log Meal'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nutrition Details Modal */}
      {showDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="nutrition-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nutrition Details</h2>
              <button
                className="close-button"
                onClick={() => setShowDetailsModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-nav">
              <button
                className={`nav-button ${currentView === 'history' ? 'active' : ''}`}
                onClick={() => setCurrentView('history')}
              >
                📊 History
              </button>
              <button
                className={`nav-button ${currentView === 'goals' ? 'active' : ''}`}
                onClick={() => setCurrentView('goals')}
              >
                🎯 Goals
              </button>
            </div>

            {detailsLoading && <div className="loading-state">Loading nutrition details...</div>}

            {!detailsLoading && (
              <div className="modal-content">
                {currentView === 'history' && (
                  <div className="history-view">
                    <h3>Last 7 Days</h3>
                    {nutritionHistory.length === 0 ? (
                      <div className="empty-state">
                        <p>No nutrition data available for the last 7 days.</p>
                        <p>Start logging meals to see your nutrition history!</p>
                      </div>
                    ) : (
                      <div className="history-grid">
                        {nutritionHistory.map((day, index) => (
                          <div key={day?.date || index} className="history-day">
                            <div className="day-header">
                              <h4>{formatDate(day?.date)}</h4>
                              <span className="total-calories">
                                {day?.calories?.consumed || 0} kcal
                              </span>
                            </div>

                            <div className="day-macros">
                              {['protein', 'carbs', 'fat', 'fiber'].map(macro => (
                                <div key={macro} className="macro-summary">
                                  <span className="macro-name">{macro}</span>
                                  <div className="macro-bar">
                                    <div
                                      className="macro-fill"
                                      style={{
                                        width: `${Math.min(day?.[macro]?.percentage || 0, 100)}%`,
                                        backgroundColor: getProgressColor(day?.[macro]?.percentage || 0)
                                      }}
                                    />
                                  </div>
                                  <span className="macro-percentage">
                                    {Math.round(day?.[macro]?.percentage || 0)}%
                                  </span>
                                </div>
                              ))}
                            </div>

                            {day?.todaysMeals && day.todaysMeals.length > 0 && (
                              <div className="day-meals">
                                <div className="meals-count">
                                  {day.todaysMeals.length} meal{day.todaysMeals.length !== 1 ? 's' : ''} logged
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {currentView === 'goals' && (
                  <div className="goals-view">
                    <h3>Daily Nutrition Goals</h3>
                    <div className="goals-grid">
                      {nutritionData?.dailySummary && Object.entries(nutritionData.dailySummary).map(([nutrient, data]) => (
                        <div key={nutrient} className="goal-item">
                          <div className="goal-header">
                            <span className="goal-name">
                              {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                            </span>
                            <span className="goal-target">
                              {data.target} {nutrient === 'calories' ? 'kcal' :
                                          nutrient === 'sodium' ? 'mg' : 'g'}
                            </span>
                          </div>
                          <div className="goal-description">
                            {nutrient === 'calories' && 'Daily energy intake target'}
                            {nutrient === 'protein' && 'Essential for muscle maintenance'}
                            {nutrient === 'carbs' && 'Primary energy source'}
                            {nutrient === 'fat' && 'Essential fatty acids'}
                            {nutrient === 'fiber' && 'Digestive health'}
                            {nutrient === 'sodium' && 'Daily sodium limit'}
                          </div>
                          <div className="goal-progress">
                            <div className="goal-bar">
                              <div
                                className="goal-fill"
                                style={{
                                  width: `${Math.min(data.percentage || 0, 100)}%`,
                                  backgroundColor: getProgressColor(data.percentage || 0)
                                }}
                              />
                            </div>
                            <span className="goal-current">
                              {data.consumed} / {data.target}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileNutrition