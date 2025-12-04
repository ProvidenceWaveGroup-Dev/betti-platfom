import React, { useState, useEffect } from 'react'
import './Hydration.css'
import '../styles/mobileHydration.scss'

function Hydration({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  // Hydration tracking state
  const [todayIntake, setTodayIntake] = useState(0) // in fl oz
  const [dailyGoal, setDailyGoal] = useState(64)
  const [drinks, setDrinks] = useState([])
  const [lastDrinkTime, setLastDrinkTime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [migrated, setMigrated] = useState(false)

  const isMobile = variant === 'mobile'

  // Sip sizes (in fl oz)
  const SIP_SIZE = 0.5    // Regular sip: ~0.5 fl oz
  const BIG_SIP_SIZE = 1.0  // Big sip: ~1 fl oz

  // Quick-add sizes (in fl oz)
  const QUICK_SIZES = [8, 12, 16]

  // Load today's data from API
  useEffect(() => {
    loadHydrationData()
  }, [])

  const loadHydrationData = async () => {
    try {
      setLoading(true)

      // Fetch today's summary
      const response = await fetch('/api/hydration/today')
      if (!response.ok) throw new Error('Failed to fetch hydration data')

      const result = await response.json()
      const data = result.data

      setTodayIntake(data.consumed || 0)
      setDailyGoal(data.target || 64)
      setDrinks(data.drinks || [])

      // Set last drink time
      if (data.drinks && data.drinks.length > 0) {
        setLastDrinkTime(data.drinks[0].recorded_at)
      }

      // Migrate localStorage data if needed (one-time migration)
      if (!migrated && data.drinks.length === 0) {
        await migrateLocalStorageData()
        setMigrated(true)
      }
    } catch (error) {
      console.error('Error loading hydration data:', error)
      setTodayIntake(0)
      setDrinks([])
      setLastDrinkTime(null)
    } finally {
      setLoading(false)
    }
  }

  // Migrate existing localStorage data to database
  const migrateLocalStorageData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const savedData = localStorage.getItem(`hydration_${today}`)

      if (savedData) {
        const data = JSON.parse(savedData)
        if (data.todayIntake > 0) {
          // Log the total intake as a single entry
          await fetch('/api/hydration/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount_oz: data.todayIntake,
              beverage_type: 'water',
              recorded_at: data.lastSipTime || new Date().toISOString()
            })
          })

          // Reload data after migration
          await loadHydrationData()
        }
      }
    } catch (error) {
      console.error('Error migrating localStorage data:', error)
    }
  }

  // Log water intake
  const logIntake = async (amount_oz) => {
    try {
      const response = await fetch('/api/hydration/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_oz,
          beverage_type: 'water'
        })
      })

      if (!response.ok) throw new Error('Failed to log hydration')

      // Reload data
      await loadHydrationData()

      // Mobile haptic feedback
      if (isMobile && navigator.vibrate) {
        navigator.vibrate([30])
      }
    } catch (error) {
      console.error('Error logging hydration:', error)
      alert('Failed to log water intake')
    }
  }

  // Calculate progress
  const percentage = Math.min(100, Math.round((todayIntake / dailyGoal) * 100))
  const remainingOz = Math.max(0, dailyGoal - todayIntake)
  const drinkCount = drinks.length

  const formatLastDrink = (timestamp) => {
    if (!timestamp) return 'No drinks logged'
    const drinkTime = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now - drinkTime) / 60000)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    return `${diffHours}h ago`
  }

  const getStatusClass = (pct) => {
    if (pct >= 100) return 'status-success'
    if (pct >= 50) return 'status-normal'
    return 'status-warning'
  }

  const getStatusText = (pct) => {
    if (pct >= 100) return 'Goal Reached!'
    if (pct >= 50) return 'On Track'
    return 'Needs Attention'
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
    return (
      <div className="hydration-mini">
        <div className="mini-header">
          <span className="mini-icon">💧</span>
          <span className="mini-title">Hydration</span>
          <span className="mini-status">
            {Math.round(todayIntake)} fl oz
          </span>
        </div>
        <div className="mini-hydration-content">
          <div className="mini-progress-bar">
            <div
              className="mini-progress-fill"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <div className="mini-hydration-info">
            <span className="mini-percentage">{percentage}%</span>
            <span className="mini-last-intake">{drinkCount} drinks today</span>
          </div>
        </div>
      </div>
    )
  }

  // Mobile loading state
  if (loading && isMobile) {
    return (
      <div className="mobile-hydration">
        <h2>Hydration Tracker</h2>
        <div className="loading-state">
          <span>Loading hydration data...</span>
        </div>
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="mobile-hydration">
        <h2>Hydration Tracker</h2>

        {/* Status Overview */}
        <section className="hydration-overview">
          <div className={`status-badge ${getStatusClass(percentage)}`}>
            <div className="status-icon">💧</div>
            <div className="status-text">{getStatusText(percentage)}</div>
          </div>
        </section>

        {/* Main Water Tracking */}
        <section className="water-tracking">
          <div className="water-visual">
            <div className="water-glass">
              <div
                className="water-level"
                style={{ height: `${percentage}%` }}
              ></div>
              <div className="glass-outline"></div>
              <div className="water-percentage">{percentage}%</div>
            </div>
          </div>

          <div className="hydration-stats">
            <div className="main-stats">
              <div className="consumed-amount">
                <span className="amount-number">{Math.round(todayIntake)}</span>
                <span className="amount-separator">/</span>
                <span className="amount-target">{dailyGoal}</span>
                <span className="amount-unit">fl oz</span>
              </div>
              <div className="remaining-amount">
                {remainingOz > 0 ? `${Math.round(remainingOz)} fl oz remaining` : 'Goal achieved!'}
              </div>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </section>

        {/* Sip Buttons */}
        <section className="sip-actions">
          <h3>Quick Tracking</h3>
          <div className="sip-buttons-grid">
            <button
              className="sip-button regular-sip"
              onClick={() => logIntake(SIP_SIZE)}
            >
              <div className="sip-icon">💧</div>
              <div className="sip-content">
                <div className="sip-label">Regular Sip</div>
                <div className="sip-size">{SIP_SIZE} fl oz</div>
              </div>
            </button>
            <button
              className="sip-button big-sip"
              onClick={() => logIntake(BIG_SIP_SIZE)}
            >
              <div className="sip-icon">💦</div>
              <div className="sip-content">
                <div className="sip-label">Big Sip</div>
                <div className="sip-size">{BIG_SIP_SIZE} fl oz</div>
              </div>
            </button>
            {QUICK_SIZES.map(size => (
              <button
                key={size}
                className="sip-button quick-add"
                onClick={() => logIntake(size)}
              >
                <div className="sip-icon">🥤</div>
                <div className="sip-content">
                  <div className="sip-label">{size} oz Glass</div>
                  <div className="sip-size">{size} fl oz</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Today's Summary */}
        <section className="todays-summary">
          <h3>Today's Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-icon">💧</div>
              <div className="summary-content">
                <div className="summary-value">{Math.round(todayIntake)}</div>
                <div className="summary-label">fl oz Consumed</div>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon">🥤</div>
              <div className="summary-content">
                <div className="summary-value">{drinkCount}</div>
                <div className="summary-label">Drinks Logged</div>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon">🎯</div>
              <div className="summary-content">
                <div className="summary-value">{percentage}%</div>
                <div className="summary-label">Goal Progress</div>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Details */}
        <section className="hydration-details">
          <div className="detail-row">
            <div className="detail-item">
              <span className="detail-icon">⏰</span>
              <span className="detail-label">Last Drink</span>
              <span className="detail-value">{formatLastDrink(lastDrinkTime)}</span>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <span className="detail-icon">📊</span>
              <span className="detail-label">Average per Drink</span>
              <span className="detail-value">{drinkCount > 0 ? (todayIntake / drinkCount).toFixed(1) : '0'} fl oz</span>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // Desktop full layout
  return (
    <div className="hydration-card">
      <div className="card-header">
        <h3 className="card-title">💧 Daily Hydration</h3>
        <div className={`status-indicator ${getStatusClass(percentage)}`}>
          <span className="status-dot"></span>
          <span>{getStatusText(percentage)}</span>
        </div>
      </div>

      <div className="hydration-main">
        <div className="hydration-summary">
          <div className="hydration-visual">
            <div className="water-glass">
              <div
                className="water-level"
                style={{ height: `${percentage}%` }}
              ></div>
              <div className="glass-outline"></div>
            </div>
          </div>

          <div className="hydration-stats">
            <div className="hydration-numbers">
              <span className="consumed">{Math.round(todayIntake)}</span>
              <span className="separator">/</span>
              <span className="target">{dailyGoal}</span>
              <span className="unit">fl oz</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="progress-info">
              <span className="percentage">{percentage}% of goal</span>
              <span className="remaining">{remainingOz > 0 ? `${Math.round(remainingOz)} fl oz remaining` : 'Goal achieved!'}</span>
            </div>
          </div>
        </div>

        <div className="sip-tracking">
          <div className="sip-counter">
            <h4>Quick Tracking</h4>
            <div className="sip-stats">
              <p className="quick-add-hint">Track sips or log full glasses</p>
            </div>
          </div>

          <div className="sip-buttons">
            <button
              className="sip-button regular-sip"
              onClick={() => logIntake(SIP_SIZE)}
            >
              <span className="sip-icon">💧</span>
              <span className="sip-text">Sip</span>
              <span className="sip-size">{SIP_SIZE} oz</span>
            </button>
            <button
              className="sip-button big-sip"
              onClick={() => logIntake(BIG_SIP_SIZE)}
            >
              <span className="sip-icon">💦</span>
              <span className="sip-text">Big Sip</span>
              <span className="sip-size">{BIG_SIP_SIZE} oz</span>
            </button>
          </div>

          <div className="quick-add-section">
            <h4>Quick Add</h4>
            <div className="quick-add-buttons">
              {QUICK_SIZES.map(size => (
                <button
                  key={size}
                  className="quick-button"
                  onClick={() => logIntake(size)}
                >
                  <span className="quick-icon">🥤</span>
                  <span className="quick-text">{size} oz</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hydration-details">
          <div className="detail-item">
            <span className="detail-icon">⏰</span>
            <span className="detail-label">Last Drink:</span>
            <span className="detail-value">{formatLastDrink(lastDrinkTime)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🥤</span>
            <span className="detail-label">Drinks Today:</span>
            <span className="detail-value">{drinkCount} logged</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">📊</span>
            <span className="detail-label">Average per Drink:</span>
            <span className="detail-value">{drinkCount > 0 ? (todayIntake / drinkCount).toFixed(1) : '0'} fl oz</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hydration
