import React, { useState, useEffect } from 'react'
import vitalsApi from '../services/vitalsApi'
import wsClient from '../services/websocket'
import './Vitals.css'
import '../styles/mobileHealth.scss'

// Default fallback data when API is unavailable or returns empty
const DEFAULT_VITALS = [
  { icon: '❤️', label: 'BLOOD PRESSURE', value: '--/--', unit: 'mmHg', status: 'Normal', updated: 'No data', vitalType: 'blood_pressure' },
  { icon: '💓', label: 'HEART RATE', value: '--', unit: 'bpm', status: 'Normal', updated: 'No data', vitalType: 'heart_rate' },
  { icon: '🫁', label: 'OXYGEN SAT', value: '--', unit: '%', status: 'Normal', updated: 'No data', vitalType: 'spo2' },
  { icon: '🌡️', label: 'TEMPERATURE', value: '--', unit: '°F', status: 'Normal', updated: 'No data', vitalType: 'temperature' }
]

const DEFAULT_WEIGHT = {
  icon: '⚖️',
  label: 'WEIGHT',
  value: '--',
  unit: 'lbs',
  status: 'Normal',
  updated: 'No data',
  vitalType: 'weight'
}

// Vital type configuration for input
const VITAL_INPUT_CONFIG = {
  blood_pressure: {
    label: 'Blood Pressure',
    hasTwoInputs: true,
    primaryLabel: 'Systolic',
    secondaryLabel: 'Diastolic',
    primaryPlaceholder: '120',
    secondaryPlaceholder: '80',
    unit: 'mmHg'
  },
  heart_rate: {
    label: 'Heart Rate',
    hasTwoInputs: false,
    primaryLabel: 'BPM',
    primaryPlaceholder: '72',
    unit: 'bpm'
  },
  spo2: {
    label: 'Oxygen Saturation',
    hasTwoInputs: false,
    primaryLabel: 'SpO2',
    primaryPlaceholder: '98',
    unit: '%'
  },
  temperature: {
    label: 'Temperature',
    hasTwoInputs: false,
    primaryLabel: 'Temperature',
    primaryPlaceholder: '98.6',
    unit: '°F'
  },
  weight: {
    label: 'Weight',
    hasTwoInputs: false,
    primaryLabel: 'Weight',
    primaryPlaceholder: '165',
    unit: 'lbs'
  },
  glucose: {
    label: 'Blood Glucose',
    hasTwoInputs: false,
    primaryLabel: 'Glucose',
    primaryPlaceholder: '100',
    unit: 'mg/dL'
  }
}

function Vitals({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  const [vitals, setVitals] = useState(DEFAULT_VITALS)
  const [weight, setWeight] = useState(DEFAULT_WEIGHT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Input modal state
  const [showInputModal, setShowInputModal] = useState(false)
  const [editingVital, setEditingVital] = useState(null)
  const [inputPrimary, setInputPrimary] = useState('')
  const [inputSecondary, setInputSecondary] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isMobile = variant === 'mobile'

  useEffect(() => {
    loadVitals()

    // Listen for real-time vital updates from BLE devices
    const handleVitalUpdate = (data) => {
      console.log('Received real-time vital update:', data)
      loadVitals()
    }

    wsClient.on('vital-update', handleVitalUpdate)

    return () => {
      wsClient.off('vital-update', handleVitalUpdate)
    }
  }, [])

  const loadVitals = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await vitalsApi.getLatest()

      if (response.success && response.data && response.data.length > 0) {
        const weightVital = response.data.find(v => v.vitalType === 'weight')
        const otherVitals = response.data.filter(v => v.vitalType !== 'weight')

        if (otherVitals.length > 0) {
          setVitals(otherVitals)
        }

        if (weightVital) {
          setWeight(weightVital)
        }
      }
    } catch (err) {
      console.error('Error loading vitals:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVitalClick = (vital) => {
    const vitalType = vital.vitalType
    const config = VITAL_INPUT_CONFIG[vitalType]

    if (!config) return

    setEditingVital({ ...vital, config })

    if (vital.value && vital.value !== '--' && vital.value !== '--/--') {
      if (config.hasTwoInputs && vital.value.includes('/')) {
        const [primary, secondary] = vital.value.split('/')
        setInputPrimary(primary)
        setInputSecondary(secondary)
      } else {
        setInputPrimary(vital.value)
        setInputSecondary('')
      }
    } else {
      setInputPrimary('')
      setInputSecondary('')
    }

    setShowInputModal(true)
  }

  const handleSubmitVital = async () => {
    if (!editingVital || !inputPrimary) return

    const config = editingVital.config
    const valuePrimary = parseFloat(inputPrimary)
    const valueSecondary = config.hasTwoInputs && inputSecondary ? parseFloat(inputSecondary) : null

    if (isNaN(valuePrimary)) {
      alert('Please enter a valid number')
      return
    }

    if (config.hasTwoInputs && inputSecondary && isNaN(valueSecondary)) {
      alert('Please enter a valid number for both values')
      return
    }

    try {
      setSubmitting(true)

      await vitalsApi.recordVital({
        vitalType: editingVital.vitalType,
        valuePrimary,
        valueSecondary,
        unit: config.unit,
        source: 'manual'
      })

      setShowInputModal(false)
      setEditingVital(null)
      setInputPrimary('')
      setInputSecondary('')

      await loadVitals()
    } catch (err) {
      console.error('Error saving vital:', err)
      alert('Failed to save vital: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseModal = () => {
    setShowInputModal(false)
    setEditingVital(null)
    setInputPrimary('')
    setInputSecondary('')
  }

  const getVitalStatus = (status) => {
    const statusMap = {
      'normal': { color: '#22c55e', class: 'normal' },
      'stable': { color: '#22c55e', class: 'stable' },
      'elevated': { color: '#f59e0b', class: 'warning' },
      'high': { color: '#ef4444', class: 'critical' },
      'low': { color: '#f59e0b', class: 'warning' },
      'critical': { color: '#ef4444', class: 'critical' },
      'fever': { color: '#ef4444', class: 'critical' }
    }
    return statusMap[(status || 'normal').toLowerCase()] || statusMap['normal']
  }

  const getOverallStatus = () => {
    const allVitals = [...vitals, weight]
    const hasCritical = allVitals.some(v => v.status?.toLowerCase() === 'critical')
    const hasHigh = allVitals.some(v => ['high', 'fever'].includes(v.status?.toLowerCase()))
    const hasLow = allVitals.some(v => ['low', 'elevated'].includes(v.status?.toLowerCase()))

    if (hasCritical) return { text: 'Critical Alert', class: isMobile ? 'critical' : 'status-critical' }
    if (hasHigh || hasLow) return { text: 'Needs Attention', class: isMobile ? 'warning' : 'status-warning' }
    return { text: 'All Systems Normal', class: isMobile ? 'normal' : 'status-normal' }
  }

  const overallStatus = getOverallStatus()

  // Render the input modal
  const renderInputModal = () => {
    if (!showInputModal || !editingVital) return null

    const config = editingVital.config

    return (
      <div className="vital-input-overlay" onClick={handleCloseModal}>
        <div className="vital-input-modal" onClick={e => e.stopPropagation()}>
          <div className="vital-input-header">
            <h3>Enter {config.label}</h3>
            <button className="vital-input-close" onClick={handleCloseModal}>&times;</button>
          </div>

          <div className="vital-input-body">
            {config.hasTwoInputs ? (
              <div className="vital-input-dual">
                <div className="vital-input-field">
                  <label>{config.primaryLabel}</label>
                  <input
                    type="number"
                    inputMode={isMobile ? 'numeric' : undefined}
                    value={inputPrimary}
                    onChange={e => setInputPrimary(e.target.value)}
                    placeholder={config.primaryPlaceholder}
                    autoFocus
                  />
                </div>
                <span className="vital-input-separator">/</span>
                <div className="vital-input-field">
                  <label>{config.secondaryLabel}</label>
                  <input
                    type="number"
                    inputMode={isMobile ? 'numeric' : undefined}
                    value={inputSecondary}
                    onChange={e => setInputSecondary(e.target.value)}
                    placeholder={config.secondaryPlaceholder}
                  />
                </div>
                <span className="vital-input-unit">{config.unit}</span>
              </div>
            ) : (
              <div className="vital-input-single">
                <div className="vital-input-field">
                  <label>{config.primaryLabel}</label>
                  <input
                    type="number"
                    inputMode={isMobile ? (config.label === 'Temperature' ? 'decimal' : 'numeric') : undefined}
                    step={config.label === 'Temperature' ? '0.1' : '1'}
                    value={inputPrimary}
                    onChange={e => setInputPrimary(e.target.value)}
                    placeholder={config.primaryPlaceholder}
                    autoFocus
                  />
                </div>
                <span className="vital-input-unit">{config.unit}</span>
              </div>
            )}
          </div>

          <div className="vital-input-footer">
            <button className="vital-input-cancel" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              className="vital-input-submit"
              onClick={handleSubmitVital}
              disabled={submitting || !inputPrimary}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
    return (
      <div className="vitals-mini">
        <div className="mini-header">
          <span className="mini-icon">❤️</span>
          <span className="mini-title">Health Vitals</span>
          <span className={`mini-status ${overallStatus.class}`}>● {overallStatus.text}</span>
        </div>
        <div className="mini-vitals-grid">
          {Array.isArray(vitals) && vitals.slice(0, 4).map((vital, index) => (
            <div key={vital.id || index} className="mini-vital-item">
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

  // Mobile layout
  if (isMobile) {
    return (
      <div className="mobile-health">
        <h2>Health Vitals</h2>

        {/* Status Header */}
        <section className="vitals-status-header">
          <div className={`status-indicator ${overallStatus.class}`}>
            <span className="status-dot"></span>
            {loading ? 'Loading...' : overallStatus.text}
          </div>
        </section>

        {/* Current Vitals Cards */}
        <section className="vitals-grid">
          {vitals.map((vital, index) => {
            const statusInfo = getVitalStatus(vital.status)
            return (
              <div key={vital.id || index} className={`vital-card ${statusInfo.class}`}>
                <div className="vital-icon">{vital.icon}</div>
                <div className="vital-info">
                  <div className="vital-label">{vital.label}</div>
                  <div
                    className="vital-value clickable"
                    onClick={() => handleVitalClick(vital)}
                  >
                    {vital.value}
                    <span className="vital-unit">{vital.unit}</span>
                    <span className="edit-hint">✎</span>
                  </div>
                  <div className="vital-status" style={{ color: statusInfo.color }}>
                    {vital.status}
                  </div>
                  <div className="vital-time">Updated {vital.updated}</div>
                </div>
              </div>
            )
          })}
        </section>

        {/* Weight Section */}
        <section className="weight-section">
          <div className={`vital-card ${getVitalStatus(weight.status).class}`}>
            <div className="vital-icon">{weight.icon}</div>
            <div className="vital-info">
              <div className="vital-label">{weight.label}</div>
              <div
                className="vital-value clickable"
                onClick={() => handleVitalClick(weight)}
              >
                {weight.value}
                <span className="vital-unit">{weight.unit}</span>
                <span className="edit-hint">✎</span>
              </div>
              <div className="vital-status" style={{ color: getVitalStatus(weight.status).color }}>
                {weight.status}
              </div>
              <div className="vital-time">Updated {weight.updated}</div>
            </div>
          </div>
        </section>

        {error && (
          <div className="vitals-error">
            <small>Unable to connect to vitals server</small>
          </div>
        )}

        {renderInputModal()}
      </div>
    )
  }

  // Desktop full layout
  return (
    <div className="vitals-widget">
      <div className="vitals-header">
        <h2 className="vitals-title">Health Vitals</h2>
        <span className={`vitals-status ${overallStatus.class}`}>
          <span className="status-dot"></span>
          {loading ? 'Loading...' : overallStatus.text}
        </span>
      </div>

      <div className="vitals-grid">
        {vitals.map((vital, index) => (
          <div key={vital.id || index} className={`vital-card status-${(vital.status || 'normal').toLowerCase()}`}>
            <span className="vital-icon">{vital.icon}</span>
            <div className="vital-info">
              <div className="vital-label">{vital.label}</div>
              <div
                className="vital-value clickable"
                onClick={() => handleVitalClick(vital)}
                title="Click to enter new value"
              >
                {vital.value}
                <span className="vital-unit">{vital.unit}</span>
                <span className="edit-hint">✎</span>
              </div>
              <div className="vital-status">{vital.status}</div>
              <div className="vital-time">Updated {vital.updated}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="weight-section">
        <div className={`vital-card status-${(weight.status || 'normal').toLowerCase()}`}>
          <span className="vital-icon">{weight.icon}</span>
          <div className="vital-info">
            <div className="vital-label">{weight.label}</div>
            <div
              className="vital-value clickable"
              onClick={() => handleVitalClick(weight)}
              title="Click to enter new value"
            >
              {weight.value}
              <span className="vital-unit">{weight.unit}</span>
              <span className="edit-hint">✎</span>
            </div>
            <div className="vital-status">{weight.status}</div>
            <div className="vital-time">Updated {weight.updated}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="vitals-error">
          <small>Unable to connect to vitals server</small>
        </div>
      )}

      {renderInputModal()}
    </div>
  )
}

export default Vitals
