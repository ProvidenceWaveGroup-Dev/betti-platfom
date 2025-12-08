import React, { useState, useEffect } from 'react'
import nutritionApi from '../services/nutritionApi'
import MealLogModal from './MealLogModal'
import NutritionDetailsModal from './NutritionDetailsModal'
import './Nutrition.css'
import '../styles/mobileNutrition.scss'

function Nutrition({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  const [nutritionData, setNutritionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showMealModal, setShowMealModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  // Mobile-specific state for inline modals
  const [currentStep, setCurrentStep] = useState('mealType')
  const [mealType, setMealType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFoods, setSelectedFoods] = useState([])
  const [mealLoading, setMealLoading] = useState(false)
  const [mealError, setMealError] = useState(null)
  const [currentView, setCurrentView] = useState('history')
  const [nutritionHistory, setNutritionHistory] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Meal details/edit state
  const [showMealDetailsModal, setShowMealDetailsModal] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [mealDetailsLoading, setMealDetailsLoading] = useState(false)
  const [isEditingMeal, setIsEditingMeal] = useState(false)
  const [editingFoods, setEditingFoods] = useState([])
  const [editingMealType, setEditingMealType] = useState('')
  const [editSearchQuery, setEditSearchQuery] = useState('')
  const [editSearchResults, setEditSearchResults] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isMobile = variant === 'mobile'

  useEffect(() => {
    loadNutritionData()
  }, [])

  // Food search with debounce (for mobile inline modal)
  useEffect(() => {
    if (!isMobile || searchQuery.length < 2) {
      if (isMobile) setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        setMealLoading(true)
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
  }, [searchQuery, isMobile])

  const loadNutritionData = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await nutritionApi.getNutritionDashboardData()
      setNutritionData(data)
    } catch (error) {
      console.error('Error loading nutrition data:', error)
      setError(error.message)

      // Set fallback data
      setNutritionData({
        dailySummary: {
          calories: { consumed: 0, target: 2200, percentage: 0 },
          protein: { consumed: 0, target: 110, percentage: 0 },
          carbs: { consumed: 0, target: 275, percentage: 0 },
          fat: { consumed: 0, target: 73, percentage: 0 },
          fiber: { consumed: 0, target: 25, percentage: 0 },
          sodium: { consumed: 0, target: 2300, percentage: 0 }
        },
        recentFoods: [],
        lastUpdated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMealLogged = () => {
    loadNutritionData()
  }

  const handleDeleteMeal = async (mealId) => {
    try {
      await nutritionApi.deleteMeal(mealId)
      loadNutritionData()
    } catch (error) {
      console.error('Failed to delete meal:', error)
      setError('Failed to delete meal: ' + error.message)
    }
  }

  // Mobile meal logging functions
  const handleMealTypeSelect = (type) => {
    setMealType(type)
    setCurrentStep('foodSearch')
  }

  const addFood = (food) => {
    const existingIndex = selectedFoods.findIndex(f => f.name === food.name)

    if (existingIndex >= 0) {
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

      const foods = selectedFoods.map(food => ({
        name: food.name,
        quantity: food.quantity,
        unit: food.unit || 'serving',
        calories: Math.round(food.calories / food.quantity),
        protein: Math.round(food.protein / food.quantity),
        carbs: Math.round(food.carbs / food.quantity),
        fat: Math.round(food.fat / food.quantity)
      }))

      await nutritionApi.logMeal(mealType, foods)
      await loadNutritionData()

      setShowMealModal(false)
      resetMealModal()

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

  // Meal details/edit functions
  const handleMealClick = async (meal) => {
    try {
      setMealDetailsLoading(true)
      setShowMealDetailsModal(true)
      setIsEditingMeal(false)
      setShowDeleteConfirm(false)

      const response = await nutritionApi.getMeal(meal.id)
      const mealData = response.data || response
      setSelectedMeal(mealData)
      setEditingFoods(mealData.foods || [])
      setEditingMealType(mealData.mealType)

      if (navigator.vibrate) navigator.vibrate(30)
    } catch (error) {
      console.error('Failed to load meal details:', error)
      setMealError('Failed to load meal details')
    } finally {
      setMealDetailsLoading(false)
    }
  }

  const handleStartEditMeal = () => {
    setIsEditingMeal(true)
    setEditSearchQuery('')
    setEditSearchResults([])
    if (navigator.vibrate) navigator.vibrate(30)
  }

  const handleCancelEditMeal = () => {
    setIsEditingMeal(false)
    setEditingFoods(selectedMeal?.foods || [])
    setEditingMealType(selectedMeal?.mealType || '')
    setEditSearchQuery('')
    setEditSearchResults([])
  }

  const handleSaveMealEdit = async () => {
    if (editingFoods.length === 0) {
      setMealError('Meal must have at least one food item')
      return
    }

    try {
      setMealLoading(true)

      // Prepare foods for API - normalize the data
      const foods = editingFoods.map(food => ({
        name: food.name,
        quantity: food.quantity || 1,
        unit: food.unit || 'serving',
        calories: Math.round((food.calories || 0) / (food.quantity || 1)),
        protein: Math.round((food.protein || 0) / (food.quantity || 1)),
        carbs: Math.round((food.carbs || 0) / (food.quantity || 1)),
        fat: Math.round((food.fat || 0) / (food.quantity || 1)),
        fiber: Math.round((food.fiber || 0) / (food.quantity || 1)),
        sodium: Math.round((food.sodium || 0) / (food.quantity || 1))
      }))

      await nutritionApi.updateMeal(selectedMeal.id, editingMealType, foods)
      await loadNutritionData()

      setShowMealDetailsModal(false)
      setIsEditingMeal(false)
      setSelectedMeal(null)

      if (navigator.vibrate) navigator.vibrate(50)
    } catch (error) {
      console.error('Failed to update meal:', error)
      setMealError('Failed to update meal: ' + error.message)
    } finally {
      setMealLoading(false)
    }
  }

  const handleDeleteMealConfirm = async () => {
    try {
      setMealLoading(true)
      await nutritionApi.deleteMeal(selectedMeal.id)
      await loadNutritionData()

      setShowMealDetailsModal(false)
      setShowDeleteConfirm(false)
      setSelectedMeal(null)

      if (navigator.vibrate) navigator.vibrate(50)
    } catch (error) {
      console.error('Failed to delete meal:', error)
      setMealError('Failed to delete meal: ' + error.message)
    } finally {
      setMealLoading(false)
    }
  }

  const addEditFood = (food) => {
    const existingIndex = editingFoods.findIndex(f => f.name === food.name)

    if (existingIndex >= 0) {
      const updated = [...editingFoods]
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: (updated[existingIndex].quantity || 1) + 1,
        calories: food.calories * ((updated[existingIndex].quantity || 1) + 1),
        protein: food.protein * ((updated[existingIndex].quantity || 1) + 1),
        carbs: food.carbs * ((updated[existingIndex].quantity || 1) + 1),
        fat: food.fat * ((updated[existingIndex].quantity || 1) + 1)
      }
      setEditingFoods(updated)
    } else {
      setEditingFoods([...editingFoods, {
        ...food,
        quantity: 1,
        unit: food.unit || 'serving'
      }])
    }
    setEditSearchQuery('')
    setEditSearchResults([])
  }

  const removeEditFood = (index) => {
    setEditingFoods(editingFoods.filter((_, i) => i !== index))
  }

  const updateEditFoodQuantity = (index, quantity) => {
    if (quantity <= 0) {
      removeEditFood(index)
      return
    }

    const updated = [...editingFoods]
    const food = updated[index]
    const baseCalories = (food.calories || 0) / (food.quantity || 1)
    const baseProtein = (food.protein || 0) / (food.quantity || 1)
    const baseCarbs = (food.carbs || 0) / (food.quantity || 1)
    const baseFat = (food.fat || 0) / (food.quantity || 1)

    updated[index] = {
      ...food,
      quantity: parseFloat(quantity),
      calories: baseCalories * quantity,
      protein: baseProtein * quantity,
      carbs: baseCarbs * quantity,
      fat: baseFat * quantity
    }
    setEditingFoods(updated)
  }

  // Edit food search with debounce
  useEffect(() => {
    if (!isEditingMeal || editSearchQuery.length < 2) {
      setEditSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await nutritionApi.searchFoods(editSearchQuery)
        const foods = response.data || response || []
        setEditSearchResults(Array.isArray(foods) ? foods.slice(0, 8) : [])
      } catch (error) {
        console.error('Edit food search error:', error)
        setEditSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [editSearchQuery, isEditingMeal])

  const loadNutritionDetails = async () => {
    try {
      setDetailsLoading(true)
      const response = await nutritionApi.getNutritionHistory({ days: 7 })
      // API returns { startDate, endDate, history } - extract the history array
      const historyData = response?.history || response?.data?.history || []
      setNutritionHistory(Array.isArray(historyData) ? historyData : [])
    } catch (error) {
      console.error('Error loading nutrition details:', error)
      setNutritionHistory([])
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleViewDetails = () => {
    setShowDetailsModal(true)
    if (isMobile) {
      setCurrentView('history')
      loadNutritionDetails()
      if (navigator.vibrate) {
        navigator.vibrate(30)
      }
    }
  }

  // Shared helper functions
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

  const getMealTypeIcon = (mealType) => {
    switch (mealType?.toLowerCase()) {
      case 'breakfast': return '🌅'
      case 'lunch': return '☀️'
      case 'dinner': return '🌙'
      case 'snack': return '🍪'
      default: return '🍽️'
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
    if (percentage >= 90) return '#f59e0b'
    if (percentage >= 70) return '#22c55e'
    return '#ef4444'
  }

  // Extract data
  const caloriesData = nutritionData?.dailySummary?.calories
  const todaysMeals = nutritionData?.dailySummary?.todaysMeals || []

  // Loading state
  if (loading) {
    if (isMobile) {
      return (
        <div className="mobile-nutrition">
          <h2>Nutrition Tracker</h2>
          <div className="loading-state">
            <span>Loading nutrition data...</span>
          </div>
        </div>
      )
    }
    return (
      <div className={`nutrition-card ${isCollapsed ? 'nutrition-mini' : ''}`}>
        <div className="card-header">
          <h2 className="card-title">Nutrition</h2>
          <span className="status-indicator status-loading">Loading...</span>
        </div>
      </div>
    )
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
    return (
      <div className="nutrition-mini">
        <div className="mini-header">
          <span className="mini-icon">🍎</span>
          <span className="mini-title">Nutrition</span>
          <span className="mini-status status-normal">
            ● {caloriesData?.consumed || 0} / {caloriesData?.target || 2200} kcal
          </span>
        </div>
        <div className="mini-nutrition-grid">
          {nutritionData?.dailySummary && Object.entries(nutritionData.dailySummary)
            .filter(([key]) => ['calories', 'protein', 'carbs', 'fat'].includes(key))
            .map(([key, macro]) => (
            <div key={key} className="mini-nutrition-item">
              <span className="mini-nutrition-icon">{getMacroIcon(key)}</span>
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

  // Mobile layout
  if (isMobile) {
    return (
      <div className="mobile-nutrition">
        <h2>Nutrition Tracker</h2>

        {/* Calorie Overview with Progress Ring */}
        <section className="calorie-overview">
          <div className="calorie-summary">
            <div className="calorie-main">
              <span className="calorie-consumed">{caloriesData?.consumed || 0}</span>
              <span className="calorie-separator">/</span>
              <span className="calorie-target">{caloriesData?.target || 2200}</span>
              <span className="calorie-unit">kcal</span>
            </div>
            <div className="calorie-remaining">
              {(caloriesData?.target || 2200) - (caloriesData?.consumed || 0)} kcal remaining
            </div>
          </div>
          <div className="calorie-progress-ring">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r="35"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="40" cy="40" r="35"
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
                  <span className="macro-icon" style={{ color: getMacroColor(macroType) }}>
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
                  <span className="macro-unit">{macroType === 'sodium' ? 'mg' : 'g'}</span>
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
                <div
                  key={meal.id}
                  className="meal-item clickable"
                  onClick={() => handleMealClick(meal)}
                >
                  <div className="meal-icon">{getMealTypeIcon(meal.mealType)}</div>
                  <div className="meal-content">
                    <div className="meal-header">
                      <div className="meal-type">{meal.mealType}</div>
                      <div className="meal-time">{meal.time}</div>
                    </div>
                    <div className="meal-calories">{meal.totalCalories} calories</div>
                  </div>
                  <div className="meal-chevron">›</div>
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
              if (navigator.vibrate) navigator.vibrate(50)
              setShowMealModal(true)
              resetMealModal()
            }}
          >
            <span className="action-icon">➕</span>
            Log Meal
          </button>
          <button className="action-btn secondary" onClick={handleViewDetails}>
            <span className="action-icon">📊</span>
            View Details
          </button>
        </section>

        {/* Mobile Meal Logging Modal */}
        {showMealModal && (
          <div className="modal-overlay" onClick={() => setShowMealModal(false)}>
            <div className="meal-log-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Log Meal</h2>
                <button className="close-button" onClick={() => setShowMealModal(false)}>✕</button>
              </div>

              {mealError && <div className="error-message">{mealError}</div>}

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
                    <button className="back-button" onClick={() => setCurrentStep('mealType')}>
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
                              <div className="food-details">{food.calories} cal • {food.protein}g protein</div>
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
                            <button className="remove-button" onClick={() => removeFood(index)}>×</button>
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

        {/* Mobile Nutrition Details Modal */}
        {showDetailsModal && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="nutrition-details-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Nutrition Details</h2>
                <button className="close-button" onClick={() => setShowDetailsModal(false)}>✕</button>
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
                                <span className="total-calories">{day?.calories?.consumed || 0} kcal</span>
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
                                    <span className="macro-percentage">{Math.round(day?.[macro]?.percentage || 0)}%</span>
                                  </div>
                                ))}
                              </div>
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
                        {nutritionData?.dailySummary && Object.entries(nutritionData.dailySummary)
                          .filter(([key]) => ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'].includes(key))
                          .map(([nutrient, data]) => (
                          <div key={nutrient} className="goal-item">
                            <div className="goal-header">
                              <span className="goal-name">{nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}</span>
                              <span className="goal-target">
                                {data.target} {nutrient === 'calories' ? 'kcal' : nutrient === 'sodium' ? 'mg' : 'g'}
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
                              <span className="goal-current">{data.consumed} / {data.target}</span>
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

        {/* Meal Details Modal */}
        {showMealDetailsModal && (
          <div className="modal-overlay" onClick={() => {
            setShowMealDetailsModal(false)
            setIsEditingMeal(false)
            setShowDeleteConfirm(false)
          }}>
            <div className="meal-details-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{isEditingMeal ? 'Edit Meal' : 'Meal Details'}</h2>
                <button className="close-button" onClick={() => {
                  setShowMealDetailsModal(false)
                  setIsEditingMeal(false)
                  setShowDeleteConfirm(false)
                }}>✕</button>
              </div>

              {mealError && <div className="error-message">{mealError}</div>}

              {mealDetailsLoading ? (
                <div className="loading-state">Loading meal details...</div>
              ) : selectedMeal && (
                <div className="modal-content">
                  {/* Delete Confirmation */}
                  {showDeleteConfirm ? (
                    <div className="delete-confirm">
                      <div className="delete-icon">🗑️</div>
                      <h3>Delete this meal?</h3>
                      <p>This action cannot be undone.</p>
                      <div className="delete-actions">
                        <button
                          className="cancel-btn"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="delete-btn"
                          onClick={handleDeleteMealConfirm}
                          disabled={mealLoading}
                        >
                          {mealLoading ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : isEditingMeal ? (
                    /* Edit Mode */
                    <div className="edit-mode">
                      {/* Meal Type Selector */}
                      <div className="edit-meal-type">
                        <label>Meal Type</label>
                        <div className="meal-type-options">
                          {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                            <button
                              key={type}
                              className={`meal-type-option ${editingMealType === type ? 'active' : ''}`}
                              onClick={() => setEditingMealType(type)}
                            >
                              {getMealTypeIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Food Search */}
                      <div className="edit-food-search">
                        <input
                          type="text"
                          placeholder="Search to add more foods..."
                          value={editSearchQuery}
                          onChange={(e) => setEditSearchQuery(e.target.value)}
                          className="food-search-input"
                        />
                        {editSearchResults.length > 0 && (
                          <div className="search-results">
                            {editSearchResults.map((food, index) => (
                              <div key={index} className="search-result-item" onClick={() => addEditFood(food)}>
                                <div className="food-info">
                                  <div className="food-name">{food.name}</div>
                                  <div className="food-details">{food.calories} cal</div>
                                </div>
                                <button className="add-food-button">+</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Editing Foods List */}
                      <div className="foods-list editing">
                        <h4>Foods ({editingFoods.length})</h4>
                        {editingFoods.map((food, index) => (
                          <div key={index} className="food-item editing">
                            <div className="food-info">
                              <div className="food-name">{food.name}</div>
                              <div className="food-macros">
                                {Math.round(food.calories || 0)} cal • {Math.round(food.protein || 0)}g protein
                              </div>
                            </div>
                            <div className="food-controls">
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={food.quantity || 1}
                                onChange={(e) => updateEditFoodQuantity(index, parseFloat(e.target.value))}
                                className="quantity-input"
                              />
                              <span className="unit">{food.unit || 'serving'}</span>
                              <button className="remove-btn" onClick={() => removeEditFood(index)}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Edit Actions */}
                      <div className="edit-actions">
                        <button className="cancel-btn" onClick={handleCancelEditMeal}>
                          Cancel
                        </button>
                        <button
                          className="save-btn"
                          onClick={handleSaveMealEdit}
                          disabled={mealLoading || editingFoods.length === 0}
                        >
                          {mealLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="view-mode">
                      {/* Meal Header */}
                      <div className="meal-header-info">
                        <div className="meal-type-badge">
                          <span className="meal-icon">{getMealTypeIcon(selectedMeal.mealType)}</span>
                          <span className="meal-type-text">
                            {selectedMeal.mealType?.charAt(0).toUpperCase() + selectedMeal.mealType?.slice(1)}
                          </span>
                        </div>
                        <div className="meal-time-info">{selectedMeal.time}</div>
                      </div>

                      {/* Nutrition Summary */}
                      <div className="meal-nutrition-summary">
                        <div className="nutrition-stat">
                          <span className="stat-value">{selectedMeal.totalCalories || 0}</span>
                          <span className="stat-label">calories</span>
                        </div>
                        <div className="nutrition-stat">
                          <span className="stat-value">{selectedMeal.totalProtein || 0}g</span>
                          <span className="stat-label">protein</span>
                        </div>
                        <div className="nutrition-stat">
                          <span className="stat-value">{selectedMeal.totalCarbs || 0}g</span>
                          <span className="stat-label">carbs</span>
                        </div>
                        <div className="nutrition-stat">
                          <span className="stat-value">{selectedMeal.totalFat || 0}g</span>
                          <span className="stat-label">fat</span>
                        </div>
                      </div>

                      {/* Foods List */}
                      <div className="foods-list">
                        <h4>Foods ({selectedMeal.foods?.length || 0})</h4>
                        {selectedMeal.foods?.map((food, index) => (
                          <div key={index} className="food-item">
                            <div className="food-info">
                              <div className="food-name">{food.name}</div>
                              <div className="food-macros">
                                {Math.round(food.calories || 0)} cal • {Math.round(food.protein || 0)}g protein
                              </div>
                            </div>
                            <div className="food-quantity">
                              {food.quantity || 1} {food.unit || 'serving'}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="meal-actions">
                        <button className="edit-btn" onClick={handleStartEditMeal}>
                          <span className="btn-icon">✏️</span>
                          Edit Meal
                        </button>
                        <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)}>
                          <span className="btn-icon">🗑️</span>
                          Delete
                        </button>
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

  // Desktop full layout
  return (
    <div className="nutrition-card">
      <div className="card-header">
        <h2 className="card-title">Daily Nutrition</h2>
        <span className="status-indicator status-normal">
          <span className="status-dot"></span>
          {caloriesData?.consumed || 0} / {caloriesData?.target || 2200} kcal
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
                  {macroType === 'calories' ? 'kcal' : macroType === 'sodium' ? 'mg' : 'g'}
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
              {macro.remaining !== undefined && (
                <div className="nutrition-remaining">
                  {macro.remaining > 0 ? `${macro.remaining} remaining` : 'Goal reached!'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {todaysMeals.length > 0 && (
        <div className="recent-meals">
          <h3 className="recent-meals-title">Today's Meals</h3>
          <div className="meals-list">
            {todaysMeals.slice(-3).map(meal => (
              <div
                key={meal.id}
                className="meal-item clickable"
                onClick={() => handleMealClick(meal)}
              >
                <div className="meal-info">
                  <div className="meal-time">{meal.time}</div>
                  <div className="meal-type">{meal.mealType}</div>
                  <div className="meal-calories">{meal.totalCalories} kcal</div>
                </div>
                <span className="meal-chevron">›</span>
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

      {/* Meal Details Modal - Desktop */}
      {showMealDetailsModal && (
        <div className="modal-overlay" onClick={() => {
          setShowMealDetailsModal(false)
          setIsEditingMeal(false)
          setShowDeleteConfirm(false)
        }}>
          <div className="meal-details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditingMeal ? 'Edit Meal' : 'Meal Details'}</h2>
              <button className="close-button" onClick={() => {
                setShowMealDetailsModal(false)
                setIsEditingMeal(false)
                setShowDeleteConfirm(false)
              }}>✕</button>
            </div>

            {mealError && <div className="error-message">{mealError}</div>}

            {mealDetailsLoading ? (
              <div className="loading-state">Loading meal details...</div>
            ) : selectedMeal && (
              <div className="modal-content">
                {/* Delete Confirmation */}
                {showDeleteConfirm ? (
                  <div className="delete-confirm">
                    <div className="delete-icon">🗑️</div>
                    <h3>Delete this meal?</h3>
                    <p>This action cannot be undone.</p>
                    <div className="delete-actions">
                      <button
                        className="cancel-btn"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="delete-btn"
                        onClick={handleDeleteMealConfirm}
                        disabled={mealLoading}
                      >
                        {mealLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : isEditingMeal ? (
                  /* Edit Mode */
                  <div className="edit-mode">
                    {/* Meal Type Selector */}
                    <div className="edit-meal-type">
                      <label>Meal Type</label>
                      <div className="meal-type-options">
                        {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                          <button
                            key={type}
                            className={`meal-type-option ${editingMealType === type ? 'active' : ''}`}
                            onClick={() => setEditingMealType(type)}
                          >
                            {getMealTypeIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Food Search */}
                    <div className="edit-food-search">
                      <input
                        type="text"
                        placeholder="Search to add more foods..."
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        className="food-search-input"
                      />
                      {editSearchResults.length > 0 && (
                        <div className="search-results">
                          {editSearchResults.map((food, index) => (
                            <div key={index} className="search-result-item" onClick={() => addEditFood(food)}>
                              <div className="food-info">
                                <div className="food-name">{food.name}</div>
                                <div className="food-details">{food.calories} cal</div>
                              </div>
                              <button className="add-food-button">+</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Editing Foods List */}
                    <div className="foods-list editing">
                      <h4>Foods ({editingFoods.length})</h4>
                      {editingFoods.map((food, index) => (
                        <div key={index} className="food-item editing">
                          <div className="food-info">
                            <div className="food-name">{food.name}</div>
                            <div className="food-macros">
                              {Math.round(food.calories || 0)} cal • {Math.round(food.protein || 0)}g protein
                            </div>
                          </div>
                          <div className="food-controls">
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={food.quantity || 1}
                              onChange={(e) => updateEditFoodQuantity(index, parseFloat(e.target.value))}
                              className="quantity-input"
                            />
                            <span className="unit">{food.unit || 'serving'}</span>
                            <button className="remove-btn" onClick={() => removeEditFood(index)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Edit Actions */}
                    <div className="edit-actions">
                      <button className="cancel-btn" onClick={handleCancelEditMeal}>
                        Cancel
                      </button>
                      <button
                        className="save-btn"
                        onClick={handleSaveMealEdit}
                        disabled={mealLoading || editingFoods.length === 0}
                      >
                        {mealLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="view-mode">
                    {/* Meal Header */}
                    <div className="meal-header-info">
                      <div className="meal-type-badge">
                        <span className="meal-icon">{getMealTypeIcon(selectedMeal.mealType)}</span>
                        <span className="meal-type-text">
                          {selectedMeal.mealType?.charAt(0).toUpperCase() + selectedMeal.mealType?.slice(1)}
                        </span>
                      </div>
                      <div className="meal-time-info">{selectedMeal.time}</div>
                    </div>

                    {/* Nutrition Summary */}
                    <div className="meal-nutrition-summary">
                      <div className="nutrition-stat">
                        <span className="stat-value">{selectedMeal.totalCalories || 0}</span>
                        <span className="stat-label">calories</span>
                      </div>
                      <div className="nutrition-stat">
                        <span className="stat-value">{selectedMeal.totalProtein || 0}g</span>
                        <span className="stat-label">protein</span>
                      </div>
                      <div className="nutrition-stat">
                        <span className="stat-value">{selectedMeal.totalCarbs || 0}g</span>
                        <span className="stat-label">carbs</span>
                      </div>
                      <div className="nutrition-stat">
                        <span className="stat-value">{selectedMeal.totalFat || 0}g</span>
                        <span className="stat-label">fat</span>
                      </div>
                    </div>

                    {/* Foods List */}
                    <div className="foods-list">
                      <h4>Foods ({selectedMeal.foods?.length || 0})</h4>
                      {selectedMeal.foods?.map((food, index) => (
                        <div key={index} className="food-item">
                          <div className="food-info">
                            <div className="food-name">{food.name}</div>
                            <div className="food-macros">
                              {Math.round(food.calories || 0)} cal • {Math.round(food.protein || 0)}g protein
                            </div>
                          </div>
                          <div className="food-quantity">
                            {food.quantity || 1} {food.unit || 'serving'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="meal-actions">
                      <button className="edit-btn" onClick={handleStartEditMeal}>
                        <span className="btn-icon">✏️</span>
                        Edit Meal
                      </button>
                      <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)}>
                        <span className="btn-icon">🗑️</span>
                        Delete
                      </button>
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

export default Nutrition
