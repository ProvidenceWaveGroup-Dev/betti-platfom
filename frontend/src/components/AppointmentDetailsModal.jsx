import React, { useState } from 'react'
import { getAppointmentType, getStatusInfo } from '../constants/appointmentTypes'
import { formatRecurrenceRule } from '../constants/recurrenceTypes'
import './AppointmentDetailsModal.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Appointment Details Modal
 * Full details view with edit, delete, and status actions
 */
function AppointmentDetailsModal({ appointment, onClose, onEdit, onDelete }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const typeInfo = getAppointmentType(appointment.appointment_type)
  const statusInfo = getStatusInfo(appointment.status)

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this appointment?')) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_URL}/api/appointments/${appointment.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete appointment')
      }

      if (onDelete) onDelete()
      onClose()
    } catch (err) {
      console.error('Error deleting appointment:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Mark this appointment as cancelled?')) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_URL}/api/appointments/${appointment.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel appointment')
      }

      if (onDelete) onDelete()
      onClose()
    } catch (err) {
      console.error('Error cancelling appointment:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="appointment-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="modal-header">
          <div className="header-type-icon" style={{ background: typeInfo.color }}>
            {typeInfo.icon}
          </div>
          <div className="header-info">
            <span className="header-type-label">{typeInfo.label}</span>
            <h2 className="header-title">{appointment.title}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {/* Content */}
        <div className="modal-content">
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Status Badge */}
          <div className="status-section">
            <span className="status-badge" style={{ color: statusInfo.color, borderColor: statusInfo.color }}>
              {statusInfo.icon} {statusInfo.label}
            </span>
            {appointment.completed_at && (
              <span className="completed-time">
                Completed {formatDateTime(appointment.completed_at)}
              </span>
            )}
          </div>

          {/* Date & Time */}
          <section className="detail-section">
            <h3 className="section-title">Date & Time</h3>
            {appointment.all_day ? (
              <div className="detail-item">
                <span className="detail-icon">📅</span>
                <div className="detail-content">
                  <span className="detail-label">All Day Event</span>
                  <span className="detail-value">{formatDate(appointment.starts_at)}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="detail-item">
                  <span className="detail-icon">🕐</span>
                  <div className="detail-content">
                    <span className="detail-label">Start</span>
                    <span className="detail-value">{formatDateTime(appointment.starts_at)}</span>
                  </div>
                </div>
                {appointment.ends_at && (
                  <div className="detail-item">
                    <span className="detail-icon">🕐</span>
                    <div className="detail-content">
                      <span className="detail-label">End</span>
                      <span className="detail-value">{formatDateTime(appointment.ends_at)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Location */}
          {appointment.location && (
            <section className="detail-section">
              <h3 className="section-title">Location</h3>
              <div className="detail-item">
                <span className="detail-icon">📍</span>
                <div className="detail-content">
                  <span className="detail-value">{appointment.location}</span>
                </div>
              </div>
            </section>
          )}

          {/* Provider Details */}
          {(appointment.provider_name || appointment.provider_phone) && (
            <section className="detail-section">
              <h3 className="section-title">Provider</h3>
              {appointment.provider_name && (
                <div className="detail-item">
                  <span className="detail-icon">👨‍⚕️</span>
                  <div className="detail-content">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{appointment.provider_name}</span>
                  </div>
                </div>
              )}
              {appointment.provider_phone && (
                <div className="detail-item">
                  <span className="detail-icon">📞</span>
                  <div className="detail-content">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{appointment.provider_phone}</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Description */}
          {appointment.description && (
            <section className="detail-section">
              <h3 className="section-title">Description</h3>
              <p className="description-text">{appointment.description}</p>
            </section>
          )}

          {/* Notes */}
          {appointment.notes && (
            <section className="detail-section">
              <h3 className="section-title">Notes</h3>
              <p className="notes-text">{appointment.notes}</p>
            </section>
          )}

          {/* Recurrence */}
          {appointment.is_recurring && appointment.recurrence_rule && (
            <section className="detail-section">
              <h3 className="section-title">Recurrence</h3>
              <div className="detail-item">
                <span className="detail-icon">🔁</span>
                <div className="detail-content">
                  <span className="detail-value">
                    {formatRecurrenceRule(appointment.recurrence_rule)}
                  </span>
                </div>
              </div>
              {appointment.is_recurring_instance && (
                <div className="recurrence-note">
                  <span className="recurrence-icon">ℹ️</span>
                  <span className="recurrence-text">
                    This is an instance of a recurring appointment
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Reminder */}
          {appointment.reminder_min && (
            <section className="detail-section">
              <h3 className="section-title">Reminder</h3>
              <div className="detail-item">
                <span className="detail-icon">🔔</span>
                <div className="detail-content">
                  <span className="detail-value">
                    {appointment.reminder_min >= 1440
                      ? `${appointment.reminder_min / 1440} day(s) before`
                      : appointment.reminder_min >= 60
                      ? `${appointment.reminder_min / 60} hour(s) before`
                      : `${appointment.reminder_min} minute(s) before`}
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button
            className="btn-edit"
            onClick={() => onEdit(appointment)}
            disabled={loading}
          >
            ✏️ Edit
          </button>
          {appointment.status === 'scheduled' && (
            <button
              className="btn-cancel"
              onClick={handleCancel}
              disabled={loading}
            >
              🚫 Cancel
            </button>
          )}
          <button
            className="btn-delete"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? '...' : '🗑️ Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AppointmentDetailsModal
