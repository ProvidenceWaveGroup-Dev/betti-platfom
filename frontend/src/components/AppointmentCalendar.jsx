import React, { useState, useEffect } from 'react'
import AppointmentCard from './AppointmentCard'
import SelectedDayModal from './SelectedDayModal'
import { getAppointmentType } from '../constants/appointmentTypes'
import './AppointmentCalendar.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Appointment Calendar Component
 * Calendar grid view with month navigation and selected day detail panel
 */
function AppointmentCalendar({ onAppointmentClick }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    fetchMonthAppointments()
  }, [year, month])

  // Track mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchMonthAppointments = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_URL}/api/appointments/month/${year}/${month + 1}`)
      if (!response.ok) throw new Error('Failed to fetch appointments')

      const result = await response.json()
      setAppointments(result.appointments || [])
    } catch (err) {
      console.error('Error fetching appointments:', err)
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

      const response = await fetch(`${API_URL}/api/appointments/${appointment.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Failed to mark as complete')
      await fetchMonthAppointments()
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

      const response = await fetch(`${API_URL}/api/appointments/${appointment.id}/uncomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Failed to mark as incomplete')
      await fetchMonthAppointments()
    } catch (err) {
      console.error('Error uncompleting appointment:', err)
      alert('Failed to uncheck appointment')
    }
  }

  // Navigation
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  // Calendar grid calculation
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay()

  // Build calendar grid
  const calendarDays = []

  // Empty cells before first day
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // Get appointments for a specific day
  const getAppointmentsForDay = (day) => {
    if (!day) return []

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    return appointments.filter(apt => {
      const aptDate = new Date(apt.starts_at)
      const aptDateStr = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, '0')}-${String(aptDate.getDate()).padStart(2, '0')}`
      return aptDateStr === dateStr
    })
  }

  // Generate unique key for appointment (handles recurring instances)
  const getAppointmentKey = (apt) => {
    if (apt.is_recurring_instance && apt.recurring_instance_date) {
      return `${apt.id}-${apt.recurring_instance_date}`
    }
    return apt.id
  }

  // Get appointments for selected date
  const selectedDay = selectedDate.getDate()
  const selectedMonth = selectedDate.getMonth()
  const selectedYear = selectedDate.getFullYear()

  const selectedAppointments = (selectedMonth === month && selectedYear === year)
    ? getAppointmentsForDay(selectedDay)
    : []

  const isToday = (day) => {
    if (!day) return false
    const today = new Date()
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear()
  }

  const isSelected = (day) => {
    if (!day) return false
    return day === selectedDay &&
           month === selectedMonth &&
           year === selectedYear
  }

  const handleDayClick = (day) => {
    if (day) {
      setSelectedDate(new Date(year, month, day))
      if (isMobile) {
        setShowMobileModal(true)
      }
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading) {
    return (
      <div className="appointment-calendar">
        <div className="loading-state">Loading calendar...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="appointment-calendar">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <p>Failed to load calendar</p>
          <button className="retry-button" onClick={fetchMonthAppointments}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="appointment-calendar">
      {/* Calendar Header */}
      <header className="calendar-header">
        <button className="nav-button" onClick={previousMonth} aria-label="Previous month">
          ‹
        </button>
        <h2 className="calendar-title">
          {monthNames[month]} {year}
        </h2>
        <button className="nav-button" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
        <button className="today-button" onClick={goToToday}>
          Today
        </button>
      </header>

      <div className="calendar-grid-container">
        {/* Calendar Grid */}
        <div className="calendar-grid">
          {/* Day headers */}
          <div className="day-headers">
            {dayNames.map(day => (
              <div key={day} className="day-header">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="days-grid">
            {calendarDays.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day)
              const hasAppointments = dayAppointments.length > 0

              return (
                <div
                  key={index}
                  className={`calendar-day ${!day ? 'empty' : ''} ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasAppointments ? 'has-appointments' : ''}`}
                  onClick={() => handleDayClick(day)}
                >
                  {day && (
                    <>
                      <span className="day-number">{day}</span>
                      {hasAppointments && (
                        <div className="appointment-dots">
                          {dayAppointments.slice(0, 3).map(apt => {
                            const typeInfo = getAppointmentType(apt.appointment_type)
                            return (
                              <span
                                key={getAppointmentKey(apt)}
                                className="appointment-dot"
                                style={{ background: typeInfo.color }}
                                title={apt.title}
                              />
                            )
                          })}
                          {dayAppointments.length > 3 && (
                            <span className="more-indicator">+{dayAppointments.length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Day Panel - Hidden on mobile */}
        {!isMobile && (
          <div className="selected-day-panel">
            <h3 className="panel-title">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </h3>

            {selectedAppointments.length === 0 ? (
              <div className="empty-day">
                <span className="empty-icon">📭</span>
                <p>No appointments scheduled</p>
              </div>
            ) : (
              <div className="day-appointments">
                {selectedAppointments.map(apt => (
                  <AppointmentCard
                    key={getAppointmentKey(apt)}
                    appointment={apt}
                    panel
                    checkable
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                    onClick={onAppointmentClick}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Day Modal - Mobile only */}
      {isMobile && showMobileModal && (
        <SelectedDayModal
          selectedDate={selectedDate}
          appointments={selectedAppointments}
          onClose={() => setShowMobileModal(false)}
          onComplete={handleComplete}
          onUncomplete={handleUncomplete}
          onAppointmentClick={onAppointmentClick}
        />
      )}
    </div>
  )
}

export default AppointmentCalendar
