/**
 * Recurrence Service
 * Generates recurring appointment instances based on recurrence rules
 */

/**
 * Generate recurring appointment instances
 * @param {Object} appointment - The master appointment with recurrence rule
 * @param {Date} rangeStart - Start of date range to generate instances for
 * @param {Date} rangeEnd - End of date range to generate instances for
 * @param {Object} db - Database connection (optional, for checking completions)
 * @returns {Array} Array of appointment instances
 */
export function generateRecurringInstances(appointment, rangeStart, rangeEnd, db = null) {
  if (!appointment.is_recurring || !appointment.recurrence_rule) {
    return [appointment]
  }

  try {
    const rule = JSON.parse(appointment.recurrence_rule)
    const instances = []

    // Get completions for this recurring appointment if db provided
    let completions = new Set()
    if (db) {
      try {
        const completionRecords = db
          .prepare('SELECT instance_date FROM recurring_appointment_completions WHERE appointment_id = ?')
          .all(appointment.id)
        completions = new Set(completionRecords.map(r => r.instance_date))
      } catch (err) {
        console.warn('Could not fetch completions:', err)
      }
    }

    const startDate = new Date(appointment.starts_at)
    const endDate = appointment.ends_at ? new Date(appointment.ends_at) : null
    const duration = endDate ? endDate.getTime() - startDate.getTime() : 0

    let currentDate = new Date(startDate)
    let count = 0
    const maxCount = rule.count || 365
    const ruleEndDate = rule.endDate ? new Date(rule.endDate) : null

    // Ensure we don't go beyond the range
    if (currentDate > rangeEnd) {
      return []
    }

    while (currentDate <= rangeEnd && count < maxCount) {
      // Check if we've reached the rule's end date
      if (ruleEndDate && currentDate > ruleEndDate) {
        break
      }

      // Check if this date is within our range
      if (currentDate >= rangeStart) {
        // Check if this instance matches the recurrence pattern
        if (shouldIncludeInstance(currentDate, rule, startDate)) {
          const instanceStart = new Date(currentDate)
          const instanceEnd = duration > 0 ? new Date(instanceStart.getTime() + duration) : null
          const instanceDateStr = instanceStart.toISOString().split('T')[0]

          // Check if this instance is completed
          const isCompleted = completions.has(instanceDateStr)

          instances.push({
            ...appointment,
            starts_at: instanceStart.toISOString(),
            ends_at: instanceEnd ? instanceEnd.toISOString() : null,
            is_recurring_instance: true,
            recurring_instance_date: instanceDateStr,
            status: isCompleted ? 'completed' : appointment.status,
            completed_at: isCompleted ? new Date().toISOString() : null
          })

          count++
        }
      }

      // Move to next candidate date based on frequency
      currentDate = getNextCandidateDate(currentDate, rule)

      // Safety check to prevent infinite loops
      if (count > 1000) {
        console.warn('Recurrence generation stopped: too many instances')
        break
      }
    }

    return instances
  } catch (error) {
    console.error('Error generating recurring instances:', error)
    return [appointment]
  }
}

/**
 * Check if an instance should be included based on recurrence rule
 */
function shouldIncludeInstance(date, rule, startDate) {
  const { frequency, daysOfWeek } = rule

  // For weekly recurrence, check if the day of week matches
  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    const dayOfWeek = date.getDay()
    return daysOfWeek.includes(dayOfWeek)
  }

  return true
}

/**
 * Get the next candidate date based on frequency and interval
 */
function getNextCandidateDate(currentDate, rule) {
  const { frequency, interval = 1 } = rule
  const next = new Date(currentDate)

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval)
      break

    case 'weekly':
      // For weekly, advance by one day to check all days of the week
      // The shouldIncludeInstance function will filter the right days
      next.setDate(next.getDate() + 1)
      break

    case 'monthly':
      next.setMonth(next.getMonth() + interval)
      break

    case 'yearly':
      next.setFullYear(next.getFullYear() + interval)
      break

    default:
      // If unknown frequency, just advance by one day to avoid infinite loop
      next.setDate(next.getDate() + 1)
  }

  return next
}

/**
 * Expand recurring appointments in a list
 * @param {Array} appointments - List of appointments (may include recurring)
 * @param {Date} rangeStart - Start of date range
 * @param {Date} rangeEnd - End of date range
 * @param {Object} db - Database connection (optional, for checking completions)
 * @returns {Array} Expanded list with recurring instances
 */
export function expandRecurringAppointments(appointments, rangeStart, rangeEnd, db = null) {
  const expanded = []

  for (const appointment of appointments) {
    if (appointment.is_recurring) {
      const instances = generateRecurringInstances(appointment, rangeStart, rangeEnd, db)
      expanded.push(...instances)
    } else {
      expanded.push(appointment)
    }
  }

  return expanded
}

/**
 * Get the next occurrence of a recurring appointment
 * @param {Object} appointment - The recurring appointment
 * @param {Date} afterDate - Find next occurrence after this date (defaults to now)
 * @returns {Object|null} Next occurrence or null if none
 */
export function getNextOccurrence(appointment, afterDate = new Date()) {
  if (!appointment.is_recurring || !appointment.recurrence_rule) {
    return null
  }

  // Generate instances for the next year
  const rangeEnd = new Date(afterDate)
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 1)

  const instances = generateRecurringInstances(appointment, afterDate, rangeEnd)

  // Return the first instance after the given date
  return instances.find(instance => new Date(instance.starts_at) > afterDate) || null
}

/**
 * Format recurrence rule to human-readable string
 */
export function formatRecurrenceRule(ruleString) {
  if (!ruleString) return ''

  try {
    const rule = JSON.parse(ruleString)
    const { frequency, interval = 1, daysOfWeek, endType, endDate, count } = rule

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    let text = ''

    if (frequency === 'daily') {
      text = interval === 1 ? 'Daily' : `Every ${interval} days`
    } else if (frequency === 'weekly') {
      text = interval === 1 ? 'Weekly' : `Every ${interval} weeks`
      if (daysOfWeek && daysOfWeek.length > 0) {
        const days = daysOfWeek.map(d => dayNames[d]).join(', ')
        text += ` on ${days}`
      }
    } else if (frequency === 'monthly') {
      text = interval === 1 ? 'Monthly' : `Every ${interval} months`
    } else if (frequency === 'yearly') {
      text = interval === 1 ? 'Yearly' : `Every ${interval} years`
    }

    if (endType === 'on_date' && endDate) {
      text += ` until ${new Date(endDate).toLocaleDateString()}`
    } else if (endType === 'after_count' && count) {
      text += `, ${count} times`
    }

    return text
  } catch (error) {
    return ''
  }
}
