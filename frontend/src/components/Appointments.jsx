import React, { useState, useEffect } from 'react'
import TodaySchedule from './TodaySchedule'
import AppointmentCalendar from './AppointmentCalendar'
import AddAppointmentModal from './AddAppointmentModal'
import AppointmentDetailsModal from './AppointmentDetailsModal'
import './Appointments.css'

/**
 * Appointments Panel Component
 * Main panel with view toggle between Calendar and Today's Schedule
 */
function Appointments({ isCollapsed = false, variant = 'desktop' }) {
  const isMobile = variant === 'mobile'

  // Detect mobile and force list view
  const [view, setView] = useState('list') // 'list' or 'calendar'
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [stats, setStats] = useState({ total: 0, completed: 0, percentage: 0 })

  // Load today's appointments for stats
  useEffect(() => {
    if (isCollapsed || isMobile) {
      fetchTodayStats()
    }
  }, [isCollapsed, isMobile])

  // Allow view toggling on mobile (removed forced list view)

  const fetchTodayStats = async () => {
    try {
      const response = await fetch('/api/appointments/today')
      if (!response.ok) return

      const result = await response.json()
      const data = result.data || []

      const total = data.length
      const completed = data.filter(apt => apt.status === 'completed').length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

      setStats({ total, completed, percentage })
    } catch (err) {
      console.error('Error fetching today stats:', err)
    }
  }

  const handleAddClick = () => {
    setSelectedAppointment(null)
    setShowAddModal(true)
  }

  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment)
    setShowDetailsModal(true)
  }

  const handleEditClick = (appointment) => {
    setSelectedAppointment(appointment)
    setShowDetailsModal(false)
    setShowAddModal(true)
  }

  const handleModalSuccess = () => {
    // Refresh the view by updating key
    setRefreshKey(prev => prev + 1)
    // Refresh stats too
    fetchTodayStats()
  }

  // Collapsed desktop view
  if (isCollapsed && !isMobile) {
    return (
      <div className="appointments-panel collapsed">
        <div className="appointments-header">
          <div className="appointments-header-left">
            <h3 className="appointments-title">📅 Appointments</h3>
            <div className="completion-badge">
              {stats.completed}/{stats.total}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="appointments-panel">
      {/* Header */}
      <header className="appointments-header">
        <div className="appointments-header-left">
          <h2 className="appointments-title">📅 Appointments</h2>
          <div className="view-toggle">
            <button
              className={`toggle-button ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              📋 List
            </button>
            <button
              className={`toggle-button ${view === 'calendar' ? 'active' : ''}`}
              onClick={() => setView('calendar')}
            >
              📅 Calendar
            </button>
          </div>
        </div>
        <button className="add-appointment-button" onClick={handleAddClick}>
          + Add
        </button>
      </header>

      {/* Content */}
      <div className="appointments-content">
        {view === 'list' ? (
          <TodaySchedule
            key={`list-${refreshKey}`}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : (
          <AppointmentCalendar
            key={`calendar-${refreshKey}`}
            onAppointmentClick={handleAppointmentClick}
          />
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddAppointmentModal
          appointment={selectedAppointment}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {showDetailsModal && selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setShowDetailsModal(false)}
          onEdit={handleEditClick}
          onDelete={handleModalSuccess}
        />
      )}
    </div>
  )
}

export default Appointments
