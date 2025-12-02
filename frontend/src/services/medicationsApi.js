/**
 * Medications API service for communicating with backend
 * Supports complex scheduling: daily, specific_days, interval, PRN
 */

class MedicationsApi {
  constructor() {
    // Determine the backend URL based on environment
    const isNgrok = window.location.hostname.includes('ngrok')
    const isHttps = window.location.protocol === 'https:'

    if (isNgrok || isHttps) {
      // Use Vite proxy (same origin) for ngrok/HTTPS
      this.baseUrl = '/api/medications'
    } else {
      // Direct backend connection for local development
      this.baseUrl = `http://${window.location.hostname}:3001/api/medications`
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
      console.error(`Medications API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // =========================================================================
  // MEDICATION CRUD
  // =========================================================================

  /**
   * Get all medications for user
   * @param {boolean} activeOnly - Only return active medications (default true)
   */
  async getMedications(activeOnly = true) {
    return this.request(`?activeOnly=${activeOnly}`)
  }

  /**
   * Get a single medication by ID with schedules
   */
  async getMedication(id) {
    return this.request(`/${id}`)
  }

  /**
   * Create a new medication with schedules
   * @param {Object} medicationData - Medication details
   * @param {Array} schedules - Schedule configurations
   *
   * medicationData: { name, dosage, dosage_unit, instructions, is_prn, prn_max_daily,
   *                   prescriber, pharmacy, rx_number, refills_left, start_date, end_date, notes }
   *
   * schedules: [{ schedule_time: "08:00", dosage_amount: 1, frequency_type: "daily",
   *               days_of_week: "mon,tue", interval_days: 2, interval_start: "2025-12-01" }]
   */
  async createMedication(medicationData, schedules = []) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({ ...medicationData, schedules })
    })
  }

  /**
   * Update a medication and its schedules
   */
  async updateMedication(id, data) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  /**
   * Delete (deactivate) a medication
   */
  async deleteMedication(id) {
    return this.request(`/${id}`, {
      method: 'DELETE'
    })
  }

  // =========================================================================
  // TODAY'S SCHEDULE
  // =========================================================================

  /**
   * Get today's schedule with status
   * Returns: { scheduled: [...], prn: [...] }
   */
  async getTodaySchedule() {
    return this.request('/today')
  }

  /**
   * Get today's medications transformed for frontend display
   * Returns combined scheduled and PRN medications
   */
  async getTodayMedications() {
    try {
      const response = await this.getTodaySchedule()
      if (response.success && response.data) {
        const { scheduled, prn } = response.data

        // Transform scheduled medications
        const scheduledMeds = scheduled.map(item => ({
          id: `${item.medication_id}_${item.schedule_id}`,
          medicationId: item.medication_id,
          scheduleId: item.schedule_id,
          name: item.medication_name,
          dosage: item.dosage,
          dosageUnit: item.dosage_unit,
          dosageAmount: item.dosage_amount,
          time: item.scheduled_time,
          taken: item.status === 'taken',
          skipped: item.status === 'skipped',
          late: item.status === 'late',
          status: item.status,
          type: this.inferType(item.medication_name, item.dosage),
          instructions: item.instructions,
          takenAt: item.taken_at,
          frequencyType: item.frequency_type,
          isPrn: false
        }))

        // Transform PRN medications
        const prnMeds = prn.map(item => ({
          id: `prn_${item.medication_id}`,
          medicationId: item.medication_id,
          name: item.medication_name,
          dosage: item.dosage,
          dosageUnit: item.dosage_unit,
          instructions: item.instructions,
          type: this.inferType(item.medication_name, item.dosage),
          isPrn: true,
          prnMaxDaily: item.prn_max_daily,
          dosesTakenToday: item.doses_taken_today,
          canTakeMore: item.can_take_more,
          notes: item.notes
        }))

        return {
          success: true,
          data: {
            scheduled: scheduledMeds,
            prn: prnMeds,
            all: [...scheduledMeds, ...prnMeds]
          },
          date: response.date
        }
      }
      return response
    } catch (error) {
      console.error('Failed to get today\'s medications:', error)
      throw error
    }
  }

  /**
   * Get medication overview with weekly schedules
   * Returns all medications with full weekly schedule grid
   */
  async getOverview() {
    return this.request('/overview')
  }

  /**
   * Get medication overview transformed for frontend display
   * Returns medications with weekly_schedule, schedule_type, and today_summary
   */
  async getMedicationOverview() {
    try {
      const response = await this.getOverview()
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
          date: response.date
        }
      }
      return response
    } catch (error) {
      console.error('Failed to get medication overview:', error)
      throw error
    }
  }

  // =========================================================================
  // MEDICATION ACTIONS
  // =========================================================================

  /**
   * Mark medication as taken
   * @param {number} medicationId - Medication ID
   * @param {number|null} scheduleId - Schedule ID (null for PRN)
   * @param {Object} options - { dosage_amount?, notes? }
   */
  async markTaken(medicationId, scheduleId = null, options = {}) {
    return this.request(`/${medicationId}/take`, {
      method: 'POST',
      body: JSON.stringify({ scheduleId, ...options })
    })
  }

  /**
   * Mark medication as skipped
   * @param {number} medicationId - Medication ID
   * @param {number|null} scheduleId - Schedule ID
   * @param {string|null} reason - Reason for skipping
   */
  async markSkipped(medicationId, scheduleId = null, reason = null) {
    return this.request(`/${medicationId}/skip`, {
      method: 'POST',
      body: JSON.stringify({ scheduleId, reason })
    })
  }

  // =========================================================================
  // SCHEDULE MANAGEMENT
  // =========================================================================

  /**
   * Update medication schedule using per-day format
   * @param {number} medicationId - Medication ID
   * @param {Array} schedules - Array of { time, doses: { mon, tue, wed, thu, fri, sat, sun } }
   *
   * Example:
   * [
   *   { time: "07:00", doses: { mon: 25, tue: 25, wed: 25, thu: 25, fri: 25, sat: 50, sun: 50 } },
   *   { time: "18:00", doses: { mon: 500, tue: 500, wed: 500, thu: 500, fri: 500, sat: 500, sun: 500 } }
   * ]
   */
  async updateSchedule(medicationId, schedules) {
    return this.request(`/${medicationId}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedules })
    })
  }

  // =========================================================================
  // HISTORY & STATISTICS
  // =========================================================================

  /**
   * Get medication history
   * @param {number} medicationId - Medication ID
   * @param {number} days - Number of days (default 30)
   */
  async getMedicationHistory(medicationId, days = 30) {
    return this.request(`/${medicationId}/history?days=${days}`)
  }

  /**
   * Get adherence statistics
   * @param {number} days - Number of days to analyze (default 7)
   */
  async getAdherenceStats(days = 7) {
    return this.request(`/adherence?days=${days}`)
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Infer medication type from name/dosage for icon display
   */
  inferType(name, dosage) {
    const nameLower = (name || '').toLowerCase()
    const dosageLower = (dosage || '').toLowerCase()

    if (nameLower.includes('vitamin') || nameLower.includes('multi')) {
      return 'vitamin'
    }
    if (nameLower.includes('supplement') || nameLower.includes('omega') ||
        nameLower.includes('probiotic') || nameLower.includes('fiber')) {
      return 'supplement'
    }
    if (nameLower.includes('pain') || nameLower.includes('ibuprofen') ||
        nameLower.includes('acetaminophen') || nameLower.includes('aspirin')) {
      return 'pain_relief'
    }
    // Default to prescription for anything else
    return 'prescription'
  }

  /**
   * Format time from 24h to 12h format
   */
  formatTime(time) {
    if (!time) return ''
    const [hour, minute] = time.split(':').map(Number)
    const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`
  }

  /**
   * Get frequency type label
   */
  getFrequencyLabel(frequencyType, daysOfWeek, intervalDays) {
    switch (frequencyType) {
      case 'daily':
        return 'Daily'
      case 'specific_days':
        if (daysOfWeek === 'mon,tue,wed,thu,fri') return 'Weekdays'
        if (daysOfWeek === 'sat,sun') return 'Weekends'
        return this.formatDaysOfWeek(daysOfWeek)
      case 'interval':
        if (intervalDays === 2) return 'Every other day'
        return `Every ${intervalDays} days`
      case 'prn':
        return 'As needed'
      default:
        return frequencyType
    }
  }

  /**
   * Format days of week for display
   */
  formatDaysOfWeek(days) {
    if (!days || days === 'daily') return 'Daily'
    const dayMap = {
      'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
      'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
    }
    return days.split(',').map(d => dayMap[d.trim()] || d).join(', ')
  }

  /**
   * Get icon for medication type
   */
  getMedIcon(type) {
    const icons = {
      prescription: '💊',
      vitamin: '🟡',
      supplement: '🟢',
      pain_relief: '💉'
    }
    return icons[type] || '💊'
  }

  /**
   * Get color for medication type
   */
  getMedTypeColor(type) {
    const colors = {
      prescription: '#8b5cf6',
      vitamin: '#f59e0b',
      supplement: '#22c55e',
      pain_relief: '#ef4444'
    }
    return colors[type] || '#6b7280'
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    const colors = {
      taken: '#22c55e',
      pending: '#6b7280',
      late: '#ef4444',
      skipped: '#f59e0b'
    }
    return colors[status] || '#6b7280'
  }

  /**
   * Get status label
   */
  getStatusLabel(status) {
    const labels = {
      taken: 'Taken',
      pending: 'Pending',
      late: 'Late',
      skipped: 'Skipped'
    }
    return labels[status] || status
  }
}

// Export singleton instance
export default new MedicationsApi()
