// Fitness API service for communicating with backend

class FitnessApi {
  constructor() {
    // Determine the backend URL based on environment
    // When using ngrok, the backend is proxied through Vite on the same origin
    const isNgrok = window.location.hostname.includes('ngrok')
    const isHttps = window.location.protocol === 'https:'

    if (isNgrok || isHttps) {
      // Use Vite proxy (same origin) for ngrok/HTTPS
      this.baseUrl = '/api/fitness'
    } else {
      // Direct backend connection for local development
      this.baseUrl = `http://${window.location.hostname}:3001/api/fitness`
    }
  }

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error(`Fitness API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // Get today's activity summary
  async getTodaySummary() {
    return this.request('/today')
  }

  // Log a new workout
  async logWorkout(workoutData) {
    // Transform frontend workout format to backend format
    const backendWorkout = {
      workout_type: workoutData.type || workoutData.workout_type,
      duration_min: workoutData.duration || workoutData.duration_min,
      calories_burned: workoutData.caloriesBurned || workoutData.calories_burned,
      distance_miles: workoutData.distance_miles,
      steps: workoutData.steps,
      heart_rate_avg: workoutData.heart_rate_avg,
      intensity: workoutData.intensity || 'moderate',
      video_id: workoutData.video_id || workoutData.videoId,
      notes: workoutData.notes || workoutData.exercise,
      started_at: workoutData.timestamp || workoutData.started_at || new Date().toISOString(),
      ended_at: workoutData.ended_at
    }

    return this.request('/workout', {
      method: 'POST',
      body: JSON.stringify(backendWorkout)
    })
  }

  // Get workout history
  async getWorkoutHistory(options = {}) {
    const params = new URLSearchParams()
    if (options.startDate) params.append('startDate', options.startDate)
    if (options.endDate) params.append('endDate', options.endDate)
    if (options.type) params.append('type', options.type)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.days) {
      // Calculate startDate from days ago
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - options.days)
      params.append('startDate', startDate.toISOString().split('T')[0])
    }

    const queryString = params.toString()
    return this.request(`/workouts${queryString ? `?${queryString}` : ''}`)
  }

  // Get single workout by ID
  async getWorkout(workoutId) {
    return this.request(`/workout/${workoutId}`)
  }

  // Delete a workout
  async deleteWorkout(workoutId) {
    return this.request(`/workout/${workoutId}`, {
      method: 'DELETE'
    })
  }

  // Get weekly activity summary
  async getWeeklySummary() {
    return this.request('/weekly')
  }

  // Update daily activity (from wearable sync)
  async updateDailyActivity(data) {
    return this.request('/daily', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  // Helper method to get all data needed for fitness component
  async getFitnessDashboardData() {
    try {
      const [todaySummary, weeklySummary] = await Promise.all([
        this.getTodaySummary(),
        this.getWeeklySummary()
      ])

      return {
        todaySummary: todaySummary.data,
        weeklySummary: weeklySummary.data,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to load fitness dashboard data:', error)
      throw error
    }
  }

  // Calculate calories burned based on exercise and duration
  calculateCaloriesBurned(exercise, durationMinutes) {
    const caloriesPerMinute = exercise.calories_per_minute || 8 // default fallback
    return Math.round(caloriesPerMinute * durationMinutes)
  }
}

// Export singleton instance
export default new FitnessApi()
