import { useState, useEffect } from 'react'
import weatherApi from '../services/weatherApi'

const MobileHeader = () => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather, setWeather] = useState({ temperature: '--', icon: '🌡️', location: 'Longmont' })

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
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

  return (
    <header className="mobile-header">
      <div className="header-left">
        <div className="header-logo">
          <img
            src="/Betti Logo TM.png"
            alt="Betti"
            className="betti-logo-header"
          />
        </div>
        <div className="header-info">
          <span className="time">{formatTime(currentTime)}</span>
          <span className="weather">{weather.icon} {weather.temperature}°F {weather.location}</span>
        </div>
      </div>
      <button className="hamburger-menu" aria-label="Menu">
        ☰
      </button>
    </header>
  )
}

export default MobileHeader