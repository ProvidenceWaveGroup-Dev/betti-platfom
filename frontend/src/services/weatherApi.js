/**
 * Weather API Service
 * Uses Open-Meteo (free, no API key required)
 * Location: Longmont, CO
 */

// Longmont, CO coordinates
const LONGMONT_LAT = 40.1672
const LONGMONT_LON = -105.1019
const LOCATION_NAME = 'Longmont'

// Weather code to emoji/description mapping (WMO codes)
const WEATHER_CODES = {
  0: { icon: '☀️', description: 'Clear sky' },
  1: { icon: '🌤️', description: 'Mainly clear' },
  2: { icon: '⛅', description: 'Partly cloudy' },
  3: { icon: '☁️', description: 'Overcast' },
  45: { icon: '🌫️', description: 'Foggy' },
  48: { icon: '🌫️', description: 'Rime fog' },
  51: { icon: '🌧️', description: 'Light drizzle' },
  53: { icon: '🌧️', description: 'Moderate drizzle' },
  55: { icon: '🌧️', description: 'Dense drizzle' },
  56: { icon: '🌧️', description: 'Freezing drizzle' },
  57: { icon: '🌧️', description: 'Heavy freezing drizzle' },
  61: { icon: '🌧️', description: 'Slight rain' },
  63: { icon: '🌧️', description: 'Moderate rain' },
  65: { icon: '🌧️', description: 'Heavy rain' },
  66: { icon: '🌨️', description: 'Freezing rain' },
  67: { icon: '🌨️', description: 'Heavy freezing rain' },
  71: { icon: '❄️', description: 'Slight snow' },
  73: { icon: '❄️', description: 'Moderate snow' },
  75: { icon: '❄️', description: 'Heavy snow' },
  77: { icon: '🌨️', description: 'Snow grains' },
  80: { icon: '🌦️', description: 'Slight showers' },
  81: { icon: '🌦️', description: 'Moderate showers' },
  82: { icon: '🌧️', description: 'Violent showers' },
  85: { icon: '🌨️', description: 'Slight snow showers' },
  86: { icon: '🌨️', description: 'Heavy snow showers' },
  95: { icon: '⛈️', description: 'Thunderstorm' },
  96: { icon: '⛈️', description: 'Thunderstorm with hail' },
  99: { icon: '⛈️', description: 'Thunderstorm with heavy hail' }
}

class WeatherApi {
  constructor() {
    this.cache = null
    this.cacheTime = null
    this.cacheDuration = 10 * 60 * 1000 // 10 minutes
  }

  /**
   * Get current weather for Longmont, CO
   */
  async getCurrentWeather() {
    // Return cached data if still valid
    if (this.cache && this.cacheTime && (Date.now() - this.cacheTime < this.cacheDuration)) {
      return this.cache
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LONGMONT_LAT}&longitude=${LONGMONT_LON}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Denver`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`)
      }

      const data = await response.json()

      const weatherCode = data.current.weather_code
      const weatherInfo = WEATHER_CODES[weatherCode] || { icon: '🌡️', description: 'Unknown' }

      const weather = {
        temperature: Math.round(data.current.temperature_2m),
        temperatureUnit: '°F',
        weatherCode: weatherCode,
        icon: weatherInfo.icon,
        description: weatherInfo.description,
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m),
        location: LOCATION_NAME,
        updatedAt: new Date().toISOString()
      }

      // Cache the result
      this.cache = weather
      this.cacheTime = Date.now()

      return weather
    } catch (error) {
      console.error('Failed to fetch weather:', error)

      // Return cached data if available, even if stale
      if (this.cache) {
        return { ...this.cache, stale: true }
      }

      // Return fallback data
      return {
        temperature: '--',
        temperatureUnit: '°F',
        icon: '🌡️',
        description: 'Weather unavailable',
        location: LOCATION_NAME,
        error: true
      }
    }
  }
}

// Export singleton instance
const weatherApi = new WeatherApi()
export default weatherApi
