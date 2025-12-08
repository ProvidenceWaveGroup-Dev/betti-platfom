// Nutrition API service for communicating with backend

class NutritionApi {
  constructor() {
    // Use relative URL to leverage Vite proxy - works with ngrok
    this.baseUrl = '/api/nutrition'
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
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
      console.error(`Nutrition API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // Get daily nutrition summary
  async getDailySummary(date = null) {
    const params = date ? `?date=${date}` : ''
    return this.request(`/daily${params}`)
  }

  // Log a new meal
  async logMeal(mealType, foods) {
    return this.request('/log-meal', {
      method: 'POST',
      body: JSON.stringify({ mealType, foods })
    })
  }

  // Search foods in database
  async searchFoods(query, limit = 20) {
    const params = new URLSearchParams({ query, limit: limit.toString() })
    return this.request(`/foods?${params}`)
  }

  // Get nutrition goals
  async getNutritionGoals() {
    return this.request('/goals')
  }

  // Update nutrition goals
  async updateNutritionGoals(goals) {
    return this.request('/goals', {
      method: 'PUT',
      body: JSON.stringify(goals)
    })
  }

  // Get nutrition history
  async getNutritionHistory(options = {}) {
    const params = new URLSearchParams()
    if (options.startDate) params.append('startDate', options.startDate)
    if (options.endDate) params.append('endDate', options.endDate)
    if (options.days) params.append('days', options.days.toString())

    const queryString = params.toString()
    return this.request(`/history${queryString ? `?${queryString}` : ''}`)
  }

  // Get a single meal with its foods
  async getMeal(mealId) {
    return this.request(`/meal/${mealId}`)
  }

  // Update an existing meal
  async updateMeal(mealId, mealType, foods) {
    return this.request(`/meal/${mealId}`, {
      method: 'PUT',
      body: JSON.stringify({ mealType, foods })
    })
  }

  // Delete a meal
  async deleteMeal(mealId) {
    return this.request(`/meal/${mealId}`, {
      method: 'DELETE'
    })
  }

  // Get recently used foods
  async getRecentFoods(limit = 10) {
    const params = new URLSearchParams({ limit: limit.toString() })
    return this.request(`/recent-foods?${params}`)
  }

  // Helper method to get all data needed for nutrition component
  async getNutritionDashboardData(date = null) {
    try {
      const [dailySummary, recentFoods] = await Promise.all([
        this.getDailySummary(date),
        this.getRecentFoods(10)
      ])

      return {
        dailySummary: dailySummary.data,
        recentFoods: recentFoods.data,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to load nutrition dashboard data:', error)
      throw error
    }
  }
}

// Export singleton instance
export default new NutritionApi()