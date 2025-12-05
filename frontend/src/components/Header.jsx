import React, { useState, useEffect } from 'react'
import weatherApi from '../services/weatherApi'
import './Header.css'

function Header({ onNavigate, activeView = 'home' }) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather, setWeather] = useState({ temperature: '--', icon: '🌡️', location: 'Longmont' })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // Fetch weather immediately and then every 10 minutes
    const fetchWeather = async () => {
      const data = await weatherApi.getCurrentWeather()
      setWeather(data)
    }

    fetchWeather()
    const weatherTimer = setInterval(fetchWeather, 10 * 60 * 1000)
    return () => clearInterval(weatherTimer)
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
    { id: 'nutrition', label: 'Nutrition', icon: '🍎' },
    { id: 'hydration', label: 'Hydration', icon: '💧' },
    { id: 'sensors', label: 'Setup', icon: '⚙️' },
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
          <span className="weather-icon">{weather.icon}</span>
          <span className="weather-temp">{weather.temperature}°F</span>
          <span className="weather-location">{weather.location}</span>
        </div>
        <div className="time-display">{formatTime(currentTime)}</div>
      </div>
    </header>
  )
}

export default Header
