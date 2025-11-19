import React, { useState, useEffect } from 'react'
import './Hydration.css'

function Hydration({ isCollapsed = false }) {
  // Sip-based hydration tracking
  const [sipCounts, setSipCounts] = useState({ sips: 0, bigSips: 0 })
  const [todayIntake, setTodayIntake] = useState(0) // in fl oz
  const [lastSipTime, setLastSipTime] = useState(null)

  // Sip size estimates (in fl oz)
  const SIP_SIZE = 0.5    // Regular sip: ~0.5 fl oz
  const BIG_SIP_SIZE = 1.0  // Big sip: ~1 fl oz
  const DAILY_TARGET = 64   // Target: 64 fl oz (8 cups)

  // Load today's data from localStorage
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const savedData = localStorage.getItem(`hydration_${today}`)

    if (savedData) {
      const data = JSON.parse(savedData)
      setSipCounts(data.sipCounts || { sips: 0, bigSips: 0 })
      setTodayIntake(data.todayIntake || 0)
      setLastSipTime(data.lastSipTime)
    }
  }, [])

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

  if (isCollapsed) {
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

  return (
    <div className="hydration-card">
      <div className="card-header">
        <h3 className="card-title">💧 Daily Hydration</h3>
        <div className={`status-indicator ${percentage >= 100 ? 'status-success' : percentage >= 50 ? 'status-normal' : 'status-warning'}`}>
          <span className="status-dot"></span>
          <span>{percentage >= 100 ? 'Goal Reached!' : percentage >= 50 ? 'On Track' : 'Needs Attention'}</span>
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