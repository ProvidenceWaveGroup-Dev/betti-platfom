import React from 'react'
import './Hydration.css'

function Hydration({ isCollapsed = false }) {
  // Sample hydration data - will be replaced with real data later
  const hydrationData = {
    consumed: 6,
    target: 8,
    unit: 'cups',
    percentage: 75,
    lastIntake: '2:30 PM',
    reminders: true
  }

  if (isCollapsed) {
    return (
      <div className="hydration-mini">
        <div className="mini-header">
          <span className="mini-icon">💧</span>
          <span className="mini-title">Hydration</span>
          <span className="mini-status">
            {hydrationData.consumed}/{hydrationData.target} cups
          </span>
        </div>
        <div className="mini-hydration-content">
          <div className="mini-progress-bar">
            <div
              className="mini-progress-fill"
              style={{ width: `${hydrationData.percentage}%` }}
            ></div>
          </div>
          <div className="mini-hydration-info">
            <span className="mini-percentage">{hydrationData.percentage}%</span>
            <span className="mini-last-intake">Last: {hydrationData.lastIntake}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hydration-card">
      <div className="card-header">
        <h3 className="card-title">💧 Daily Hydration</h3>
        <div className="status-indicator status-normal">
          <span className="status-dot"></span>
          <span>On Track</span>
        </div>
      </div>

      <div className="hydration-main">
        <div className="hydration-summary">
          <div className="hydration-visual">
            <div className="water-glass">
              <div
                className="water-level"
                style={{ height: `${hydrationData.percentage}%` }}
              ></div>
              <div className="glass-outline"></div>
            </div>
          </div>

          <div className="hydration-stats">
            <div className="hydration-numbers">
              <span className="consumed">{hydrationData.consumed}</span>
              <span className="separator">/</span>
              <span className="target">{hydrationData.target}</span>
              <span className="unit">{hydrationData.unit}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${hydrationData.percentage}%` }}
              ></div>
            </div>
            <div className="progress-info">
              <span className="percentage">{hydrationData.percentage}% of goal</span>
              <span className="remaining">{hydrationData.target - hydrationData.consumed} cups remaining</span>
            </div>
          </div>
        </div>

        <div className="hydration-details">
          <div className="detail-item">
            <span className="detail-icon">⏰</span>
            <span className="detail-label">Last Intake:</span>
            <span className="detail-value">{hydrationData.lastIntake}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🔔</span>
            <span className="detail-label">Reminders:</span>
            <span className="detail-value">{hydrationData.reminders ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon">🎯</span>
            <span className="detail-label">Next Goal:</span>
            <span className="detail-value">4:00 PM</span>
          </div>
        </div>

        <div className="hydration-actions">
          <button className="action-button primary">
            <span className="button-icon">➕</span>
            Add Water
          </button>
          <button className="action-button secondary">
            <span className="button-icon">⚙️</span>
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default Hydration