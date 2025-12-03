import React, { useState, useEffect } from 'react'
import medicationsApi from '../services/medicationsApi'
import './Medication.css'
import '../styles/mobileMedication.scss'

function Medication({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  // Main data state
  const [scheduledMeds, setScheduledMeds] = useState([])
  const [prnMeds, setPrnMeds] = useState([])
  const [allMedications, setAllMedications] = useState([])
  const [adherenceStats, setAdherenceStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [selectedMedication, setSelectedMedication] = useState(null)
  const [medicationHistory, setMedicationHistory] = useState([])

  // Editor state for Variable Dosage Editor
  const [editorSchedules, setEditorSchedules] = useState([])
  const [editorSaving, setEditorSaving] = useState(false)

  // Add medication form state
  const [addStep, setAddStep] = useState('basic') // basic, schedule, review
  const [newMed, setNewMed] = useState({
    name: '',
    dosage: '',
    dosage_unit: 'mg',
    instructions: '',
    is_prn: false,
    prn_max_daily: null,
    prescriber: '',
    pharmacy: '',
    notes: ''
  })
  const [newSchedules, setNewSchedules] = useState([
    { schedule_time: '08:00', dosage_amount: 1, frequency_type: 'daily', days_of_week: '', interval_days: null }
  ])

  // Details view state
  const [detailsView, setDetailsView] = useState('today') // today, overview, all, adherence

  const isMobile = variant === 'mobile'
  const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Load data on mount
  useEffect(() => {
    loadMedicationData()
  }, [])

  const loadMedicationData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [todayResponse, allResponse, adherenceResponse] = await Promise.all([
        medicationsApi.getTodayMedications(),
        medicationsApi.getMedications(),
        medicationsApi.getAdherenceStats(7)
      ])

      if (todayResponse.success && todayResponse.data) {
        setScheduledMeds(todayResponse.data.scheduled || [])
        setPrnMeds(todayResponse.data.prn || [])
      }

      if (allResponse.success && allResponse.data) {
        setAllMedications(allResponse.data)
      }

      if (adherenceResponse.success && adherenceResponse.data) {
        setAdherenceStats(adherenceResponse.data)
      }
    } catch (err) {
      console.error('Failed to load medications:', err)
      setError('Failed to load medications')
    } finally {
      setLoading(false)
    }
  }

  // Calculate completion stats
  const getCompletionStats = () => {
    const total = scheduledMeds.length
    const taken = scheduledMeds.filter(m => m.taken).length
    const late = scheduledMeds.filter(m => m.late && !m.taken).length
    const pending = scheduledMeds.filter(m => !m.taken && !m.skipped && !m.late).length
    const percentage = total > 0 ? Math.round((taken / total) * 100) : 0
    return { total, taken, late, pending, percentage }
  }

  // Mark medication as taken
  const handleTakeMedication = async (med) => {
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50)
    }

    try {
      await medicationsApi.markTaken(med.medicationId, med.scheduleId || null)
      await loadMedicationData()
    } catch (err) {
      console.error('Failed to mark medication as taken:', err)
    }
  }

  // Mark PRN medication as taken
  const handleTakePrn = async (med) => {
    if (!med.canTakeMore) return

    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50)
    }

    try {
      await medicationsApi.markTaken(med.medicationId, null)
      await loadMedicationData()
    } catch (err) {
      console.error('Failed to log PRN dose:', err)
    }
  }

  // Skip medication
  const handleSkipMedication = async (med, reason = '') => {
    try {
      await medicationsApi.markSkipped(med.medicationId, med.scheduleId || null, reason)
      await loadMedicationData()
    } catch (err) {
      console.error('Failed to skip medication:', err)
    }
  }

  // Add new medication
  const handleAddMedication = async () => {
    try {
      const schedules = newMed.is_prn ? [] : newSchedules.map(s => ({
        schedule_time: s.schedule_time,
        dosage_amount: parseFloat(s.dosage_amount) || 1,
        frequency_type: s.frequency_type,
        days_of_week: s.frequency_type === 'specific_days' ? s.days_of_week : null,
        interval_days: s.frequency_type === 'interval' ? parseInt(s.interval_days) : null,
        interval_start: s.frequency_type === 'interval' ? new Date().toISOString().split('T')[0] : null
      }))

      await medicationsApi.createMedication(newMed, schedules)
      await loadMedicationData()

      // Reset form
      setShowAddModal(false)
      setAddStep('basic')
      setNewMed({
        name: '', dosage: '', dosage_unit: 'mg', instructions: '',
        is_prn: false, prn_max_daily: null, prescriber: '', pharmacy: '', notes: ''
      })
      setNewSchedules([
        { schedule_time: '08:00', dosage_amount: 1, frequency_type: 'daily', days_of_week: '', interval_days: null }
      ])

      if (isMobile && navigator.vibrate) {
        navigator.vibrate([50, 50, 50])
      }
    } catch (err) {
      console.error('Failed to add medication:', err)
      setError('Failed to add medication')
    }
  }

  // View medication history
  const handleViewHistory = async (med) => {
    try {
      const response = await medicationsApi.getMedicationHistory(med.medicationId || med.id, 30)
      if (response.success) {
        setMedicationHistory(response.data)
        setSelectedMedication(response.medication)
        setShowHistoryModal(true)
      }
    } catch (err) {
      console.error('Failed to load medication history:', err)
    }
  }

  // Delete medication
  const handleDeleteMedication = async (medId) => {
    try {
      await medicationsApi.deleteMedication(medId)
      await loadMedicationData()
      setShowHistoryModal(false)
    } catch (err) {
      console.error('Failed to delete medication:', err)
    }
  }

  // Open Variable Dosage Editor for a medication
  const handleOpenEditor = (med) => {
    // Find the full medication data with schedules
    const fullMed = allMedications.find(m => m.id === (med.medicationId || med.id))
    if (!fullMed) return

    setSelectedMedication(fullMed)

    // Initialize editor schedules from medication's existing schedules
    // Each schedule represents a time slot with doses for each day
    if (fullMed.schedules && fullMed.schedules.length > 0) {
      // Check if using new per-day schema (day_of_week populated)
      const usesPerDaySchema = fullMed.schedules.some(s => s.day_of_week != null)

      // Group by time and build editor structure
      const timeGroups = {}

      if (usesPerDaySchema) {
        // New schema: one row per day-time combination
        for (const schedule of fullMed.schedules) {
          const time = schedule.schedule_time || '08:00'
          if (!timeGroups[time]) {
            timeGroups[time] = {
              time,
              doses: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
            }
          }

          // Set the dose for this specific day
          const day = schedule.day_of_week
          if (day && DAYS_OF_WEEK.includes(day)) {
            timeGroups[time].doses[day] = schedule.dosage_amount || 1
          }
        }
      } else {
        // Old schema: use frequency_type and days_of_week
        for (const schedule of fullMed.schedules) {
          const time = schedule.schedule_time || '08:00'
          if (!timeGroups[time]) {
            timeGroups[time] = {
              time,
              doses: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
            }
          }

          // Determine which days this schedule applies to
          const frequencyType = schedule.frequency_type || 'daily'
          const dosage = schedule.dosage_amount || 1

          if (frequencyType === 'daily') {
            DAYS_OF_WEEK.forEach(day => {
              timeGroups[time].doses[day] = dosage
            })
          } else if (frequencyType === 'specific_days' && schedule.days_of_week) {
            const days = schedule.days_of_week.toLowerCase().split(',')
            days.forEach(day => {
              if (DAYS_OF_WEEK.includes(day.trim())) {
                timeGroups[time].doses[day.trim()] = dosage
              }
            })
          } else if (frequencyType === 'interval') {
            // For interval, show simplified pattern (even/odd)
            DAYS_OF_WEEK.forEach((day, idx) => {
              if ((schedule.interval_days === 2 && idx % 2 === 0) ||
                  (schedule.interval_days !== 2 && idx % (schedule.interval_days || 1) === 0)) {
                timeGroups[time].doses[day] = dosage
              }
            })
          }
        }
      }

      setEditorSchedules(Object.values(timeGroups).sort((a, b) => a.time.localeCompare(b.time)))
    } else {
      // Default: one time slot at 8 AM with all days having 1 dose
      setEditorSchedules([{
        time: '08:00',
        doses: { mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, sun: 1 }
      }])
    }

    setShowEditorModal(true)
  }

  // Add a new time slot to the editor
  const handleAddTimeSlot = () => {
    // Find the next available time (add 4 hours to the last time)
    const lastTime = editorSchedules.length > 0
      ? editorSchedules[editorSchedules.length - 1].time
      : '08:00'
    const [h, m] = lastTime.split(':').map(Number)
    const newHour = (h + 4) % 24
    const newTime = `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

    setEditorSchedules([...editorSchedules, {
      time: newTime,
      doses: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
    }])
  }

  // Remove a time slot from the editor
  const handleRemoveTimeSlot = (index) => {
    if (editorSchedules.length <= 1) return // Keep at least one time slot
    setEditorSchedules(editorSchedules.filter((_, i) => i !== index))
  }

  // Update time for a slot
  const handleTimeChange = (index, newTime) => {
    setEditorSchedules(editorSchedules.map((slot, i) =>
      i === index ? { ...slot, time: newTime } : slot
    ))
  }

  // Update dose for a specific day in a time slot
  const handleDoseChange = (slotIndex, day, value) => {
    const dose = parseInt(value) || 0
    setEditorSchedules(editorSchedules.map((slot, i) =>
      i === slotIndex
        ? { ...slot, doses: { ...slot.doses, [day]: dose } }
        : slot
    ))
  }

  // Quick set functions for editor
  const handleQuickSet = (slotIndex, preset) => {
    const doseValue = 1
    let newDoses = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }

    switch (preset) {
      case 'all':
        newDoses = { mon: doseValue, tue: doseValue, wed: doseValue, thu: doseValue, fri: doseValue, sat: doseValue, sun: doseValue }
        break
      case 'weekdays':
        newDoses = { mon: doseValue, tue: doseValue, wed: doseValue, thu: doseValue, fri: doseValue, sat: 0, sun: 0 }
        break
      case 'weekends':
        newDoses = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: doseValue, sun: doseValue }
        break
      case 'clear':
        newDoses = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
        break
      default:
        break
    }

    setEditorSchedules(editorSchedules.map((slot, i) =>
      i === slotIndex ? { ...slot, doses: newDoses } : slot
    ))
  }

  // Calculate weekly total doses
  const calculateWeeklyTotal = () => {
    let total = 0
    for (const slot of editorSchedules) {
      for (const day of DAYS_OF_WEEK) {
        total += slot.doses[day] || 0
      }
    }
    return total
  }

  // Save editor changes
  const handleSaveEditor = async () => {
    if (!selectedMedication) return

    try {
      setEditorSaving(true)

      // Use the new per-day schedule API format
      // editorSchedules is already in the correct format: [{ time, doses: { mon, tue, ... } }]
      await medicationsApi.updateSchedule(selectedMedication.id, editorSchedules)

      // Reload data and close modal
      await loadMedicationData()
      setShowEditorModal(false)
      setEditorSaving(false)
    } catch (err) {
      console.error('Failed to save medication schedule:', err)
      setEditorSaving(false)
    }
  }

  // Helper functions
  const formatTime = (time) => medicationsApi.formatTime(time)
  const getMedIcon = (type) => medicationsApi.getMedIcon(type)
  const getMedTypeColor = (type) => medicationsApi.getMedTypeColor(type)
  const getStatusColor = (status) => medicationsApi.getStatusColor(status)

  // Format dosage with unit - handles both med objects and separate dosage/unit params
  const formatDosage = (dosageOrMed, unit) => {
    if (typeof dosageOrMed === 'object' && dosageOrMed !== null) {
      // Called with a medication object
      const dosage = dosageOrMed.dosage
      const dosageUnit = dosageOrMed.dosage_unit || dosageOrMed.dosageUnit
      if (!dosage) return ''
      return dosageUnit ? `${dosage} ${dosageUnit}` : dosage
    }
    // Called with separate dosage and unit
    if (!dosageOrMed) return ''
    return unit ? `${dosageOrMed} ${unit}` : dosageOrMed
  }

  const isOverdue = (time) => {
    const now = new Date()
    const [hour, minute] = time.split(':')
    const medTime = new Date()
    medTime.setHours(parseInt(hour), parseInt(minute), 0, 0)
    return now > medTime
  }

  const getNextMedication = () => {
    const upcoming = scheduledMeds.filter(m => !m.taken && !m.skipped)
    return upcoming.length > 0 ? upcoming[0] : null
  }

  // Overview Panel Helper Functions
  const getMedicationType = (med) => {
    if (med.is_prn) return 'prn'
    if (!med.schedules || med.schedules.length === 0) return 'prn'

    // Check if medication has variable doses (different dosage_amount on different days)
    const uniqueDosages = new Set(med.schedules.map(s => s.dosage_amount))
    const hasVariableDose = uniqueDosages.size > 1

    // Check if any schedule is specific_days or interval
    const hasVariableSchedule = med.schedules.some(s =>
      s.frequency_type === 'specific_days' || s.frequency_type === 'interval'
    )

    if (hasVariableDose || hasVariableSchedule) return 'variable'
    return 'daily'
  }

  const getScheduleForDay = (med, dayIndex) => {
    if (!med.schedules || med.schedules.length === 0) return []

    const dayName = DAYS_OF_WEEK[dayIndex]
    const result = []

    for (const schedule of med.schedules) {
      let appliesToday = false

      switch (schedule.frequency_type) {
        case 'daily':
          appliesToday = true
          break
        case 'specific_days':
          const days = (schedule.days_of_week || '').toLowerCase().split(',')
          appliesToday = days.includes(dayName)
          break
        case 'interval':
          // For interval, calculate if this day of the week would be included
          // We'll show it with a special indicator since it depends on start date
          if (schedule.interval_days === 2) {
            // Every other day - show on alternating days starting from Monday
            appliesToday = dayIndex % 2 === 0
          } else {
            // More complex intervals - show with indicator
            appliesToday = dayIndex % (schedule.interval_days || 1) === 0
          }
          break
        default:
          appliesToday = true
      }

      if (appliesToday) {
        result.push({
          time: schedule.schedule_time,
          dose: schedule.dosage_amount || 1,
          frequencyType: schedule.frequency_type,
          intervalDays: schedule.interval_days
        })
      }
    }

    // Sort by time
    result.sort((a, b) => a.time.localeCompare(b.time))
    return result
  }

  const getTodayDayIndex = () => {
    const today = new Date().getDay()
    // Convert from Sunday=0 to Monday=0
    return today === 0 ? 6 : today - 1
  }

  const getDailySummary = () => {
    const todayIndex = getTodayDayIndex()
    const summary = []

    for (const med of allMedications) {
      if (med.is_prn) continue

      const schedules = getScheduleForDay(med, todayIndex)
      for (const schedule of schedules) {
        summary.push({
          name: med.name,
          dosage: med.dosage,
          dosageUnit: med.dosage_unit,
          time: schedule.time,
          dose: schedule.dose
        })
      }
    }

    // Sort by time
    summary.sort((a, b) => a.time.localeCompare(b.time))
    return summary
  }

  const getPrnMedications = () => {
    return allMedications.filter(med => med.is_prn)
  }

  const getTotalDailyDoses = () => {
    const todayIndex = getTodayDayIndex()
    let total = 0

    for (const med of allMedications) {
      if (med.is_prn) continue
      const schedules = getScheduleForDay(med, todayIndex)
      total += schedules.length
    }

    return total
  }

  const stats = getCompletionStats()

  // Loading state
  if (loading) {
    return (
      <div className={isMobile ? 'mobile-medication' : 'medication-card'}>
        {isMobile ? <h2>Medication Tracker</h2> : (
          <div className="card-header">
            <h2 className="card-title">Medication</h2>
          </div>
        )}
        <div className="loading-state">Loading medications...</div>
      </div>
    )
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
    return (
      <div className="medication-card collapsed">
        <div className="card-header">
          <h3 className="card-title">Medication</h3>
          <div className="completion-badge">{stats.taken}/{stats.total}</div>
        </div>
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    const nextMed = getNextMedication()

    return (
      <div className="mobile-medication">
        <h2>Medication Tracker</h2>

        {/* Progress Overview */}
        <section className="medication-overview">
          <div className="progress-stats">
            <div className="completion-info">
              <span className="completion-text">{stats.taken} of {stats.total} taken</span>
              <span className="completion-percentage">{stats.percentage}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${stats.percentage}%`,
                    backgroundColor: stats.percentage === 100 ? '#22c55e' : '#4a9eff'
                  }}
                ></div>
              </div>
            </div>
          </div>

          {stats.taken === stats.total && stats.total > 0 && (
            <div className="completion-message">All medications taken today!</div>
          )}

          {stats.late > 0 && (
            <div className="late-warning">{stats.late} medication(s) overdue</div>
          )}
        </section>

        {/* Next Medication Reminder */}
        {nextMed && (
          <section className="next-medication-card">
            <div className="next-med-header">
              <span className="next-med-label">Next Medication</span>
              <span className={`next-med-time ${nextMed.late ? 'overdue' : ''}`}>
                {formatTime(nextMed.time)}
              </span>
            </div>
            <div className="next-med-details">
              <span className="next-med-icon" style={{ color: getMedTypeColor(nextMed.type) }}>
                {getMedIcon(nextMed.type)}
              </span>
              <div className="next-med-info">
                <div className="next-med-name">{nextMed.name}</div>
                <div className="next-med-dosage">{formatDosage(nextMed)}</div>
              </div>
              <button className="quick-take-btn" onClick={() => handleTakeMedication(nextMed)}>
                Take Now
              </button>
            </div>
          </section>
        )}

        {/* Scheduled Medications List */}
        <section className="medications-list">
          <h3>Today's Schedule</h3>
          {scheduledMeds.length === 0 ? (
            <div className="empty-state">No scheduled medications for today</div>
          ) : (
            scheduledMeds.map((med) => (
              <div
                key={med.id}
                className={`medication-item ${med.taken ? 'completed' : ''} ${med.late ? 'overdue' : ''}`}
              >
                <div className="med-time-badge">
                  <div className="med-time">{formatTime(med.time)}</div>
                </div>

                <div className="med-content">
                  <div className="med-header">
                    <span
                      className="med-icon"
                      style={{
                        color: getMedTypeColor(med.type),
                        backgroundColor: `${getMedTypeColor(med.type)}20`
                      }}
                    >
                      {getMedIcon(med.type)}
                    </span>
                    <div className="med-info">
                      <div className="med-name">{med.name}</div>
                    </div>
                  </div>

                  {med.dosage && (
                    <div className="med-dosage">{formatDosage(med)}</div>
                  )}

                  {med.instructions && (
                    <div className="med-instructions">{med.instructions}</div>
                  )}

                  {med.late && !med.taken && (
                    <div className="overdue-warning">Overdue</div>
                  )}
                </div>

                <div className="med-actions">
                  {!med.taken && !med.skipped && (
                    <>
                      <button
                        className="med-toggle-btn pending"
                        onClick={() => handleTakeMedication(med)}
                      >
                        Take
                      </button>
                      <button
                        className="med-skip-btn"
                        onClick={() => handleSkipMedication(med)}
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {med.taken && (
                    <span className="med-status taken">Taken</span>
                  )}
                  {med.skipped && (
                    <span className="med-status skipped">Skipped</span>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* PRN Medications */}
        {prnMeds.length > 0 && (
          <section className="prn-medications">
            <h3>As Needed (PRN)</h3>
            {prnMeds.map((med) => (
              <div key={med.id} className="prn-medication-item">
                <div className="prn-med-info">
                  <span className="prn-med-icon" style={{ color: getMedTypeColor(med.type) }}>
                    {getMedIcon(med.type)}
                  </span>
                  <div className="prn-med-details">
                    <div className="prn-med-name">{med.name}</div>
                    <div className="prn-med-dosage">{formatDosage(med)}</div>
                    {med.prnMaxDaily && (
                      <div className="prn-med-limit">
                        {med.dosesTakenToday}/{med.prnMaxDaily} doses today
                      </div>
                    )}
                  </div>
                </div>
                <button
                  className={`prn-take-btn ${!med.canTakeMore ? 'disabled' : ''}`}
                  onClick={() => handleTakePrn(med)}
                  disabled={!med.canTakeMore}
                >
                  {med.canTakeMore ? 'Take Dose' : 'Max Reached'}
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Quick Actions */}
        <section className="medication-actions">
          <button
            className="action-btn primary"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(50)
              setShowAddModal(true)
              setAddStep('basic')
            }}
          >
            <span className="action-icon">+</span>
            Add Medication
          </button>
          <button
            className="action-btn secondary"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(30)
              setShowDetailsModal(true)
              setDetailsView('today')
            }}
          >
            View Details
          </button>
        </section>

        {/* Add Medication Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="medication-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Medication</h2>
                <button className="close-button" onClick={() => setShowAddModal(false)}>X</button>
              </div>

              {addStep === 'basic' && (
                <div className="modal-step">
                  <div className="form-group">
                    <label>Medication Name *</label>
                    <input
                      type="text"
                      value={newMed.name}
                      onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                      placeholder="e.g., Lisinopril"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Dosage</label>
                      <input
                        type="text"
                        value={newMed.dosage}
                        onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <select
                        value={newMed.dosage_unit}
                        onChange={(e) => setNewMed({ ...newMed, dosage_unit: e.target.value })}
                      >
                        <option value="mg">mg</option>
                        <option value="mcg">mcg</option>
                        <option value="ml">ml</option>
                        <option value="tablet">tablet</option>
                        <option value="capsule">capsule</option>
                        <option value="drops">drops</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Instructions</label>
                    <input
                      type="text"
                      value={newMed.instructions}
                      onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                      placeholder="e.g., Take with food"
                    />
                  </div>

                  <div className="form-group checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={newMed.is_prn}
                        onChange={(e) => setNewMed({ ...newMed, is_prn: e.target.checked })}
                      />
                      As needed (PRN)
                    </label>
                  </div>

                  {newMed.is_prn && (
                    <div className="form-group">
                      <label>Max doses per day</label>
                      <input
                        type="number"
                        min="1"
                        value={newMed.prn_max_daily || ''}
                        onChange={(e) => setNewMed({ ...newMed, prn_max_daily: parseInt(e.target.value) || null })}
                        placeholder="e.g., 4"
                      />
                    </div>
                  )}

                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => setAddStep(newMed.is_prn ? 'review' : 'schedule')}
                      disabled={!newMed.name}
                    >
                      {newMed.is_prn ? 'Review' : 'Next: Schedule'}
                    </button>
                  </div>
                </div>
              )}

              {addStep === 'schedule' && (
                <div className="modal-step">
                  <h3>Set Schedule</h3>

                  {newSchedules.map((schedule, index) => (
                    <div key={index} className="schedule-entry">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Time</label>
                          <input
                            type="time"
                            value={schedule.schedule_time}
                            onChange={(e) => {
                              const updated = [...newSchedules]
                              updated[index].schedule_time = e.target.value
                              setNewSchedules(updated)
                            }}
                          />
                        </div>
                        <div className="form-group">
                          <label>Amount</label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={schedule.dosage_amount}
                            onChange={(e) => {
                              const updated = [...newSchedules]
                              updated[index].dosage_amount = e.target.value
                              setNewSchedules(updated)
                            }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Frequency</label>
                        <select
                          value={schedule.frequency_type}
                          onChange={(e) => {
                            const updated = [...newSchedules]
                            updated[index].frequency_type = e.target.value
                            setNewSchedules(updated)
                          }}
                        >
                          <option value="daily">Daily</option>
                          <option value="specific_days">Specific Days</option>
                          <option value="interval">Every X Days</option>
                        </select>
                      </div>

                      {schedule.frequency_type === 'specific_days' && (
                        <div className="form-group">
                          <label>Days</label>
                          <div className="day-checkboxes">
                            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                              <label key={day} className="day-checkbox">
                                <input
                                  type="checkbox"
                                  checked={(schedule.days_of_week || '').includes(day)}
                                  onChange={(e) => {
                                    const updated = [...newSchedules]
                                    const days = (updated[index].days_of_week || '').split(',').filter(d => d)
                                    if (e.target.checked) {
                                      days.push(day)
                                    } else {
                                      const idx = days.indexOf(day)
                                      if (idx > -1) days.splice(idx, 1)
                                    }
                                    updated[index].days_of_week = days.join(',')
                                    setNewSchedules(updated)
                                  }}
                                />
                                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {schedule.frequency_type === 'interval' && (
                        <div className="form-group">
                          <label>Every X days</label>
                          <input
                            type="number"
                            min="2"
                            value={schedule.interval_days || ''}
                            onChange={(e) => {
                              const updated = [...newSchedules]
                              updated[index].interval_days = parseInt(e.target.value)
                              setNewSchedules(updated)
                            }}
                            placeholder="e.g., 2 for every other day"
                          />
                        </div>
                      )}

                      {newSchedules.length > 1 && (
                        <button
                          className="remove-schedule-btn"
                          onClick={() => setNewSchedules(newSchedules.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    className="add-schedule-btn"
                    onClick={() => setNewSchedules([...newSchedules, {
                      schedule_time: '12:00', dosage_amount: 1, frequency_type: 'daily', days_of_week: '', interval_days: null
                    }])}
                  >
                    + Add Another Time
                  </button>

                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => setAddStep('basic')}>
                      Back
                    </button>
                    <button className="btn-primary" onClick={() => setAddStep('review')}>
                      Review
                    </button>
                  </div>
                </div>
              )}

              {addStep === 'review' && (
                <div className="modal-step">
                  <h3>Review Medication</h3>

                  <div className="review-summary">
                    <div className="review-item">
                      <span className="review-label">Name:</span>
                      <span className="review-value">{newMed.name}</span>
                    </div>
                    <div className="review-item">
                      <span className="review-label">Dosage:</span>
                      <span className="review-value">{newMed.dosage} {newMed.dosage_unit}</span>
                    </div>
                    {newMed.instructions && (
                      <div className="review-item">
                        <span className="review-label">Instructions:</span>
                        <span className="review-value">{newMed.instructions}</span>
                      </div>
                    )}
                    {newMed.is_prn ? (
                      <div className="review-item">
                        <span className="review-label">Type:</span>
                        <span className="review-value">
                          As needed (PRN){newMed.prn_max_daily ? `, max ${newMed.prn_max_daily}/day` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="review-item">
                        <span className="review-label">Schedule:</span>
                        <span className="review-value">
                          {newSchedules.map((s, i) => (
                            <div key={i}>
                              {formatTime(s.schedule_time)} - {s.dosage_amount} dose(s)
                              {s.frequency_type !== 'daily' && ` (${medicationsApi.getFrequencyLabel(s.frequency_type, s.days_of_week, s.interval_days)})`}
                            </div>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => setAddStep(newMed.is_prn ? 'basic' : 'schedule')}>
                      Back
                    </button>
                    <button className="btn-primary" onClick={handleAddMedication}>
                      Add Medication
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details/Stats Modal */}
        {showDetailsModal && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="medication-modal details-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Medication Details</h2>
                <button className="close-button" onClick={() => setShowDetailsModal(false)}>X</button>
              </div>

              <div className="modal-nav">
                <button
                  className={`nav-button ${detailsView === 'today' ? 'active' : ''}`}
                  onClick={() => setDetailsView('today')}
                >
                  Today
                </button>
                <button
                  className={`nav-button ${detailsView === 'overview' ? 'active' : ''}`}
                  onClick={() => setDetailsView('overview')}
                >
                  Overview
                </button>
                <button
                  className={`nav-button ${detailsView === 'adherence' ? 'active' : ''}`}
                  onClick={() => setDetailsView('adherence')}
                >
                  Adherence
                </button>
              </div>

              <div className="modal-content">
                {detailsView === 'today' && (
                  <div className="today-view">
                    <div className="stats-summary">
                      <div className="stat-item">
                        <span className="stat-value">{stats.taken}</span>
                        <span className="stat-label">Taken</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.pending}</span>
                        <span className="stat-label">Pending</span>
                      </div>
                      <div className="stat-item late">
                        <span className="stat-value">{stats.late}</span>
                        <span className="stat-label">Late</span>
                      </div>
                    </div>

                    {/* Daily Summary for Today */}
                    <div className="daily-summary">
                      <h4>Today's Schedule ({DAY_LABELS[getTodayDayIndex()]})</h4>
                      <div className="summary-stat">{getTotalDailyDoses()} doses scheduled</div>
                      <div className="summary-list">
                        {getDailySummary().map((item, idx) => (
                          <div key={idx} className="summary-item">
                            <span className="summary-time">{formatTime(item.time)}</span>
                            <span className="summary-med">{item.name}</span>
                            <span className="summary-dose">{formatDosage(item)}</span>
                          </div>
                        ))}
                        {getPrnMedications().length > 0 && (
                          <div className="summary-prn">
                            + {getPrnMedications().length} PRN medication(s) available as needed
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {detailsView === 'overview' && (
                  <div className="overview-view">
                    {allMedications.filter(med => !med.is_prn).map(med => {
                      const medType = getMedicationType(med)
                      return (
                        <div key={med.id} className={`overview-medication ${medType}`}>
                          <div className="overview-med-header">
                            <div className="overview-med-info">
                              <span className="overview-med-name">{med.name}</span>
                              <span className={`med-type-badge ${medType}`}>
                                {medType === 'daily' ? 'Daily' : medType === 'variable' ? 'Variable' : 'PRN'}
                              </span>
                            </div>
                            <button
                              className="overview-edit-btn"
                              onClick={() => handleViewHistory(med)}
                            >
                              View
                            </button>
                          </div>

                          {/* Weekly Schedule Grid */}
                          <div className="weekly-grid">
                            <div className="grid-header">
                              {DAY_LABELS.map((day, idx) => (
                                <div
                                  key={day}
                                  className={`grid-day-header ${idx === getTodayDayIndex() ? 'today' : ''}`}
                                >
                                  {day}
                                </div>
                              ))}
                            </div>
                            <div className="grid-body">
                              {/* Find max rows needed (max schedules for any day) */}
                              {(() => {
                                const maxRows = Math.max(
                                  1,
                                  ...DAYS_OF_WEEK.map((_, idx) => getScheduleForDay(med, idx).length)
                                )
                                return Array.from({ length: maxRows }).map((_, rowIdx) => (
                                  <div key={rowIdx} className="grid-row">
                                    {DAYS_OF_WEEK.map((_, dayIdx) => {
                                      const schedules = getScheduleForDay(med, dayIdx)
                                      const schedule = schedules[rowIdx]
                                      const isToday = dayIdx === getTodayDayIndex()
                                      return (
                                        <div
                                          key={dayIdx}
                                          className={`grid-cell ${isToday ? 'today' : ''} ${schedule ? 'has-dose' : 'no-dose'}`}
                                        >
                                          {schedule ? (
                                            <>
                                              <span className="cell-dose">
                                                {schedule.dose > 1 ? `${schedule.dose}x ` : ''}{formatDosage(med)}
                                              </span>
                                              <span className="cell-time">{formatTime(schedule.time)}</span>
                                            </>
                                          ) : (
                                            <span className="cell-empty">-</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ))
                              })()}
                            </div>
                          </div>

                          {med.instructions && (
                            <div className="overview-instructions">
                              {med.instructions}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* PRN Medications Section */}
                    {getPrnMedications().length > 0 && (
                      <div className="overview-prn-section">
                        <h4>As Needed (PRN)</h4>
                        {getPrnMedications().map(med => (
                          <div key={med.id} className="overview-prn-item clickable" onClick={() => handleViewHistory(med)}>
                            <div className="prn-item-info">
                              <span className="prn-item-name">{med.name}</span>
                              <span className="prn-item-dosage">{formatDosage(med)}</span>
                              {med.prn_max_daily && (
                                <span className="prn-item-max">max {med.prn_max_daily}/day</span>
                              )}
                            </div>
                            {med.instructions && (
                              <div className="prn-item-instructions">{med.instructions}</div>
                            )}
                            <button
                              className="overview-edit-btn prn-view-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewHistory(med)
                              }}
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Daily Summary Footer */}
                    <div className="overview-daily-summary">
                      <h4>Today ({DAY_LABELS[getTodayDayIndex()]}): {getTotalDailyDoses()} doses</h4>
                      <div className="summary-list compact">
                        {getDailySummary().map((item, idx) => (
                          <div key={idx} className="summary-item">
                            <span className="summary-time">{formatTime(item.time)}</span>
                            <span className="summary-med">{item.name} {formatDosage(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {detailsView === 'all' && (
                  <div className="all-meds-view">
                    {allMedications.map(med => (
                      <div key={med.id} className="all-med-item" onClick={() => handleViewHistory(med)}>
                        <div className="all-med-info">
                          <div className="all-med-name">{med.name}</div>
                          <div className="all-med-dosage">{formatDosage(med)}</div>
                          {med.is_prn && <span className="prn-badge">PRN</span>}
                        </div>
                        <span className="view-history-arrow">arrow</span>
                      </div>
                    ))}
                  </div>
                )}

                {detailsView === 'adherence' && adherenceStats && (
                  <div className="adherence-view">
                    <div className="adherence-summary">
                      <div className="adherence-rate">
                        <span className="rate-value">{adherenceStats.summary.adherence_rate}%</span>
                        <span className="rate-label">7-Day Adherence</span>
                      </div>
                      <div className="adherence-breakdown">
                        <div className="breakdown-item">
                          <span className="breakdown-count">{adherenceStats.summary.taken}</span>
                          <span className="breakdown-label">Taken</span>
                        </div>
                        <div className="breakdown-item">
                          <span className="breakdown-count">{adherenceStats.summary.skipped}</span>
                          <span className="breakdown-label">Skipped</span>
                        </div>
                        <div className="breakdown-item">
                          <span className="breakdown-count">{adherenceStats.summary.late}</span>
                          <span className="breakdown-label">Late</span>
                        </div>
                      </div>
                    </div>

                    <div className="adherence-by-day">
                      <h4>Daily Breakdown</h4>
                      {adherenceStats.by_day.map(day => (
                        <div key={day.date} className="day-adherence">
                          <span className="day-date">
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <div className="day-bar">
                            <div
                              className="day-fill"
                              style={{ width: `${day.adherence_rate}%` }}
                            ></div>
                          </div>
                          <span className="day-rate">{day.adherence_rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Medication History Modal */}
        {showHistoryModal && selectedMedication && (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
            <div className="medication-modal history-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedMedication.name} History</h2>
                <button className="close-button" onClick={() => setShowHistoryModal(false)}>X</button>
              </div>

              <div className="modal-content">
                <div className="medication-details">
                  <p><strong>Dosage:</strong> {formatDosage(selectedMedication)}</p>
                  {selectedMedication.instructions && (
                    <p><strong>Instructions:</strong> {selectedMedication.instructions}</p>
                  )}
                </div>

                <div className="history-list">
                  <h4>Recent Activity (30 days)</h4>
                  {medicationHistory.length === 0 ? (
                    <p className="empty-history">No history available</p>
                  ) : (
                    medicationHistory.map((entry, index) => (
                      <div key={index} className={`history-entry ${entry.status}`}>
                        <div className="history-date">
                          {new Date(entry.scheduled_date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric'
                          })}
                          {entry.scheduled_time && ` at ${formatTime(entry.scheduled_time)}`}
                        </div>
                        <div className={`history-status ${entry.status}`}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    className="btn-edit"
                    onClick={() => {
                      setShowHistoryModal(false)
                      handleOpenEditor(selectedMedication)
                    }}
                  >
                    Edit Schedule
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => {
                      if (confirm('Are you sure you want to deactivate this medication?')) {
                        handleDeleteMedication(selectedMedication.id)
                      }
                    }}
                  >
                    Deactivate Medication
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Variable Dosage Editor Modal (Mobile) */}
        {showEditorModal && selectedMedication && (
          <div className="modal-overlay" onClick={() => setShowEditorModal(false)}>
            <div className="medication-modal editor-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Schedule: {selectedMedication.name}</h3>
                <button className="close-btn" onClick={() => setShowEditorModal(false)}>X</button>
              </div>

              <div className="modal-body">
                {/* Time Slots */}
                <div className="editor-time-slots">
                  {editorSchedules.map((slot, slotIndex) => (
                    <div key={slotIndex} className="editor-time-slot">
                      <div className="time-slot-header">
                        <div className="time-input-group">
                          <label>Time</label>
                          <input
                            type="time"
                            value={slot.time}
                            onChange={(e) => handleTimeChange(slotIndex, e.target.value)}
                          />
                        </div>
                        {editorSchedules.length > 1 && (
                          <button
                            className="remove-time-btn"
                            onClick={() => handleRemoveTimeSlot(slotIndex)}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Quick Set Buttons */}
                      <div className="quick-set-buttons">
                        <button onClick={() => handleQuickSet(slotIndex, 'all')}>All Days</button>
                        <button onClick={() => handleQuickSet(slotIndex, 'weekdays')}>Weekdays</button>
                        <button onClick={() => handleQuickSet(slotIndex, 'weekends')}>Weekends</button>
                        <button onClick={() => handleQuickSet(slotIndex, 'clear')}>Clear</button>
                      </div>

                      {/* Dose Grid */}
                      <div className="dose-grid">
                        <div className="dose-grid-header">
                          {DAY_LABELS.map((day, idx) => (
                            <div key={day} className={`dose-grid-day ${idx === getTodayDayIndex() ? 'today' : ''}`}>
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="dose-grid-inputs">
                          {DAYS_OF_WEEK.map((day, idx) => (
                            <div key={day} className={`dose-input-cell ${idx === getTodayDayIndex() ? 'today' : ''}`}>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={slot.doses[day] || 0}
                                onChange={(e) => handleDoseChange(slotIndex, day, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button className="add-time-btn" onClick={handleAddTimeSlot}>
                    + Add Time Slot
                  </button>
                </div>

                {/* Weekly Preview */}
                <div className="editor-preview">
                  <h4>Weekly Preview</h4>
                  <div className="preview-grid">
                    <div className="preview-header">
                      {DAY_LABELS.map((day, idx) => (
                        <div key={day} className={`preview-day-header ${idx === getTodayDayIndex() ? 'today' : ''}`}>
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="preview-body">
                      {editorSchedules.map((slot, slotIndex) => (
                        <div key={slotIndex} className="preview-row">
                          {DAYS_OF_WEEK.map((day, idx) => {
                            const dose = slot.doses[day] || 0
                            return (
                              <div
                                key={day}
                                className={`preview-cell ${idx === getTodayDayIndex() ? 'today' : ''} ${dose > 0 ? 'has-dose' : ''}`}
                              >
                                {dose > 0 ? (
                                  <>
                                    <span className="preview-dose">{dose}x</span>
                                    <span className="preview-time">{formatTime(slot.time)}</span>
                                  </>
                                ) : '-'}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="weekly-total">
                    Weekly Total: <strong>{calculateWeeklyTotal()} doses</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowEditorModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-save"
                  onClick={handleSaveEditor}
                  disabled={editorSaving}
                >
                  {editorSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Desktop full layout
  return (
    <div className="medication-card">
      <div className="card-header">
        <h2 className="card-title">Medication</h2>
        <div className="completion-stats">
          <span className="completion-text">{stats.taken}/{stats.total} taken</span>
          <span className="completion-percentage">{stats.percentage}%</span>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${stats.percentage}%`,
              backgroundColor: stats.percentage === 100 ? '#4CAF50' : '#4a9eff'
            }}
          ></div>
        </div>
      </div>

      <div className="medications-list">
        {scheduledMeds.map((med) => (
          <div
            key={med.id}
            className={`medication-item ${med.taken ? 'completed' : ''} ${med.late ? 'overdue' : ''}`}
          >
            <div className="med-info">
              <span className="med-icon">{getMedIcon(med.type)}</span>
              <div className="med-details">
                <span className="med-name">{med.name}</span>
                <span className="med-time">{formatTime(med.time)}</span>
                {med.dosage && <span className="med-dosage">{formatDosage(med)}</span>}
              </div>
            </div>
            <button
              className={`med-button ${med.taken ? 'taken' : 'pending'}`}
              onClick={() => !med.taken && handleTakeMedication(med)}
              disabled={med.taken}
            >
              {med.taken ? <span className="check-icon">✓</span> : <span className="circle-icon">○</span>}
            </button>
          </div>
        ))}
      </div>

      {/* PRN Section for Desktop */}
      {prnMeds.length > 0 && (
        <div className="prn-section">
          <h3 className="prn-title">As Needed</h3>
          {prnMeds.map((med) => (
            <div key={med.id} className="prn-item">
              <div className="prn-info">
                <span className="prn-name">{med.name}</span>
                <span className="prn-dosage">{formatDosage(med)}</span>
                {med.prnMaxDaily && (
                  <span className="prn-limit">{med.dosesTakenToday}/{med.prnMaxDaily} today</span>
                )}
              </div>
              <button
                className={`prn-button ${!med.canTakeMore ? 'disabled' : ''}`}
                onClick={() => handleTakePrn(med)}
                disabled={!med.canTakeMore}
              >
                Take
              </button>
            </div>
          ))}
        </div>
      )}

      {stats.taken === stats.total && stats.total > 0 && (
        <div className="completion-message">All medications taken today!</div>
      )}

      <div className="medication-actions">
        <button className="action-button primary" onClick={() => setShowAddModal(true)}>
          <span className="button-icon">+</span>
          Add Medication
        </button>
        <button className="action-button secondary" onClick={() => setShowDetailsModal(true)}>
          View Details
        </button>
      </div>

      {/* Add Medication Modal - Desktop */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="medication-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Medication</h2>
              <button className="close-button" onClick={() => setShowAddModal(false)}>X</button>
            </div>

            {addStep === 'basic' && (
              <div className="modal-step">
                <div className="form-group">
                  <label>Medication Name *</label>
                  <input
                    type="text"
                    value={newMed.name}
                    onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                    placeholder="e.g., Lisinopril"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Dosage</label>
                    <input
                      type="text"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <select
                      value={newMed.dosage_unit}
                      onChange={(e) => setNewMed({ ...newMed, dosage_unit: e.target.value })}
                    >
                      <option value="mg">mg</option>
                      <option value="mcg">mcg</option>
                      <option value="ml">ml</option>
                      <option value="tablet">tablet</option>
                      <option value="capsule">capsule</option>
                      <option value="drops">drops</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Instructions</label>
                  <input
                    type="text"
                    value={newMed.instructions}
                    onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                    placeholder="e.g., Take with food"
                  />
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={newMed.is_prn}
                      onChange={(e) => setNewMed({ ...newMed, is_prn: e.target.checked })}
                    />
                    As needed (PRN)
                  </label>
                </div>

                {newMed.is_prn && (
                  <div className="form-group">
                    <label>Max doses per day</label>
                    <input
                      type="number"
                      min="1"
                      value={newMed.prn_max_daily || ''}
                      onChange={(e) => setNewMed({ ...newMed, prn_max_daily: parseInt(e.target.value) || null })}
                      placeholder="e.g., 4"
                    />
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => setAddStep(newMed.is_prn ? 'review' : 'schedule')}
                    disabled={!newMed.name}
                  >
                    {newMed.is_prn ? 'Review' : 'Next: Schedule'}
                  </button>
                </div>
              </div>
            )}

            {addStep === 'schedule' && (
              <div className="modal-step">
                <h3>Set Schedule</h3>

                {newSchedules.map((schedule, index) => (
                  <div key={index} className="schedule-entry">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Time</label>
                        <input
                          type="time"
                          value={schedule.schedule_time}
                          onChange={(e) => {
                            const updated = [...newSchedules]
                            updated[index].schedule_time = e.target.value
                            setNewSchedules(updated)
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Amount</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={schedule.dosage_amount}
                          onChange={(e) => {
                            const updated = [...newSchedules]
                            updated[index].dosage_amount = e.target.value
                            setNewSchedules(updated)
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Frequency</label>
                      <select
                        value={schedule.frequency_type}
                        onChange={(e) => {
                          const updated = [...newSchedules]
                          updated[index].frequency_type = e.target.value
                          setNewSchedules(updated)
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="specific_days">Specific Days</option>
                        <option value="interval">Every X Days</option>
                      </select>
                    </div>

                    {schedule.frequency_type === 'specific_days' && (
                      <div className="form-group">
                        <label>Days</label>
                        <div className="day-checkboxes">
                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                            <label key={day} className="day-checkbox">
                              <input
                                type="checkbox"
                                checked={(schedule.days_of_week || '').includes(day)}
                                onChange={(e) => {
                                  const updated = [...newSchedules]
                                  const days = (updated[index].days_of_week || '').split(',').filter(d => d)
                                  if (e.target.checked) {
                                    days.push(day)
                                  } else {
                                    const idx = days.indexOf(day)
                                    if (idx > -1) days.splice(idx, 1)
                                  }
                                  updated[index].days_of_week = days.join(',')
                                  setNewSchedules(updated)
                                }}
                              />
                              {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {schedule.frequency_type === 'interval' && (
                      <div className="form-group">
                        <label>Every X days</label>
                        <input
                          type="number"
                          min="2"
                          value={schedule.interval_days || ''}
                          onChange={(e) => {
                            const updated = [...newSchedules]
                            updated[index].interval_days = parseInt(e.target.value)
                            setNewSchedules(updated)
                          }}
                          placeholder="e.g., 2 for every other day"
                        />
                      </div>
                    )}

                    {newSchedules.length > 1 && (
                      <button
                        className="remove-schedule-btn"
                        onClick={() => setNewSchedules(newSchedules.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}

                <button
                  className="add-schedule-btn"
                  onClick={() => setNewSchedules([...newSchedules, {
                    schedule_time: '12:00', dosage_amount: 1, frequency_type: 'daily', days_of_week: '', interval_days: null
                  }])}
                >
                  + Add Another Time
                </button>

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setAddStep('basic')}>
                    Back
                  </button>
                  <button className="btn-primary" onClick={() => setAddStep('review')}>
                    Review
                  </button>
                </div>
              </div>
            )}

            {addStep === 'review' && (
              <div className="modal-step">
                <h3>Review Medication</h3>

                <div className="review-summary">
                  <div className="review-item">
                    <span className="review-label">Name:</span>
                    <span className="review-value">{newMed.name}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Dosage:</span>
                    <span className="review-value">{newMed.dosage} {newMed.dosage_unit}</span>
                  </div>
                  {newMed.instructions && (
                    <div className="review-item">
                      <span className="review-label">Instructions:</span>
                      <span className="review-value">{newMed.instructions}</span>
                    </div>
                  )}
                  {newMed.is_prn ? (
                    <div className="review-item">
                      <span className="review-label">Type:</span>
                      <span className="review-value">
                        As needed (PRN){newMed.prn_max_daily ? `, max ${newMed.prn_max_daily}/day` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="review-item">
                      <span className="review-label">Schedule:</span>
                      <span className="review-value">
                        {newSchedules.map((s, i) => (
                          <div key={i}>
                            {formatTime(s.schedule_time)} - {s.dosage_amount} dose(s)
                            {s.frequency_type !== 'daily' && ` (${medicationsApi.getFrequencyLabel(s.frequency_type, s.days_of_week, s.interval_days)})`}
                          </div>
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setAddStep(newMed.is_prn ? 'basic' : 'schedule')}>
                    Back
                  </button>
                  <button className="btn-primary" onClick={handleAddMedication}>
                    Add Medication
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details/Stats Modal - Desktop */}
      {showDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="medication-modal details-modal overview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Medication Details</h2>
              <button className="close-button" onClick={() => setShowDetailsModal(false)}>X</button>
            </div>

            <div className="modal-nav">
              <button
                className={`nav-button ${detailsView === 'today' ? 'active' : ''}`}
                onClick={() => setDetailsView('today')}
              >
                Today
              </button>
              <button
                className={`nav-button ${detailsView === 'overview' ? 'active' : ''}`}
                onClick={() => setDetailsView('overview')}
              >
                Overview
              </button>
              <button
                className={`nav-button ${detailsView === 'adherence' ? 'active' : ''}`}
                onClick={() => setDetailsView('adherence')}
              >
                Adherence
              </button>
            </div>

            <div className="modal-content">
              {detailsView === 'today' && (
                <div className="today-view">
                  <div className="stats-summary">
                    <div className="stat-item">
                      <span className="stat-value">{stats.taken}</span>
                      <span className="stat-label">Taken</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{stats.pending}</span>
                      <span className="stat-label">Pending</span>
                    </div>
                    <div className="stat-item late">
                      <span className="stat-value">{stats.late}</span>
                      <span className="stat-label">Late</span>
                    </div>
                  </div>

                  {/* Daily Summary for Today */}
                  <div className="daily-summary">
                    <h4>Today's Schedule ({DAY_LABELS[getTodayDayIndex()]})</h4>
                    <div className="summary-stat">{getTotalDailyDoses()} doses scheduled</div>
                    <div className="summary-list">
                      {getDailySummary().map((item, idx) => (
                        <div key={idx} className="summary-item">
                          <span className="summary-time">{formatTime(item.time)}</span>
                          <span className="summary-med">{item.name}</span>
                          <span className="summary-dose">{formatDosage(item)}</span>
                        </div>
                      ))}
                      {getPrnMedications().length > 0 && (
                        <div className="summary-prn">
                          + {getPrnMedications().length} PRN medication(s) available as needed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailsView === 'overview' && (
                <div className="overview-view">
                  {allMedications.filter(med => !med.is_prn).map(med => {
                    const medType = getMedicationType(med)
                    return (
                      <div key={med.id} className={`overview-medication ${medType}`}>
                        <div className="overview-med-header">
                          <div className="overview-med-info">
                            <span className="overview-med-name">{med.name}</span>
                            <span className={`med-type-badge ${medType}`}>
                              {medType === 'daily' ? 'Daily' : medType === 'variable' ? 'Variable' : 'PRN'}
                            </span>
                          </div>
                          <button
                            className="overview-edit-btn"
                            onClick={() => handleViewHistory(med)}
                          >
                            View
                          </button>
                        </div>

                        {/* Weekly Schedule Grid */}
                        <div className="weekly-grid">
                          <div className="grid-header">
                            {DAY_LABELS.map((day, idx) => (
                              <div
                                key={day}
                                className={`grid-day-header ${idx === getTodayDayIndex() ? 'today' : ''}`}
                              >
                                {day}
                              </div>
                            ))}
                          </div>
                          <div className="grid-body">
                            {(() => {
                              const maxRows = Math.max(
                                1,
                                ...DAYS_OF_WEEK.map((_, idx) => getScheduleForDay(med, idx).length)
                              )
                              return Array.from({ length: maxRows }).map((_, rowIdx) => (
                                <div key={rowIdx} className="grid-row">
                                  {DAYS_OF_WEEK.map((_, dayIdx) => {
                                    const schedules = getScheduleForDay(med, dayIdx)
                                    const schedule = schedules[rowIdx]
                                    const isToday = dayIdx === getTodayDayIndex()
                                    return (
                                      <div
                                        key={dayIdx}
                                        className={`grid-cell ${isToday ? 'today' : ''} ${schedule ? 'has-dose' : 'no-dose'}`}
                                      >
                                        {schedule ? (
                                          <>
                                            <span className="cell-dose">
                                              {schedule.dose > 1 ? `${schedule.dose}x ` : ''}{formatDosage(med)}
                                            </span>
                                            <span className="cell-time">{formatTime(schedule.time)}</span>
                                          </>
                                        ) : (
                                          <span className="cell-empty">-</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ))
                            })()}
                          </div>
                        </div>

                        {med.instructions && (
                          <div className="overview-instructions">
                            {med.instructions}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* PRN Medications Section */}
                  {getPrnMedications().length > 0 && (
                    <div className="overview-prn-section">
                      <h4>As Needed (PRN)</h4>
                      {getPrnMedications().map(med => (
                        <div key={med.id} className="overview-prn-item clickable" onClick={() => handleViewHistory(med)}>
                          <div className="prn-item-info">
                            <span className="prn-item-name">{med.name}</span>
                            <span className="prn-item-dosage">{formatDosage(med)}</span>
                            {med.prn_max_daily && (
                              <span className="prn-item-max">max {med.prn_max_daily}/day</span>
                            )}
                          </div>
                          {med.instructions && (
                            <div className="prn-item-instructions">{med.instructions}</div>
                          )}
                          <button
                            className="overview-edit-btn prn-view-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewHistory(med)
                            }}
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Daily Summary Footer */}
                  <div className="overview-daily-summary">
                    <h4>Today ({DAY_LABELS[getTodayDayIndex()]}): {getTotalDailyDoses()} doses</h4>
                    <div className="summary-list compact">
                      {getDailySummary().map((item, idx) => (
                        <div key={idx} className="summary-item">
                          <span className="summary-time">{formatTime(item.time)}</span>
                          <span className="summary-med">{item.name} {formatDosage(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {detailsView === 'adherence' && adherenceStats && (
                <div className="adherence-view">
                  <div className="adherence-summary">
                    <div className="adherence-rate">
                      <span className="rate-value">{adherenceStats.summary.adherence_rate}%</span>
                      <span className="rate-label">7-Day Adherence</span>
                    </div>
                    <div className="adherence-breakdown">
                      <div className="breakdown-item">
                        <span className="breakdown-count">{adherenceStats.summary.taken}</span>
                        <span className="breakdown-label">Taken</span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-count">{adherenceStats.summary.skipped}</span>
                        <span className="breakdown-label">Skipped</span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-count">{adherenceStats.summary.late}</span>
                        <span className="breakdown-label">Late</span>
                      </div>
                    </div>
                  </div>

                  <div className="adherence-by-day">
                    <h4>Daily Breakdown</h4>
                    {adherenceStats.by_day.map(day => (
                      <div key={day.date} className="day-adherence">
                        <span className="day-date">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <div className="day-bar">
                          <div
                            className="day-fill"
                            style={{ width: `${day.adherence_rate}%` }}
                          ></div>
                        </div>
                        <span className="day-rate">{day.adherence_rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Medication History Modal - Desktop */}
      {showHistoryModal && selectedMedication && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="medication-modal history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedMedication.name} History</h2>
              <button className="close-button" onClick={() => setShowHistoryModal(false)}>X</button>
            </div>

            <div className="modal-content">
              <div className="medication-details">
                <p><strong>Dosage:</strong> {formatDosage(selectedMedication)}</p>
                {selectedMedication.instructions && (
                  <p><strong>Instructions:</strong> {selectedMedication.instructions}</p>
                )}
              </div>

              <div className="history-list">
                <h4>Recent Activity (30 days)</h4>
                {medicationHistory.length === 0 ? (
                  <p className="empty-history">No history available</p>
                ) : (
                  medicationHistory.map((entry, index) => (
                    <div key={index} className={`history-entry ${entry.status}`}>
                      <div className="history-date">
                        {new Date(entry.scheduled_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric'
                        })}
                        {entry.scheduled_time && ` at ${formatTime(entry.scheduled_time)}`}
                      </div>
                      <div className={`history-status ${entry.status}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="modal-actions">
                <button
                  className="btn-edit"
                  onClick={() => {
                    setShowHistoryModal(false)
                    handleOpenEditor(selectedMedication)
                  }}
                >
                  Edit Schedule
                </button>
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (confirm('Are you sure you want to deactivate this medication?')) {
                      handleDeleteMedication(selectedMedication.id)
                    }
                  }}
                >
                  Deactivate Medication
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variable Dosage Editor Modal (Desktop) */}
      {showEditorModal && selectedMedication && (
        <div className="modal-overlay" onClick={() => setShowEditorModal(false)}>
          <div className="medication-modal editor-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Schedule: {selectedMedication.name}</h2>
              <button className="close-button" onClick={() => setShowEditorModal(false)}>X</button>
            </div>

            <div className="modal-content">
              {/* Time Slots */}
              <div className="editor-time-slots">
                {editorSchedules.map((slot, slotIndex) => (
                  <div key={slotIndex} className="editor-time-slot">
                    <div className="time-slot-header">
                      <div className="time-input-group">
                        <label>Time</label>
                        <input
                          type="time"
                          value={slot.time}
                          onChange={(e) => handleTimeChange(slotIndex, e.target.value)}
                        />
                      </div>
                      {editorSchedules.length > 1 && (
                        <button
                          className="remove-time-btn"
                          onClick={() => handleRemoveTimeSlot(slotIndex)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Quick Set Buttons */}
                    <div className="quick-set-buttons">
                      <button onClick={() => handleQuickSet(slotIndex, 'all')}>All Days</button>
                      <button onClick={() => handleQuickSet(slotIndex, 'weekdays')}>Weekdays</button>
                      <button onClick={() => handleQuickSet(slotIndex, 'weekends')}>Weekends</button>
                      <button onClick={() => handleQuickSet(slotIndex, 'clear')}>Clear</button>
                    </div>

                    {/* Dose Grid */}
                    <div className="dose-grid">
                      <div className="dose-grid-header">
                        {DAY_LABELS.map((day, idx) => (
                          <div key={day} className={`dose-grid-day ${idx === getTodayDayIndex() ? 'today' : ''}`}>
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="dose-grid-inputs">
                        {DAYS_OF_WEEK.map((day, idx) => (
                          <div key={day} className={`dose-input-cell ${idx === getTodayDayIndex() ? 'today' : ''}`}>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={slot.doses[day] || 0}
                              onChange={(e) => handleDoseChange(slotIndex, day, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button className="add-time-btn" onClick={handleAddTimeSlot}>
                  + Add Time Slot
                </button>
              </div>

              {/* Weekly Preview */}
              <div className="editor-preview">
                <h4>Weekly Preview</h4>
                <div className="preview-grid">
                  <div className="preview-header">
                    {DAY_LABELS.map((day, idx) => (
                      <div key={day} className={`preview-day-header ${idx === getTodayDayIndex() ? 'today' : ''}`}>
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="preview-body">
                    {editorSchedules.map((slot, slotIndex) => (
                      <div key={slotIndex} className="preview-row">
                        {DAYS_OF_WEEK.map((day, idx) => {
                          const dose = slot.doses[day] || 0
                          return (
                            <div
                              key={day}
                              className={`preview-cell ${idx === getTodayDayIndex() ? 'today' : ''} ${dose > 0 ? 'has-dose' : ''}`}
                            >
                              {dose > 0 ? (
                                <>
                                  <span className="preview-dose">{dose}x</span>
                                  <span className="preview-time">{formatTime(slot.time)}</span>
                                </>
                              ) : '-'}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="weekly-total">
                  Weekly Total: <strong>{calculateWeeklyTotal()} doses</strong>
                </div>
              </div>

              <div className="modal-actions editor-actions">
                <button className="btn-cancel" onClick={() => setShowEditorModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-save"
                  onClick={handleSaveEditor}
                  disabled={editorSaving}
                >
                  {editorSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Medication
