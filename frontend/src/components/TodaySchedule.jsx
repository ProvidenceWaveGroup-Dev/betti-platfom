import React, { useState, useEffect } from 'react'
import AppointmentCard from './AppointmentCard'
import './TodaySchedule.css'

/**
 * Today's Schedule Component
 * Displays today's appointments as a to-do list with completion tracking
 * Groups by time of day: Morning, Afternoon, Evening
 */
function TodaySchedule({ onAppointmentClick }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ total: 0, completed: 0 })

  useEffect(() => {
    fetchTodayAppointments()
  }, [])

  const fetchTodayAppointments = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/appointments/today')
      if (!response.ok) throw new Error('Failed to fetch appointments')

      const result = await response.json()
      const data = result.data || []

      setAppointments(data)

      // Calculate stats
      const total = data.length
      const completed = data.filter(apt => apt.status === 'completed').length
      setStats({ total, completed })
    } catch (err) {
      console.error('Error fetching today\'s appointments:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (appointment) => {
    try {
      const body = {}

      // If this is a recurring instance, include the instance_date
      if (appointment.is_recurring_instance && appointment.recurring_instance_date) {
        body.instance_date = appointment.recurring_instance_date
      }

      const response = await fetch(`/api/appointments/${appointment.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Failed to mark as complete')

      // Refresh list
      await fetchTodayAppointments()
    } catch (err) {
      console.error('Error completing appointment:', err)
      alert('Failed to mark appointment as complete')
    }
  }

  const handleUncomplete = async (appointment) => {
    try {
      const body = {}

      // If this is a recurring instance, include the instance_date
      if (appointment.is_recurring_instance && appointment.recurring_instance_date) {
        body.instance_date = appointment.recurring_instance_date
      }

      const response = await fetch(`/api/appointments/${appointment.id}/uncomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Failed to mark as incomplete')

      // Refresh list
      await fetchTodayAppointments()
    } catch (err) {
      console.error('Error uncompleting appointment:', err)
      alert('Failed to uncheck appointment')
    }
  }

  // Generate unique key for appointment (handles recurring instances)
  const getAppointmentKey = (apt) => {
    if (apt.is_recurring_instance && apt.recurring_instance_date) {
      return `${apt.id}-${apt.recurring_instance_date}`
    }
    return apt.id
  }

  // Group appointments by time of day
  const getHour = (dateString) => {
    return new Date(dateString).getHours()
  }

  const morning = appointments.filter(apt => {
    if (apt.all_day) return true // Show all-day events in morning
    const hour = getHour(apt.starts_at)
    return hour < 12
  })

  const afternoon = appointments.filter(apt => {
    if (apt.all_day) return false // Already shown in morning
    const hour = getHour(apt.starts_at)
    return hour >= 12 && hour < 17
  })

  const evening = appointments.filter(apt => {
    if (apt.all_day) return false // Already shown in morning
    const hour = getHour(apt.starts_at)
    return hour >= 17
  })

  const progressPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  if (loading) {
    return (
      <div className="today-schedule">
        <div className="loading-state">Loading today's schedule...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="today-schedule">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>Failed to load appointments</p>
          <button className="retry-button" onClick={fetchTodayAppointments}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="today-schedule">
      {/* Header with completion stats */}
      <header className="schedule-header">
        <div className="header-title">
          <span className="calendar-icon">📅</span>
          <h2>Today's Schedule</h2>
        </div>
        <div className="completion-stats">
          <span className="stats-text">
            {stats.completed}/{stats.total} completed
          </span>
          <span className="stats-percentage">{progressPercentage}%</span>
        </div>
      </header>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Appointments List */}
      {appointments.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No appointments scheduled for today</p>
        </div>
      ) : (
        <div className="appointments-by-time">
          {/* Morning */}
          {morning.length > 0 && (
            <section className="time-section">
              <h3 className="time-heading">MORNING</h3>
              <div className="appointments-group">
                {morning.map(apt => (
                  <AppointmentCard
                    key={getAppointmentKey(apt)}
                    appointment={apt}
                    checkable
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                    onClick={onAppointmentClick}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Afternoon */}
          {afternoon.length > 0 && (
            <section className="time-section">
              <h3 className="time-heading">AFTERNOON</h3>
              <div className="appointments-group">
                {afternoon.map(apt => (
                  <AppointmentCard
                    key={getAppointmentKey(apt)}
                    appointment={apt}
                    checkable
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                    onClick={onAppointmentClick}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Evening */}
          {evening.length > 0 && (
            <section className="time-section">
              <h3 className="time-heading">EVENING</h3>
              <div className="appointments-group">
                {evening.map(apt => (
                  <AppointmentCard
                    key={getAppointmentKey(apt)}
                    appointment={apt}
                    checkable
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                    onClick={onAppointmentClick}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Completion Message */}
      {stats.total > 0 && stats.completed === stats.total && (
        <div className="completion-message">
          <span className="completion-icon">🎉</span>
          All appointments completed for today!
        </div>
      )}
    </div>
  )
}

export default TodaySchedule
