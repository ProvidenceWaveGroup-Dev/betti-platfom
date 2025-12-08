import { useState, useEffect } from 'react'
import vitalsApi from '../services/vitalsApi'
import '../styles/mobileDashboard.scss'

const MobileDashboard = ({ onNavigate }) => {
  const [quickStats, setQuickStats] = useState({
    bp: '--/--',
    hr: '-- bpm',
    o2: '--%',
    temp: '--°F'
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [healthStatus, setHealthStatus] = useState({ text: 'Loading...', isNormal: true })

  const [nextAppointment, setNextAppointment] = useState(null)
  const [appointmentLoading, setAppointmentLoading] = useState(true)

  // Fetch latest vitals from the API (same format as Vitals.jsx)
  useEffect(() => {
    const fetchVitals = async () => {
      try {
        setStatsLoading(true)
        const result = await vitalsApi.getLatest()

        if (result.success && result.data && result.data.length > 0) {
          // API returns array of vital objects like Vitals.jsx expects
          const vitalsArray = result.data
          const newStats = {
            bp: '--/--',
            hr: '--',
            o2: '--',
            temp: '--'
          }

          // Map vitals data to display format (matching Vitals.jsx format)
          const bpVital = vitalsArray.find(v => v.vitalType === 'blood_pressure')
          const hrVital = vitalsArray.find(v => v.vitalType === 'heart_rate')
          const o2Vital = vitalsArray.find(v => v.vitalType === 'spo2')
          const tempVital = vitalsArray.find(v => v.vitalType === 'temperature')

          if (bpVital && bpVital.value !== '--/--') {
            newStats.bp = bpVital.value
          }
          if (hrVital && hrVital.value !== '--') {
            newStats.hr = hrVital.value
          }
          if (o2Vital && o2Vital.value !== '--') {
            newStats.o2 = o2Vital.value
          }
          if (tempVital && tempVital.value !== '--') {
            newStats.temp = tempVital.value
          }

          setQuickStats(newStats)

          // Determine health status based on vital statuses (matching Vitals.jsx logic)
          const allVitals = vitalsArray
          const hasCritical = allVitals.some(v => v.status?.toLowerCase() === 'critical')
          const hasHigh = allVitals.some(v => ['high', 'fever'].includes(v.status?.toLowerCase()))
          const hasLow = allVitals.some(v => ['low', 'elevated'].includes(v.status?.toLowerCase()))

          if (hasCritical) {
            setHealthStatus({ text: 'Critical Alert', isNormal: false })
          } else if (hasHigh || hasLow) {
            setHealthStatus({ text: 'Needs Attention', isNormal: false })
          } else {
            setHealthStatus({ text: 'All Normal', isNormal: true })
          }
        } else {
          setHealthStatus({ text: 'No readings', isNormal: true })
        }
      } catch (error) {
        console.error('Error fetching vitals:', error)
        setHealthStatus({ text: 'Unable to load', isNormal: true })
      } finally {
        setStatsLoading(false)
      }
    }

    fetchVitals()

    // Refresh every 2 minutes
    const interval = setInterval(fetchVitals, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch today's appointments from the API
  useEffect(() => {
    const fetchTodaysAppointments = async () => {
      try {
        setAppointmentLoading(true)
        const response = await fetch('/api/appointments/today')
        const result = await response.json()

        if (result.success && result.data && result.data.length > 0) {
          // Find the next upcoming appointment (not completed/cancelled)
          const now = new Date()
          const upcomingAppointments = result.data
            .filter(apt => apt.status !== 'completed' && apt.status !== 'cancelled')
            .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))

          if (upcomingAppointments.length > 0) {
            const next = upcomingAppointments[0]
            const startTime = new Date(next.starts_at)

            // Format time
            const timeStr = startTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })

            // Calculate countdown
            const diffMs = startTime - now
            const diffMins = Math.round(diffMs / 60000)
            let countdown = ''
            if (diffMins < 0) {
              countdown = 'Now'
            } else if (diffMins < 60) {
              countdown = `In ${diffMins} min`
            } else {
              const hours = Math.floor(diffMins / 60)
              countdown = `In ${hours} hour${hours > 1 ? 's' : ''}`
            }

            setNextAppointment({
              time: timeStr,
              title: next.title,
              subtitle: next.provider_name || next.location || next.appointment_type,
              countdown
            })
          } else {
            setNextAppointment(null)
          }
        } else {
          setNextAppointment(null)
        }
      } catch (error) {
        console.error('Error fetching appointments:', error)
        setNextAppointment(null)
      } finally {
        setAppointmentLoading(false)
      }
    }

    fetchTodaysAppointments()

    // Refresh every 5 minutes
    const interval = setInterval(fetchTodaysAppointments, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Quick actions that match mobile navigation
  const quickActions = [
    { id: 'health', icon: '❤️', label: 'Health Vitals', screen: 'health' },
    { id: 'schedule', icon: '📅', label: 'Schedule', screen: 'schedule' },
    { id: 'medication', icon: '💊', label: 'Medication', screen: 'medication' },
    { id: 'nutrition', icon: '🍎', label: 'Nutrition', screen: 'nutrition' }
  ]

  const handleActionClick = (action) => {
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }

    onNavigate(action.screen)
  }

  return (
    <div className="mobile-dashboard">

      {/* Quick Action Buttons */}
      <section style={{ marginBottom: '24px' }}>
        <h3>Quick Actions</h3>
        <div className="quick-actions">
          {quickActions.map(action => (
            <button
              key={action.id}
              className="action-card"
              onClick={() => handleActionClick(action)}
            >
              <div className="action-icon">{action.icon}</div>
              <div className="action-label">{action.label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Today's Stats Card */}
      <section style={{ marginBottom: '24px' }}>
        <div className="card-mobile interactive" onClick={() => onNavigate('health')}>
          <h3>Today's Health Stats</h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="label">BP</div>
              <div className="value">{statsLoading ? '...' : quickStats.bp}</div>
            </div>
            <div className="info-item">
              <div className="label">HR</div>
              <div className="value">{statsLoading ? '...' : (quickStats.hr !== '--' ? `${quickStats.hr} bpm` : '--')}</div>
            </div>
            <div className="info-item">
              <div className="label">O2</div>
              <div className="value">{statsLoading ? '...' : (quickStats.o2 !== '--' ? `${quickStats.o2}%` : '--')}</div>
            </div>
            <div className="info-item">
              <div className="label">Temp</div>
              <div className="value">{statsLoading ? '...' : (quickStats.temp !== '--' ? `${quickStats.temp}°F` : '--')}</div>
            </div>
          </div>
          <div className={`status ${healthStatus.isNormal ? '' : 'warning'}`}>
            <div className={`dot ${healthStatus.isNormal ? '' : 'warning'}`}></div>
            <span>{healthStatus.text}</span>
          </div>
        </div>
      </section>

      {/* Next Appointment Card */}
      <section style={{ marginBottom: '24px' }}>
        <div className="card-mobile interactive" onClick={() => onNavigate('schedule')}>
          <h3>Next Appointment</h3>
          {appointmentLoading ? (
            <div className="appointment-info">
              <div className="appointment-details">
                <div className="subtitle">Loading...</div>
              </div>
            </div>
          ) : nextAppointment ? (
            <div className="appointment-info">
              <div className="appointment-details">
                <div className="time">{nextAppointment.time}</div>
                <div className="title">{nextAppointment.title}</div>
                <div className="subtitle">{nextAppointment.subtitle}</div>
              </div>
              <div className="countdown">{nextAppointment.countdown}</div>
            </div>
          ) : (
            <div className="appointment-info">
              <div className="appointment-details">
                <div className="subtitle" style={{ color: '#888' }}>No appointments today</div>
              </div>
              <div className="countdown" style={{ fontSize: '20px' }}>📅</div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default MobileDashboard