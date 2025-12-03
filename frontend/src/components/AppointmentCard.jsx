import React from 'react'
import { getAppointmentType, getStatusInfo } from '../constants/appointmentTypes'
import './AppointmentCard.css'

/**
 * Reusable Appointment Card Component
 * Used in both list view (today's schedule) and calendar view
 *
 * @param {Object} appointment - Appointment data
 * @param {boolean} checkable - Show checkbox for completing (today's schedule)
 * @param {Function} onComplete - Callback when marking complete
 * @param {Function} onUncomplete - Callback when unchecking
 * @param {Function} onClick - Callback when clicking card
 * @param {boolean} compact - Compact view for calendar
 * @param {boolean} panel - Panel view for selected day (calendar sidebar)
 */
function AppointmentCard({
  appointment,
  checkable = false,
  onComplete,
  onUncomplete,
  onClick,
  compact = false,
  panel = false
}) {
  const typeInfo = getAppointmentType(appointment.appointment_type)
  const statusInfo = getStatusInfo(appointment.status)

  const isCompleted = appointment.status === 'completed'
  const isOverdue = appointment.status === 'scheduled' && new Date(appointment.starts_at) < new Date()

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const handleCheckboxClick = (e) => {
    e.stopPropagation()
    if (isCompleted && onUncomplete) {
      onUncomplete(appointment)
    } else if (!isCompleted && onComplete) {
      onComplete(appointment)
    }
  }

  const handleCardClick = () => {
    if (onClick) {
      onClick(appointment)
    }
  }

  if (compact) {
    // Compact view for calendar day cells
    return (
      <div
        className={`appointment-card-compact ${isCompleted ? 'completed' : ''}`}
        onClick={handleCardClick}
        style={{ borderLeftColor: typeInfo.color }}
      >
        <span className="compact-icon">{typeInfo.icon}</span>
        <div className="compact-info">
          <span className="compact-time">{formatTime(appointment.starts_at)}</span>
          <span className="compact-title">{appointment.title}</span>
        </div>
      </div>
    )
  }

  if (panel) {
    // Panel view for selected day sidebar (proper column layout)
    return (
      <div
        className={`appointment-card-panel ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
        onClick={handleCardClick}
        style={{ borderLeftColor: typeInfo.color }}
      >
        {/* Row 1: Time + Status Badge */}
        <div className="panel-row-1">
          <span className="panel-time">
            {appointment.all_day ? 'All Day' : formatTime(appointment.starts_at)}
          </span>
          {isCompleted && (
            <span className="panel-status-badge" style={{ color: statusInfo.color }}>
              {statusInfo.icon} {statusInfo.label}
            </span>
          )}
        </div>

        {/* Row 2: Type Icon + Title */}
        <div className="panel-row-2">
          <span className="panel-type-icon" style={{ color: typeInfo.color }}>
            {typeInfo.icon}
          </span>
          <h4 className="panel-title">{appointment.title}</h4>
        </div>

        {/* Row 3: Description */}
        {appointment.description && (
          <p className="panel-description">{appointment.description}</p>
        )}

        {/* Row 4: Location */}
        {appointment.location && (
          <div className="panel-location">
            <span className="panel-location-icon">📍</span>
            <span className="panel-location-text">{appointment.location}</span>
          </div>
        )}

        {/* Row 5: Completion timestamp OR Mark Complete button */}
        {isCompleted && appointment.completed_at ? (
          <div className="panel-completed-time">
            Completed at {formatTime(appointment.completed_at)}
          </div>
        ) : checkable ? (
          <button
            className="panel-complete-button"
            onClick={handleCheckboxClick}
          >
            Mark Complete
          </button>
        ) : null}

        {isOverdue && (
          <div className="panel-overdue-warning">
            <span className="warning-icon">⚠️</span>
            Overdue
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`appointment-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
      onClick={handleCardClick}
      style={{ borderLeftColor: typeInfo.color }}
    >
      {/* Left: Time/Icon Section */}
      <div className="appointment-time-section">
        {appointment.all_day ? (
          <div className="all-day-badge">All Day</div>
        ) : (
          <div className="appointment-time">{formatTime(appointment.starts_at)}</div>
        )}
        <div className="appointment-type-icon" style={{ backgroundColor: `${typeInfo.color}20` }}>
          <span>{typeInfo.icon}</span>
        </div>
      </div>

      {/* Center: Appointment Details */}
      <div className="appointment-details">
        <div className="appointment-header">
          <h3 className="appointment-title">{appointment.title}</h3>
          {appointment.status !== 'scheduled' && (
            <span className="status-badge" style={{ color: statusInfo.color }}>
              {statusInfo.icon} {statusInfo.label}
            </span>
          )}
        </div>

        {appointment.location && (
          <div className="appointment-location">
            <span className="location-icon">📍</span>
            {appointment.location}
          </div>
        )}

        {appointment.provider_name && (
          <div className="appointment-provider">
            <span className="provider-icon">👤</span>
            {appointment.provider_name}
            {appointment.provider_phone && ` • ${appointment.provider_phone}`}
          </div>
        )}

        {appointment.description && !isCompleted && (
          <div className="appointment-description">{appointment.description}</div>
        )}

        {isCompleted && appointment.completed_at && (
          <div className="completed-time">
            Completed at {formatTime(appointment.completed_at)}
          </div>
        )}

        {isOverdue && (
          <div className="overdue-warning">
            <span className="warning-icon">⚠️</span>
            Overdue
          </div>
        )}
      </div>

      {/* Right: Action Button */}
      {checkable && (
        <button
          className={`appointment-check-button ${isCompleted ? 'checked' : 'unchecked'}`}
          onClick={handleCheckboxClick}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isCompleted ? (
            <span className="check-icon">✓</span>
          ) : (
            <span className="circle-icon">○</span>
          )}
        </button>
      )}
    </div>
  )
}

export default AppointmentCard
