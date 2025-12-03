/**
 * Appointment Type Definitions
 * Maps appointment types to visual indicators (icons, colors, labels)
 */

export const APPOINTMENT_TYPES = {
  doctor: {
    icon: '🩺',
    color: '#ef4444',
    label: 'Doctor',
    category: 'medical'
  },
  therapy: {
    icon: '🧠',
    color: '#a855f7',
    label: 'Therapy',
    category: 'medical'
  },
  lab: {
    icon: '🧪',
    color: '#f97316',
    label: 'Lab Work',
    category: 'medical'
  },
  dental: {
    icon: '🦷',
    color: '#06b6d4',
    label: 'Dental',
    category: 'medical'
  },
  vision: {
    icon: '👁️',
    color: '#3b82f6',
    label: 'Vision',
    category: 'medical'
  },
  pharmacy: {
    icon: '💊',
    color: '#22c55e',
    label: 'Pharmacy',
    category: 'medical'
  },
  exercise: {
    icon: '🏃',
    color: '#eab308',
    label: 'Exercise',
    category: 'wellness'
  },
  social: {
    icon: '👥',
    color: '#ec4899',
    label: 'Social',
    category: 'personal'
  },
  personal: {
    icon: '📌',
    color: '#6366f1',
    label: 'Personal',
    category: 'personal'
  },
  other: {
    icon: '📅',
    color: '#64748b',
    label: 'Other',
    category: 'other'
  }
}

/**
 * Get appointment type info
 * @param {string} type - Appointment type key
 * @returns {Object} Type info with icon, color, label
 */
export function getAppointmentType(type) {
  return APPOINTMENT_TYPES[type] || APPOINTMENT_TYPES.other
}

/**
 * Get all appointment types as array for dropdowns
 * @returns {Array} Array of {value, label, icon, color}
 */
export function getAppointmentTypeOptions() {
  return Object.entries(APPOINTMENT_TYPES).map(([value, info]) => ({
    value,
    label: info.label,
    icon: info.icon,
    color: info.color
  }))
}

/**
 * Format appointment status for display
 * @param {string} status - Status value
 * @returns {Object} Status display info
 */
export function getStatusInfo(status) {
  const statusMap = {
    scheduled: {
      label: 'Scheduled',
      color: '#4a9eff',
      icon: '○'
    },
    completed: {
      label: 'Completed',
      color: '#4ade80',
      icon: '✓'
    },
    cancelled: {
      label: 'Cancelled',
      color: '#f87171',
      icon: '✕'
    },
    missed: {
      label: 'Missed',
      color: '#fb923c',
      icon: '!'
    }
  }

  return statusMap[status] || statusMap.scheduled
}

/**
 * Reminder options for dropdowns
 */
export const REMINDER_OPTIONS = [
  { value: 0, label: 'No reminder' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' }
]
