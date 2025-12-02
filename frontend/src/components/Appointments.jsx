import React, { useState, useEffect } from 'react'
import './Appointments.css'
import '../styles/mobileSchedule.scss'

function Appointments({ isCollapsed = false, variant = 'desktop', onNavigate }) {
  const [appointments, setAppointments] = useState([])

  const isMobile = variant === 'mobile'

  useEffect(() => {
    fetch('/src/data/appointments.json')
      .then(response => response.json())
      .then(data => setAppointments(data))
      .catch(error => console.error('Error loading appointments:', error))
  }, [])

  const getTypeIcon = (type, icon) => {
    // If icon is provided in data, use it; otherwise derive from type
    if (icon) return icon

    switch (type) {
      case 'medical': return '🏥'
      case 'medication': return '💊'
      case 'therapy': return '🤸'
      case 'personal': return '👥'
      default: return '📅'
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'medical': return '#22c55e'
      case 'medication': return '#8b5cf6'
      case 'therapy': return '#f59e0b'
      case 'personal': return '#06b6d4'
      default: return '#64748b'
    }
  }

  const formatTime = (time) => {
    return time
  }

  const getNextAppointment = () => {
    if (appointments.length === 0) return null
    return appointments[0]
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
    const next = getNextAppointment()
    return (
      <div className="appointments-mini">
        <div className="mini-header">
          <span className="mini-icon">📅</span>
          <span className="mini-title">Today's Schedule</span>
          <span className="mini-count">{appointments.length} events</span>
        </div>
        {next && (
          <div className="mini-content">
            <span className="mini-time">{next.time}</span>
            <span className="mini-text">{next.title}</span>
          </div>
        )}
      </div>
    )
  }

  // Mobile layout
  if (isMobile) {
    const nextAppointment = getNextAppointment()

    return (
      <div className="mobile-schedule">
        <h2>Today's Schedule</h2>
        <div className="schedule-summary">
          <span className="event-count">{appointments.length} events today</span>
          {nextAppointment && (
            <span className="next-up">
              Next: {nextAppointment.time} - {nextAppointment.title}
            </span>
          )}
        </div>

        {/* Current/Next Appointment Highlight */}
        {nextAppointment && (
          <section className="next-appointment-card">
            <div className="appointment-header">
              <span className="appointment-icon" style={{ color: getTypeColor(nextAppointment.type) }}>
                {getTypeIcon(nextAppointment.type, nextAppointment.icon)}
              </span>
              <div className="appointment-timing">
                <div className="appointment-time">{formatTime(nextAppointment.time)}</div>
                <div className="time-until">Coming up</div>
              </div>
            </div>
            <div className="appointment-details">
              <h3 className="appointment-title">{nextAppointment.title}</h3>
              {nextAppointment.location && (
                <div className="appointment-location">
                  <span className="location-icon">📍</span>
                  {nextAppointment.location}
                </div>
              )}
              {nextAppointment.notes && (
                <div className="appointment-notes">{nextAppointment.notes}</div>
              )}
            </div>
          </section>
        )}

        {/* All Appointments List */}
        <section className="appointments-list">
          <h3>Today's Schedule</h3>
          {appointments.map((appointment, index) => (
            <div
              key={appointment.id || index}
              className={`appointment-item ${index === 0 ? 'current' : ''}`}
            >
              <div className="appointment-time-badge">
                <div
                  className="time-icon"
                  style={{
                    color: getTypeColor(appointment.type),
                    backgroundColor: `${getTypeColor(appointment.type)}20`
                  }}
                >
                  {getTypeIcon(appointment.type, appointment.icon)}
                </div>
                <div className="appointment-time">{formatTime(appointment.time)}</div>
              </div>

              <div className="appointment-content">
                <div className="appointment-title">{appointment.title}</div>
                {appointment.location && (
                  <div className="appointment-location">
                    <span className="location-icon">📍</span>
                    {appointment.location}
                  </div>
                )}
                {appointment.notes && (
                  <div className="appointment-notes">{appointment.notes}</div>
                )}
              </div>
            </div>
          ))}

          {appointments.length === 0 && (
            <div className="no-appointments">
              <span className="empty-icon">📅</span>
              <p>No appointments scheduled for today</p>
            </div>
          )}
        </section>
      </div>
    )
  }

  // Desktop full layout
  return (
    <div className="appointments-card">
      <div className="card-header">
        <h2 className="card-title">Today's Schedule</h2>
        <span className="event-count">{appointments.length} events</span>
      </div>
      <div className="appointments-list">
        {appointments.map((apt, index) => (
          <div key={index} className="appointment-item">
            <div className="appointment-time-badge">
              <div className="time-icon">{getTypeIcon(apt.type, apt.icon)}</div>
            </div>
            <div className="appointment-details">
              <div className="appointment-time">{apt.time}</div>
              <div className="appointment-title">{apt.title}</div>
              {apt.location && (
                <div className="appointment-location">
                  <span className="location-icon">📍</span>
                  {apt.location}
                </div>
              )}
              {apt.notes && (
                <div className="appointment-notes">{apt.notes}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Appointments
