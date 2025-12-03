import React, { useState } from 'react'
import { getAppointmentTypeOptions, REMINDER_OPTIONS } from '../constants/appointmentTypes'
import {
  getRecurrenceTypeOptions,
  DAYS_OF_WEEK,
  RECURRENCE_END_TYPES,
  parseRecurrenceRule,
  createRecurrenceRule,
  validateRecurrenceRule
} from '../constants/recurrenceTypes'
import './AddAppointmentModal.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Add/Edit Appointment Modal
 * Form for creating or editing appointments
 */
function AddAppointmentModal({ appointment = null, onClose, onSuccess }) {
  const isEdit = Boolean(appointment)

  // Parse existing recurrence rule if editing
  const existingRule = appointment?.recurrence_rule ? parseRecurrenceRule(appointment.recurrence_rule) : null

  // Form state
  const [formData, setFormData] = useState({
    title: appointment?.title || '',
    description: appointment?.description || '',
    location: appointment?.location || '',
    appointment_type: appointment?.appointment_type || 'personal',
    provider_name: appointment?.provider_name || '',
    provider_phone: appointment?.provider_phone || '',
    starts_at: appointment?.starts_at ? formatDateTimeLocal(appointment.starts_at) : '',
    ends_at: appointment?.ends_at ? formatDateTimeLocal(appointment.ends_at) : '',
    all_day: appointment?.all_day || false,
    reminder_min: appointment?.reminder_min || 60,
    notes: appointment?.notes || ''
  })

  // Recurrence state
  const [recurrence, setRecurrence] = useState({
    frequency: existingRule?.frequency || 'none',
    interval: existingRule?.interval || 1,
    daysOfWeek: existingRule?.daysOfWeek || [],
    endType: existingRule?.endType || RECURRENCE_END_TYPES.NEVER,
    endDate: existingRule?.endDate || '',
    count: existingRule?.count || 10
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Format datetime for input[type="datetime-local"]
  function formatDateTimeLocal(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleRecurrenceChange = (field, value) => {
    setRecurrence(prev => {
      const updated = {
        ...prev,
        [field]: value
      }

      // Auto-select the day of week when switching to weekly frequency
      if (field === 'frequency' && value === 'weekly') {
        const startDate = formData.starts_at ? new Date(formData.starts_at) : new Date()
        const dayOfWeek = startDate.getDay()

        // Only auto-select if no days are currently selected
        if (prev.daysOfWeek.length === 0) {
          updated.daysOfWeek = [dayOfWeek]
        }
      }

      // Clear days of week when switching away from weekly
      if (field === 'frequency' && value !== 'weekly') {
        updated.daysOfWeek = []
      }

      return updated
    })
  }

  const toggleDayOfWeek = (day) => {
    setRecurrence(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.title.trim()) {
      setError('Appointment title is required')
      return
    }

    if (!formData.starts_at) {
      setError('Start time is required')
      return
    }

    // Validate recurrence if enabled
    if (recurrence.frequency !== 'none') {
      const validation = validateRecurrenceRule(recurrence)
      if (!validation.valid) {
        setError(validation.error)
        return
      }
    }

    try {
      setLoading(true)

      const url = isEdit
        ? `${API_URL}/api/appointments/${appointment.id}`
        : `${API_URL}/api/appointments`

      const method = isEdit ? 'PUT' : 'POST'

      // Prepare payload
      const payload = {
        ...formData,
        reminder_min: parseInt(formData.reminder_min),
        all_day: formData.all_day ? 1 : 0,
        is_recurring: recurrence.frequency !== 'none' ? 1 : 0,
        recurrence_rule: recurrence.frequency !== 'none'
          ? createRecurrenceRule(recurrence)
          : null
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save appointment')
      }

      // Success!
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving appointment:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const appointmentTypes = getAppointmentTypeOptions()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="appointment-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="modal-header">
          <h2>{isEdit ? 'Edit Appointment' : 'Add Appointment'}</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {/* Form */}
        <form className="modal-content" onSubmit={handleSubmit}>
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Dr. Smith - Annual Checkup"
              required
            />
          </div>

          {/* Type */}
          <div className="form-group">
            <label htmlFor="appointment_type">Type</label>
            <select
              id="appointment_type"
              name="appointment_type"
              value={formData.appointment_type}
              onChange={handleChange}
            >
              {appointmentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="starts_at">Start Date & Time *</label>
              <input
                type="datetime-local"
                id="starts_at"
                name="starts_at"
                value={formData.starts_at}
                onChange={handleChange}
                required
                disabled={formData.all_day}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ends_at">End Date & Time</label>
              <input
                type="datetime-local"
                id="ends_at"
                name="ends_at"
                value={formData.ends_at}
                onChange={handleChange}
                disabled={formData.all_day}
              />
            </div>
          </div>

          {/* All Day Checkbox */}
          <div className="form-group checkbox">
            <label htmlFor="all_day">
              <input
                type="checkbox"
                id="all_day"
                name="all_day"
                checked={formData.all_day}
                onChange={handleChange}
              />
              All-day event
            </label>
          </div>

          {/* Location */}
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., 123 Medical Center Drive"
            />
          </div>

          {/* Provider Section */}
          <div className="provider-section">
            <h3>Provider Details</h3>
            <p className="section-hint">(for medical appointments)</p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="provider_name">Provider Name</label>
                <input
                  type="text"
                  id="provider_name"
                  name="provider_name"
                  value={formData.provider_name}
                  onChange={handleChange}
                  placeholder="e.g., Dr. Sarah Smith"
                />
              </div>

              <div className="form-group">
                <label htmlFor="provider_phone">Provider Phone</label>
                <input
                  type="tel"
                  id="provider_phone"
                  name="provider_phone"
                  value={formData.provider_phone}
                  onChange={handleChange}
                  placeholder="e.g., (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Reminder */}
          <div className="form-group">
            <label htmlFor="reminder_min">Reminder</label>
            <select
              id="reminder_min"
              name="reminder_min"
              value={formData.reminder_min}
              onChange={handleChange}
            >
              {REMINDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence Section */}
          <div className="provider-section">
            <h3>Repeat</h3>
            <p className="section-hint">(set recurring appointments)</p>

            <div className="form-group">
              <label htmlFor="recurrence_frequency">Frequency</label>
              <select
                id="recurrence_frequency"
                value={recurrence.frequency}
                onChange={(e) => handleRecurrenceChange('frequency', e.target.value)}
              >
                {getRecurrenceTypeOptions().map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {recurrence.frequency !== 'none' && recurrence.frequency !== 'custom' && (
              <>
                {/* Interval */}
                <div className="form-group">
                  <label htmlFor="recurrence_interval">
                    Repeat every {recurrence.interval} {recurrence.frequency === 'daily' ? 'day(s)' :
                      recurrence.frequency === 'weekly' ? 'week(s)' :
                      recurrence.frequency === 'monthly' ? 'month(s)' : 'year(s)'}
                  </label>
                  <input
                    type="number"
                    id="recurrence_interval"
                    min="1"
                    max="365"
                    value={recurrence.interval}
                    onChange={(e) => handleRecurrenceChange('interval', parseInt(e.target.value))}
                  />
                </div>

                {/* Days of week (for weekly recurrence) */}
                {recurrence.frequency === 'weekly' && (
                  <div className="form-group">
                    <label>Repeat on (select one or more days)</label>
                    <div className="days-of-week">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          className={`day-button ${recurrence.daysOfWeek.includes(day.value) ? 'selected' : ''}`}
                          onClick={() => toggleDayOfWeek(day.value)}
                        >
                          {day.short}
                        </button>
                      ))}
                    </div>
                    {recurrence.daysOfWeek.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#ff6b6b', marginTop: '8px', marginBottom: 0 }}>
                        Please select at least one day
                      </p>
                    )}
                  </div>
                )}

                {/* End Type */}
                <div className="form-group">
                  <label>Ends</label>
                  <div className="recurrence-end-options">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="end_type"
                        value={RECURRENCE_END_TYPES.NEVER}
                        checked={recurrence.endType === RECURRENCE_END_TYPES.NEVER}
                        onChange={(e) => handleRecurrenceChange('endType', e.target.value)}
                      />
                      Never
                    </label>

                    <label className="radio-label">
                      <input
                        type="radio"
                        name="end_type"
                        value={RECURRENCE_END_TYPES.ON_DATE}
                        checked={recurrence.endType === RECURRENCE_END_TYPES.ON_DATE}
                        onChange={(e) => handleRecurrenceChange('endType', e.target.value)}
                      />
                      On date
                    </label>

                    <label className="radio-label">
                      <input
                        type="radio"
                        name="end_type"
                        value={RECURRENCE_END_TYPES.AFTER_COUNT}
                        checked={recurrence.endType === RECURRENCE_END_TYPES.AFTER_COUNT}
                        onChange={(e) => handleRecurrenceChange('endType', e.target.value)}
                      />
                      After
                    </label>
                  </div>
                </div>

                {/* End Date */}
                {recurrence.endType === RECURRENCE_END_TYPES.ON_DATE && (
                  <div className="form-group">
                    <label htmlFor="recurrence_end_date">End Date</label>
                    <input
                      type="date"
                      id="recurrence_end_date"
                      value={recurrence.endDate}
                      onChange={(e) => handleRecurrenceChange('endDate', e.target.value)}
                      min={formData.starts_at?.split('T')[0]}
                    />
                  </div>
                )}

                {/* Count */}
                {recurrence.endType === RECURRENCE_END_TYPES.AFTER_COUNT && (
                  <div className="form-group">
                    <label htmlFor="recurrence_count">Number of occurrences</label>
                    <input
                      type="number"
                      id="recurrence_count"
                      min="1"
                      max="365"
                      value={recurrence.count}
                      onChange={(e) => handleRecurrenceChange('count', parseInt(e.target.value))}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of the appointment"
              rows="2"
            />
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes"
              rows="2"
            />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddAppointmentModal
