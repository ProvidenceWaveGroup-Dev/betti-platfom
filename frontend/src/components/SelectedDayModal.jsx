import React from 'react'
import AppointmentCard from './AppointmentCard'
import './SelectedDayModal.css'

/**
 * Selected Day Modal Component
 * Shows appointments for a selected day on mobile
 */
function SelectedDayModal({ selectedDate, appointments, onClose, onComplete, onUncomplete, onAppointmentClick }) {
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Generate unique key for appointment (handles recurring instances)
  const getAppointmentKey = (apt) => {
    if (apt.is_recurring_instance && apt.recurring_instance_date) {
      return `${apt.id}-${apt.recurring_instance_date}`
    }
    return apt.id
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="selected-day-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="modal-header">
          <h2 className="modal-title">{formatDate(selectedDate)}</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {/* Content */}
        <div className="modal-content">
          {appointments.length === 0 ? (
            <div className="empty-day">
              <span className="empty-icon">📭</span>
              <p>No appointments scheduled</p>
            </div>
          ) : (
            <div className="day-appointments">
              {appointments.map(apt => (
                <AppointmentCard
                  key={getAppointmentKey(apt)}
                  appointment={apt}
                  panel
                  checkable
                  onComplete={onComplete}
                  onUncomplete={onUncomplete}
                  onClick={onAppointmentClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SelectedDayModal
