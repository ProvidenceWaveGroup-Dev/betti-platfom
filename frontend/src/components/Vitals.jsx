import React, { useState, useEffect } from 'react'
import './Vitals.css'

function Vitals({ isCollapsed = false }) {
  // Use the exact data from your design image
  const [vitals] = useState([
    { icon: '❤️', label: 'BLOOD PRESSURE', value: '120/80', unit: 'mmHg', status: 'Normal', updated: '2 min ago' },
    { icon: '💓', label: 'HEART RATE', value: '72', unit: 'bpm', status: 'Normal', updated: '2 min ago' },
    { icon: '🫁', label: 'OXYGEN SAT', value: '98', unit: '%', status: 'Normal', updated: '3 min ago' },
    { icon: '🌡️', label: 'TEMPERATURE', value: '98.6', unit: '°F', status: 'Normal', updated: '5 min ago' }
  ])

  const [weight] = useState({
    icon: '⚖️',
    label: 'WEIGHT',
    value: '165',
    unit: 'lbs',
    status: 'Stable',
    updated: '1 hour ago'
  })

  if (isCollapsed) {
    return (
      <div className="vitals-mini">
        <div className="mini-header">
          <span className="mini-icon">❤️</span>
          <span className="mini-title">Health Vitals</span>
          <span className="mini-status status-normal">● All Systems Normal</span>
        </div>
        <div className="mini-vitals-grid">
          {Array.isArray(vitals) && vitals.slice(0, 4).map((vital, index) => (
            <div key={index} className="mini-vital-item">
              <span className="mini-vital-icon">{vital.icon}</span>
              <div className="mini-vital-info">
                <span className="mini-vital-value">{vital.value}</span>
                <span className="mini-vital-label">{vital.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="vitals-widget">
      <div className="vitals-header">
        <h2 className="vitals-title">Health Vitals</h2>
        <span className="vitals-status">
          <span className="status-dot"></span>
          All Systems Normal
        </span>
      </div>

      <div className="vitals-grid">
        {vitals.map((vital, index) => (
          <div key={index} className={`vital-card status-${vital.status.toLowerCase()}`}>
            <span className="vital-icon">{vital.icon}</span>
            <div className="vital-info">
              <div className="vital-label">{vital.label}</div>
              <div className="vital-value">
                {vital.value}
                <span className="vital-unit">{vital.unit}</span>
              </div>
              <div className="vital-status">{vital.status}</div>
              <div className="vital-time">Updated {vital.updated}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="weight-section">
        <div className={`vital-card status-${weight.status.toLowerCase()}`}>
          <span className="vital-icon">{weight.icon}</span>
          <div className="vital-info">
            <div className="vital-label">{weight.label}</div>
            <div className="vital-value">
              {weight.value}
              <span className="vital-unit">{weight.unit}</span>
            </div>
            <div className="vital-status">{weight.status}</div>
            <div className="vital-time">Updated {weight.updated}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Vitals
