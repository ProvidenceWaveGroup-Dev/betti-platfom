import React, { useState, useEffect } from 'react'
import './Hydration.css'
import '../styles/mobileHydration.scss'

function Hydration({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  // Sip-based hydration tracking
  const [sipCounts, setSipCounts] = useState({ sips: 0, bigSips: 0 })
  const [todayIntake, setTodayIntake] = useState(0) // in fl oz
  const [lastSipTime, setLastSipTime] = useState(null)
  const [loading, setLoading] = useState(true)

  const isMobile = variant === 'mobile'

  // Sip size estimates (in fl oz)
  const SIP_SIZE = 0.5    // Regular sip: ~0.5 fl oz
  const BIG_SIP_SIZE = 1.0  // Big sip: ~1 fl oz
  const DAILY_TARGET = 64   // Target: 64 fl oz (8 cups)

  // Load today's data from localStorage
  useEffect(() => {
    loadHydrationData()
  }, [])

  const loadHydrationData = () => {
    try {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const savedData = localStorage.getItem(`hydration_${today}`)

      if (savedData) {
        const data = JSON.parse(savedData)
        setSipCounts(data.sipCounts || { sips: 0, bigSips: 0 })
        setTodayIntake(data.todayIntake || 0)
        setLastSipTime(data.lastSipTime)
      } else {
        // Initialize with default values
        setSipCounts({ sips: 0, bigSips: 0 })
        setTodayIntake(0)
        setLastSipTime(null)
      }
    } catch (error) {
      console.error('Error loading hydration data:', error)
      setSipCounts({ sips: 0, bigSips: 0 })
      setTodayIntake(0)
      setLastSipTime(null)
    } finally {
      setLoading(false)
    }
  }

  // Save data to localStorage
  const saveData = (newSipCounts, newIntake, timestamp) => {
    const today = new Date().toISOString().split('T')[0]
    const data = {
      sipCounts: newSipCounts,
      todayIntake: newIntake,
      lastSipTime: timestamp,
      date: today
    }
    localStorage.setItem(`hydration_${today}`, JSON.stringify(data))
  }

  // Add sip function
  const addSip = (isBigSip = false) => {
    const timestamp = new Date().toISOString()
    const sipAmount = isBigSip ? BIG_SIP_SIZE : SIP_SIZE
    const newIntake = todayIntake + sipAmount

    const newSipCounts = {
      sips: sipCounts.sips + (isBigSip ? 0 : 1),
      bigSips: sipCounts.bigSips + (isBigSip ? 1 : 0)
    }

    setSipCounts(newSipCounts)
    setTodayIntake(newIntake)
    setLastSipTime(timestamp)
    saveData(newSipCounts, newIntake, timestamp)

    // Mobile haptic feedback
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(isBigSip ? [30, 20, 30] : [30])
    }
  }

  // Calculate progress
  const percentage = Math.min(100, Math.round((todayIntake / DAILY_TARGET) * 100))
  const remainingOz = Math.max(0, DAILY_TARGET - todayIntake)
  const totalSips = sipCounts.sips + sipCounts.bigSips

  const formatLastSip = (timestamp) => {
    if (!timestamp) return 'No sips yet'
    const sipTime = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now - sipTime) / 60000)

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
            <span className="mini-last-intake">{totalSips} sips today</span>
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
                <span className="amount-target">{DAILY_TARGET}</span>
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
          <div className="sip-buttons">
            <button
              className="sip-button regular-sip"
              onClick={() => addSip(false)}
            >
              <div className="sip-icon">💧</div>
              <div className="sip-content">
                <div className="sip-label">Regular Sip</div>
                <div className="sip-size">{SIP_SIZE} fl oz</div>
              </div>
            </button>
            <button
              className="sip-button big-sip"
              onClick={() => addSip(true)}
            >
              <div className="sip-icon">💦</div>
              <div className="sip-content">
                <div className="sip-label">Big Sip</div>
                <div className="sip-size">{BIG_SIP_SIZE} fl oz</div>
              </div>
            </button>
          </div>
        </section>

        {/* Today's Summary */}
        <section className="todays-summary">
          <h3>Today's Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-icon">🥛</div>
              <div className="summary-content">
                <div className="summary-value">{sipCounts.sips}</div>
                <div className="summary-label">Regular Sips</div>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon">💦</div>
              <div className="summary-content">
                <div className="summary-value">{sipCounts.bigSips}</div>
                <div className="summary-label">Big Sips</div>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon">📊</div>
              <div className="summary-content">
                <div className="summary-value">{totalSips}</div>
                <div className="summary-label">Total Sips</div>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Details */}
        <section className="hydration-details">
          <div className="detail-row">
            <div className="detail-item">
              <span className="detail-icon">⏰</span>
              <span className="detail-label">Last Sip</span>
              <span className="detail-value">{formatLastSip(lastSipTime)}</span>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <span className="detail-icon">🎯</span>
              <span className="detail-label">Average per Sip</span>
              <span className="detail-value">{totalSips > 0 ? (todayIntake / totalSips).toFixed(1) : '0'} fl oz</span>
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
              <span className="target">{DAILY_TARGET}</span>
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
            <h4>Today's Sips</h4>
            <div className="sip-stats">
              <div className="sip-stat">
                <span className="sip-count">{sipCounts.sips}</span>
                <span className="sip-label">Regular Sips</span>
                <span className="sip-amount">(~{SIP_SIZE} fl oz each)</span>
              </div>
              <div className="sip-stat">
                <span className="sip-count">{sipCounts.bigSips}</span>
                <span className="sip-label">Big Sips</span>
                <span className="sip-amount">(~{BIG_SIP_SIZE} fl oz each)</span>
              </div>
            </div>
          </div>

          <div className="sip-buttons">
            <button
              className="sip-button regular-sip"
              onClick={() => addSip(false)}
            >
              <span className="sip-icon">💧</span>
              <span className="sip-text">Sip</span>
              <span className="sip-size">{SIP_SIZE} fl oz</span>
            </button>
            <button
              className="sip-button big-sip"
              onClick={() => addSip(true)}
            >
              <span className="sip-icon">💦</span>
              <span className="sip-text">Big Sip</span>
              <span className="sip-size">{BIG_SIP_SIZE} fl oz</span>
            </button>
          </div>
        </div>

        <div className="hydration-details">
          <div className="detail-item">
            <span className="detail-icon">⏰</span>
            <span className="detail-label">Last Sip:</span>
            <span className="detail-value">{formatLastSip(lastSipTime)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">📊</span>
            <span className="detail-label">Total Sips:</span>
            <span className="detail-value">{totalSips} sips</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🎯</span>
            <span className="detail-label">Average per Sip:</span>
            <span className="detail-value">{totalSips > 0 ? (todayIntake / totalSips).toFixed(1) : '0'} fl oz</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hydration
