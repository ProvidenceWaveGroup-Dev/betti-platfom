/**
 * Migration script to seed workout history from JSON to SQLite
 * Run with: node backend/src/scripts/migrate-fitness-data.js
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import database, { WorkoutRepo } from '../services/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Sample workout data based on fitness-extended.json structure
const workoutHistory = [
  {
    date: '2025-11-18',
    type: 'Strength Training',
    duration: 45,
    caloriesBurned: 320,
    exercises: 6,
    rating: 4.5,
    completed: true
  },
  {
    date: '2025-11-17',
    type: 'Cardio',
    duration: 30,
    caloriesBurned: 280,
    exercises: 1,
    rating: 4.0,
    completed: true
  },
  {
    date: '2025-11-15',
    type: 'Yoga',
    duration: 40,
    caloriesBurned: 120,
    exercises: 8,
    rating: 4.2,
    completed: true
  },
  {
    date: '2025-11-13',
    type: 'HIIT',
    duration: 25,
    caloriesBurned: 340,
    exercises: 5,
    rating: 4.8,
    completed: true
  },
  {
    date: '2025-11-11',
    type: 'Strength Training',
    duration: 50,
    caloriesBurned: 350,
    exercises: 7,
    rating: 4.3,
    completed: true
  },
  {
    date: '2025-11-09',
    type: 'Cardio',
    duration: 35,
    caloriesBurned: 290,
    exercises: 2,
    rating: 3.8,
    completed: true
  },
  {
    date: '2025-11-07',
    type: 'Strength Training',
    duration: 48,
    caloriesBurned: 335,
    exercises: 6,
    rating: 4.4,
    completed: true
  }
]

async function migrateData() {
  console.log('Starting fitness data migration...')

  // Initialize database
  database.init()

  let migrated = 0
  let skipped = 0

  for (const workout of workoutHistory) {
    try {
      // Create workout record
      const result = WorkoutRepo.create({
        user_id: 1,
        workout_type: workout.type,
        duration_min: workout.duration,
        calories_burned: workout.caloriesBurned,
        intensity: workout.type === 'HIIT' ? 'vigorous' :
                   workout.type === 'Yoga' ? 'light' : 'moderate',
        notes: `Migrated from JSON. ${workout.exercises} exercises, rating: ${workout.rating}`,
        started_at: `${workout.date}T09:00:00.000Z`
      })

      console.log(`  Migrated workout: ${workout.type} on ${workout.date} (ID: ${result.id})`)
      migrated++
    } catch (error) {
      console.error(`  Failed to migrate workout: ${workout.date}`, error.message)
      skipped++
    }
  }

  console.log('\n--- Migration Summary ---')
  console.log(`Migrated: ${migrated} workouts`)
  console.log(`Skipped: ${skipped} workouts`)
  console.log('Migration complete!')

  // Close database
  database.close()
}

// Run migration
migrateData().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
