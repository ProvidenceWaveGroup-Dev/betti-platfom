import React, { useState, useEffect } from 'react'
import nutritionApi from '../services/nutritionApi'
import './NutritionDetailsModal.css'

function NutritionDetailsModal({ isOpen, onClose }) {
  const [nutritionHistory, setNutritionHistory] = useState([])
  const [goals, setGoals] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentView, setCurrentView] = useState('history') // history, goals, charts
  const [renderError, setRenderError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadNutritionDetails()
    }
  }, [isOpen])

  const loadNutritionDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load last 7 days of nutrition data
      const [historyData, goalsData] = await Promise.all([
        nutritionApi.getNutritionHistory({ days: 7 }),
        nutritionApi.getNutritionGoals()
      ])

      // The API returns {success: true, data: {history: [...]}}
      setNutritionHistory(historyData.data?.history || [])
      setGoals(goalsData.data || {})
    } catch (error) {
      console.error('Error loading nutrition details:', error)
      setError('Failed to load nutrition details')
    } finally {
      setLoading(false)
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
    if (percentage >= 90) return '#ff8800' // Orange for high
    if (percentage >= 70) return '#00ff88' // Green for good
    return '#ff4444' // Red for low
  }

  if (!isOpen) return null

  // Handle any rendering errors
  try {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="nutrition-details-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Nutrition Details</h2>
            <button className="close-button" onClick={onClose}>✕</button>
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

        {loading && <div className="loading-state">Loading nutrition details...</div>}
        {error && <div className="error-state">{error}</div>}

        {!loading && !error && (
          <div className="modal-content">
            {currentView === 'history' && (
              <div className="history-view">
                <h3>Last 7 Days</h3>
                {!nutritionHistory || nutritionHistory.length === 0 ? (
                  <div className="empty-state">
                    <p>No nutrition data available for the last 7 days.</p>
                    <p>Start logging meals to see your nutrition history!</p>
                  </div>
                ) : (
                  <div className="history-grid">
                    {nutritionHistory.map((day, index) => (
                      <div key={day?.date || index} className="history-day">
                        <div className="day-header">
                          <h4>{day?.date ? formatDate(day.date) : 'Unknown Date'}</h4>
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
                {goals ? (
                  <div className="goals-grid">
                    {Object.entries(goals).map(([nutrient, target]) => (
                      <div key={nutrient} className="goal-item">
                        <div className="goal-header">
                          <span className="goal-name">
                            {nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}
                          </span>
                          <span className="goal-target">
                            {target} {nutrient === 'calories' ? 'kcal' :
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No nutrition goals available.</p>
                  </div>
                )}

                <div className="goals-actions">
                  <button className="action-button primary" disabled>
                    ⚙️ Edit Goals (Coming Soon)
                  </button>
                  <p className="note">
                    Goal editing will be available in a future update.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
  } catch (error) {
    console.error('NutritionDetailsModal render error:', error)
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="nutrition-details-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Nutrition Details</h2>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
          <div className="modal-content">
            <div className="error-state">
              Something went wrong loading the nutrition details.
              <br />
              <button onClick={() => window.location.reload()}>Refresh Page</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default NutritionDetailsModal