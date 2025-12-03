/**
 * Migration: Add all_day and completed_at columns to appointments table
 * Run this script to update existing databases
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../../data/betti.db')
const db = new Database(dbPath)

console.log('🔄 Starting migration: add-appointment-columns')

try {
  // Check if columns already exist
  const tableInfo = db.prepare("PRAGMA table_info(appointments)").all()
  const hasAllDay = tableInfo.some(col => col.name === 'all_day')
  const hasCompletedAt = tableInfo.some(col => col.name === 'completed_at')

  if (hasAllDay && hasCompletedAt) {
    console.log('✅ Columns already exist, no migration needed')
    process.exit(0)
  }

  // Add missing columns
  if (!hasAllDay) {
    console.log('Adding all_day column...')
    db.prepare('ALTER TABLE appointments ADD COLUMN all_day INTEGER DEFAULT 0').run()
  }

  if (!hasCompletedAt) {
    console.log('Adding completed_at column...')
    db.prepare('ALTER TABLE appointments ADD COLUMN completed_at DATETIME').run()
  }

  // Create missing indexes
  console.log('Creating indexes...')

  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status, starts_at)').run()
  } catch (err) {
    if (!err.message.includes('already exists')) {
      throw err
    }
  }

  // Note: Removed idx_appointments_today as SQLite doesn't support
  // non-deterministic functions like date('now') in partial indexes

  console.log('✅ Migration completed successfully')
  db.close()
  process.exit(0)
} catch (error) {
  console.error('❌ Migration failed:', error)
  db.close()
  process.exit(1)
}
