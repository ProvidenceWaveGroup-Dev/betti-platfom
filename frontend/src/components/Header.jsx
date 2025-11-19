import React, { useState, useEffect } from 'react'
import './Header.css'

function Header({ onNavigate, activeView = 'home' }) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const navItems = [
    { id: 'home', label: 'Betti', icon: '/Betti Logo TM.png', isLogo: true },
    { id: 'health', label: 'Health', icon: '❤️' },
    { id: 'appointments', label: 'Appointments', icon: '📅' },
    { id: 'medication', label: 'Medication', icon: '💊' },
    { id: 'fitness', label: 'Fitness', icon: '💪' },
    { id: 'video', label: 'Video', icon: '📹' },
    { id: 'nutrition', label: 'Nutrition', icon: '🥗' },
    { id: 'hydration', label: 'Hydration', icon: '💧' },
    { id: 'sensors', label: 'Sensors', icon: '📡' },
  ]

  const handleNavClick = (id) => {
    if (onNavigate) {
      onNavigate(id)
    }
  }

  return (
    <header className="header">
      <nav className="nav-icons">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''} ${item.isLogo ? 'logo-item' : ''}`}
            onClick={() => handleNavClick(item.id)}
            aria-label={item.label}
          >
            {item.isLogo ? (
              <img src={item.icon} alt={item.label} className="nav-logo" />
            ) : (
              <span className="nav-icon">{item.icon}</span>
            )}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="header-right">
        <div className="weather-compact">
          <span className="weather-icon">☀️</span>
          <span className="weather-temp">72°F</span>
          <span className="weather-location">Fort Collins</span>
        </div>
        <div className="time-display">{formatTime(currentTime)}</div>
      </div>
    </header>
  )
}

export default Header
