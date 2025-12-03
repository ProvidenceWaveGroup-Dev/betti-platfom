/**
 * Recurrence Types and Utilities
 */

export const RECURRENCE_TYPES = {
  NONE: { value: 'none', label: 'Does not repeat' },
  DAILY: { value: 'daily', label: 'Daily' },
  WEEKLY: { value: 'weekly', label: 'Weekly' },
  MONTHLY: { value: 'monthly', label: 'Monthly' },
  YEARLY: { value: 'yearly', label: 'Yearly' },
  CUSTOM: { value: 'custom', label: 'Custom...' }
}

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
]

export const RECURRENCE_END_TYPES = {
  NEVER: 'never',
  ON_DATE: 'on_date',
  AFTER_COUNT: 'after_count'
}

/**
 * Get recurrence type options for select dropdown
 */
export function getRecurrenceTypeOptions() {
  return Object.values(RECURRENCE_TYPES)
}

/**
 * Parse recurrence rule JSON string
 */
export function parseRecurrenceRule(ruleString) {
  if (!ruleString) return null

  try {
    return JSON.parse(ruleString)
  } catch (err) {
    console.error('Error parsing recurrence rule:', err)
    return null
  }
}

/**
 * Format recurrence rule to human-readable string
 */
export function formatRecurrenceRule(ruleString) {
  const rule = parseRecurrenceRule(ruleString)
  if (!rule) return 'Does not repeat'

  const { frequency, interval = 1, daysOfWeek, endType, endDate, count } = rule

  let text = ''

  // Frequency and interval
  if (frequency === 'daily') {
    text = interval === 1 ? 'Daily' : `Every ${interval} days`
  } else if (frequency === 'weekly') {
    if (interval === 1) {
      text = 'Weekly'
    } else {
      text = `Every ${interval} weeks`
    }

    if (daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = daysOfWeek
        .sort((a, b) => a - b)
        .map(day => DAYS_OF_WEEK[day].short)
      text += ` on ${dayNames.join(', ')}`
    }
  } else if (frequency === 'monthly') {
    text = interval === 1 ? 'Monthly' : `Every ${interval} months`
  } else if (frequency === 'yearly') {
    text = interval === 1 ? 'Yearly' : `Every ${interval} years`
  }

  // End condition
  if (endType === 'on_date' && endDate) {
    const date = new Date(endDate)
    text += ` until ${date.toLocaleDateString()}`
  } else if (endType === 'after_count' && count) {
    text += `, ${count} times`
  }

  return text
}

/**
 * Create a recurrence rule object
 */
export function createRecurrenceRule({
  frequency,
  interval = 1,
  daysOfWeek = [],
  endType = RECURRENCE_END_TYPES.NEVER,
  endDate = null,
  count = null
}) {
  const rule = {
    frequency,
    interval
  }

  if (frequency === 'weekly' && daysOfWeek.length > 0) {
    rule.daysOfWeek = daysOfWeek
  }

  rule.endType = endType

  if (endType === RECURRENCE_END_TYPES.ON_DATE && endDate) {
    rule.endDate = endDate
  } else if (endType === RECURRENCE_END_TYPES.AFTER_COUNT && count) {
    rule.count = count
  }

  return JSON.stringify(rule)
}

/**
 * Validate recurrence rule
 */
export function validateRecurrenceRule(rule) {
  if (!rule.frequency || rule.frequency === 'none') {
    return { valid: true }
  }

  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(rule.frequency)) {
    return { valid: false, error: 'Invalid frequency' }
  }

  if (rule.interval && (rule.interval < 1 || rule.interval > 365)) {
    return { valid: false, error: 'Interval must be between 1 and 365' }
  }

  // Validate weekly recurrence has at least one day selected
  if (rule.frequency === 'weekly') {
    if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) {
      return { valid: false, error: 'Please select at least one day for weekly recurrence' }
    }
  }

  if (rule.endType === RECURRENCE_END_TYPES.ON_DATE && !rule.endDate) {
    return { valid: false, error: 'End date is required' }
  }

  if (rule.endType === RECURRENCE_END_TYPES.AFTER_COUNT) {
    if (!rule.count || rule.count < 1 || rule.count > 365) {
      return { valid: false, error: 'Count must be between 1 and 365' }
    }
  }

  return { valid: true }
}
