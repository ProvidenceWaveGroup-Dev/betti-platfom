-- ============================================================================
-- Betti Smart Mirror Hub - SQLite Database Schema
-- Version: 1.0.0
-- Created: December 1, 2025
-- ============================================================================
-- 
-- Design Principles:
--   1. Local-first: All data stored on-device, no cloud dependency
--   2. Privacy: Sensitive health data never leaves the device unless explicitly synced
--   3. Reliability: ACID compliance for elder care critical data
--   4. Performance: Proper indexing for historical queries and daily summaries
--   5. Flexibility: JSON columns for extensible device-specific data
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;  -- Better concurrent read/write performance
PRAGMA synchronous = NORMAL; -- Good balance of safety and speed

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- User profiles (supports multiple users per mirror, e.g., couple)
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    date_of_birth   DATE,
    avatar_emoji    TEXT DEFAULT '👤',
    is_primary      INTEGER DEFAULT 0,  -- Primary user shown by default
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User-specific settings and preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key     TEXT NOT NULL,
    setting_value   TEXT,  -- JSON for complex values
    UNIQUE(user_id, setting_key)
);

-- ============================================================================
-- VITAL SIGNS / HEALTH METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vital_readings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vital_type      TEXT NOT NULL,  -- 'blood_pressure', 'heart_rate', 'spo2', 'temperature', 'weight', 'glucose'
    value_primary   REAL NOT NULL,  -- Main value (systolic, bpm, %, °F, lbs, mg/dL)
    value_secondary REAL,           -- Secondary value (diastolic for BP)
    unit            TEXT NOT NULL,  -- 'mmHg', 'bpm', '%', '°F', 'lbs', 'mg/dL'
    status          TEXT,           -- 'normal', 'high', 'low', 'critical'
    source          TEXT,           -- 'manual', 'ble_device', device UUID
    notes           TEXT,
    recorded_at     DATETIME NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vitals_user_type_date ON vital_readings(user_id, vital_type, recorded_at DESC);
CREATE INDEX idx_vitals_recorded ON vital_readings(recorded_at DESC);

-- ============================================================================
-- NUTRITION TRACKING
-- ============================================================================

-- Food database (searchable catalog)
CREATE TABLE IF NOT EXISTS foods (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    category        TEXT,           -- 'meat', 'vegetable', 'grain', 'dairy', 'fruit', etc.
    calories        REAL DEFAULT 0,
    protein         REAL DEFAULT 0,
    carbs           REAL DEFAULT 0,
    fat             REAL DEFAULT 0,
    fiber           REAL DEFAULT 0,
    sodium          REAL DEFAULT 0,
    serving_size    REAL DEFAULT 1,
    serving_unit    TEXT DEFAULT 'serving',
    is_custom       INTEGER DEFAULT 0,  -- User-added vs. pre-loaded
    created_by      INTEGER REFERENCES users(id),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_category ON foods(category);

-- Meals logged by users
CREATE TABLE IF NOT EXISTS meals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_date       DATE NOT NULL,
    meal_type       TEXT NOT NULL,  -- 'breakfast', 'lunch', 'dinner', 'snack'
    meal_time       TEXT,           -- '9:30 AM' format for display
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meals_user_date ON meals(user_id, meal_date DESC);

-- Individual food items within a meal
CREATE TABLE IF NOT EXISTS meal_foods (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id         INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    food_id         INTEGER REFERENCES foods(id),
    food_name       TEXT NOT NULL,  -- Denormalized for display (in case food is deleted)
    quantity        REAL DEFAULT 1,
    unit            TEXT DEFAULT 'serving',
    calories        REAL DEFAULT 0,
    protein         REAL DEFAULT 0,
    carbs           REAL DEFAULT 0,
    fat             REAL DEFAULT 0,
    fiber           REAL DEFAULT 0,
    sodium          REAL DEFAULT 0
);

CREATE INDEX idx_meal_foods_meal ON meal_foods(meal_id);

-- Nutrition goals per user
CREATE TABLE IF NOT EXISTS nutrition_goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calories        INTEGER DEFAULT 2000,
    protein         INTEGER DEFAULT 100,
    carbs           INTEGER DEFAULT 250,
    fat             INTEGER DEFAULT 65,
    fiber           INTEGER DEFAULT 25,
    sodium          INTEGER DEFAULT 2300,
    effective_date  DATE DEFAULT CURRENT_DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, effective_date)
);

-- Recently used foods for quick access (per user)
CREATE TABLE IF NOT EXISTS recent_foods (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id         INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    use_count       INTEGER DEFAULT 1,
    last_used       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, food_id)
);

-- ============================================================================
-- MEDICATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS medications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    dosage          TEXT,           -- '10mg', '2 tablets', etc.
    dosage_unit     TEXT DEFAULT 'tablet',  -- mg, mcg, ml, tablet, capsule, etc.
    instructions    TEXT,           -- 'Take with food', 'Take on empty stomach'
    prescriber      TEXT,
    pharmacy        TEXT,
    rx_number       TEXT,
    refills_left    INTEGER,
    start_date      DATE,
    end_date        DATE,           -- NULL if ongoing
    is_active       INTEGER DEFAULT 1,
    is_prn          INTEGER DEFAULT 0,  -- 1 = "as needed" medication
    prn_max_daily   INTEGER,        -- Max doses per day if PRN
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_medications_user ON medications(user_id, is_active);

-- Medication schedules with variable dosing support
CREATE TABLE IF NOT EXISTS medication_schedules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id   INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    dosage_amount   REAL DEFAULT 1,         -- e.g., 25, 50, 1.5
    schedule_time   TEXT NOT NULL,          -- '08:00' (24hr format)

    -- Frequency type determines which fields are used
    frequency_type  TEXT NOT NULL DEFAULT 'daily',
    -- Options: 'daily', 'specific_days', 'interval', 'prn'

    -- For 'specific_days': comma-separated days
    days_of_week    TEXT DEFAULT 'daily',   -- 'mon,tue,wed,thu,fri' or 'sat,sun'

    -- For 'interval': every N days
    interval_days   INTEGER,                -- e.g., 2 = every other day
    interval_start  DATE,                   -- Reference date for interval calculation

    is_active       INTEGER DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_med_schedules_med ON medication_schedules(medication_id, is_active);

-- Medication adherence log
CREATE TABLE IF NOT EXISTS medication_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id   INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    schedule_id     INTEGER REFERENCES medication_schedules(id),
    scheduled_date  DATE NOT NULL,
    scheduled_time  TEXT,
    status          TEXT DEFAULT 'pending',  -- 'pending', 'taken', 'skipped', 'late'
    taken_at        DATETIME,
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_med_log_date ON medication_log(medication_id, scheduled_date DESC);

-- ============================================================================
-- HYDRATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS hydration_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_oz       REAL NOT NULL,
    beverage_type   TEXT DEFAULT 'water',  -- 'water', 'coffee', 'tea', 'juice', etc.
    recorded_at     DATETIME NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hydration_user_date ON hydration_log(user_id, date(recorded_at) DESC);

-- Daily hydration goals
CREATE TABLE IF NOT EXISTS hydration_goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_goal_oz   INTEGER DEFAULT 64,  -- 8 glasses
    effective_date  DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, effective_date)
);

-- ============================================================================
-- FITNESS / ACTIVITY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS workouts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_type    TEXT NOT NULL,  -- 'walking', 'strength', 'yoga', 'swimming', etc.
    duration_min    INTEGER,
    calories_burned INTEGER,
    distance_miles  REAL,
    steps           INTEGER,
    heart_rate_avg  INTEGER,
    heart_rate_max  INTEGER,
    intensity       TEXT,           -- 'light', 'moderate', 'vigorous'
    video_id        TEXT,           -- YouTube video ID if following a video
    notes           TEXT,
    started_at      DATETIME NOT NULL,
    ended_at        DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at DESC);

-- Daily activity summary (steps, active minutes from wearables)
CREATE TABLE IF NOT EXISTS daily_activity (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date   DATE NOT NULL,
    steps           INTEGER DEFAULT 0,
    active_minutes  INTEGER DEFAULT 0,
    calories_burned INTEGER DEFAULT 0,
    floors_climbed  INTEGER DEFAULT 0,
    distance_miles  REAL DEFAULT 0,
    source          TEXT,           -- 'manual', 'ble_device', device name
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date)
);

CREATE INDEX idx_daily_activity_date ON daily_activity(user_id, activity_date DESC);

-- ============================================================================
-- APPOINTMENTS / CALENDAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    location        TEXT,
    appointment_type TEXT DEFAULT 'personal',          -- 'doctor', 'therapy', 'lab', 'dental', 'vision', 'pharmacy', 'exercise', 'social', 'personal', 'other'
    provider_name   TEXT,
    provider_phone  TEXT,
    starts_at       DATETIME NOT NULL,
    ends_at         DATETIME,
    all_day         INTEGER DEFAULT 0,         -- 1 = all-day event
    reminder_min    INTEGER DEFAULT 60,  -- Minutes before to remind
    is_recurring    INTEGER DEFAULT 0,
    recurrence_rule TEXT,           -- iCal RRULE format
    status          TEXT DEFAULT 'scheduled',  -- 'scheduled', 'completed', 'cancelled', 'missed'
    completed_at    DATETIME,                  -- When marked complete
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointments_user_date ON appointments(user_id, starts_at);
CREATE INDEX idx_appointments_upcoming ON appointments(starts_at) WHERE status = 'scheduled';
CREATE INDEX idx_appointments_status ON appointments(status, starts_at);

-- Add missing columns to existing appointments table (migration-safe)
-- SQLite doesn't have IF NOT EXISTS for columns, so we use conditional logic in the app
-- These are here for reference and will be handled by the app on startup

-- ============================================================================
-- BLE DEVICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ble_devices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address     TEXT NOT NULL UNIQUE,  -- 'A1:B2:C3:D4:E5:F6' format
    mac_normalized  TEXT NOT NULL,         -- 'a1b2c3d4e5f6' for lookups
    name            TEXT,
    device_type     TEXT,                  -- 'heart_rate', 'blood_pressure', 'scale', 'unknown'
    manufacturer    TEXT,
    is_paired       INTEGER DEFAULT 0,
    is_trusted      INTEGER DEFAULT 0,     -- Auto-connect when seen
    assigned_user   INTEGER REFERENCES users(id),
    last_rssi       INTEGER,
    last_seen       DATETIME,
    config_json     TEXT,                  -- Device-specific config
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ble_devices_mac ON ble_devices(mac_normalized);
CREATE INDEX idx_ble_devices_type ON ble_devices(device_type);

-- BLE scan history (for debugging/analysis)
CREATE TABLE IF NOT EXISTS ble_scan_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       INTEGER REFERENCES ble_devices(id),
    mac_address     TEXT NOT NULL,
    name            TEXT,
    rssi            INTEGER,
    scanned_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ble_scan_date ON ble_scan_log(scanned_at DESC);

-- Automatically clean up old scan logs (keep 7 days)
-- Run periodically: DELETE FROM ble_scan_log WHERE scanned_at < datetime('now', '-7 days');

-- ============================================================================
-- EMERGENCY CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    relationship    TEXT,           -- 'spouse', 'child', 'caregiver', 'doctor', etc.
    phone_primary   TEXT,
    phone_secondary TEXT,
    email           TEXT,
    is_primary      INTEGER DEFAULT 0,  -- First to call
    notify_on_alert INTEGER DEFAULT 1,  -- Include in emergency alerts
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);

-- ============================================================================
-- ALERTS / NOTIFICATIONS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id),
    alert_type      TEXT NOT NULL,  -- 'medication_reminder', 'vital_warning', 'fall_detected', 'appointment'
    severity        TEXT DEFAULT 'info',  -- 'info', 'warning', 'critical'
    title           TEXT NOT NULL,
    message         TEXT,
    source          TEXT,           -- 'system', 'ble_device', device name
    acknowledged    INTEGER DEFAULT 0,
    acknowledged_at DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_user_date ON alerts(user_id, created_at DESC);
CREATE INDEX idx_alerts_unacked ON alerts(user_id, acknowledged) WHERE acknowledged = 0;

-- ============================================================================
-- VIDEO CALLS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_calls (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id),
    contact_id      INTEGER REFERENCES emergency_contacts(id),
    contact_name    TEXT,           -- Denormalized
    room_id         TEXT,
    direction       TEXT,           -- 'incoming', 'outgoing'
    status          TEXT,           -- 'completed', 'missed', 'declined'
    duration_sec    INTEGER,
    started_at      DATETIME,
    ended_at        DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_calls_user ON video_calls(user_id, started_at DESC);

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

-- Key-value store for system config
CREATE TABLE IF NOT EXISTS system_config (
    key             TEXT PRIMARY KEY,
    value           TEXT,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync status for optional cloud backup
CREATE TABLE IF NOT EXISTS sync_status (
    table_name      TEXT PRIMARY KEY,
    last_sync       DATETIME,
    last_change     DATETIME,
    sync_enabled    INTEGER DEFAULT 0
);

-- Database version for migrations
INSERT OR IGNORE INTO system_config (key, value) VALUES ('schema_version', '1.0.0');
INSERT OR IGNORE INTO system_config (key, value) VALUES ('created_at', datetime('now'));

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Today's nutrition summary
CREATE VIEW IF NOT EXISTS v_daily_nutrition AS
SELECT 
    m.user_id,
    m.meal_date,
    COUNT(DISTINCT m.id) as meal_count,
    COALESCE(SUM(mf.calories), 0) as total_calories,
    COALESCE(SUM(mf.protein), 0) as total_protein,
    COALESCE(SUM(mf.carbs), 0) as total_carbs,
    COALESCE(SUM(mf.fat), 0) as total_fat,
    COALESCE(SUM(mf.fiber), 0) as total_fiber,
    COALESCE(SUM(mf.sodium), 0) as total_sodium
FROM meals m
LEFT JOIN meal_foods mf ON m.id = mf.meal_id
GROUP BY m.user_id, m.meal_date;

-- Today's hydration summary
CREATE VIEW IF NOT EXISTS v_daily_hydration AS
SELECT 
    user_id,
    date(recorded_at) as hydration_date,
    SUM(amount_oz) as total_oz,
    COUNT(*) as drink_count
FROM hydration_log
GROUP BY user_id, date(recorded_at);

-- Pending medications for today (with complex schedule support)
CREATE VIEW IF NOT EXISTS v_pending_medications AS
SELECT
    ml.id,
    ml.medication_id,
    m.user_id,
    m.name as medication_name,
    m.dosage,
    m.dosage_unit,
    m.instructions,
    m.is_prn,
    m.prn_max_daily,
    ms.id as schedule_id,
    ms.schedule_time,
    ms.dosage_amount,
    ms.frequency_type,
    ms.days_of_week,
    ms.interval_days,
    ms.interval_start,
    ml.scheduled_date,
    ml.status
FROM medication_log ml
JOIN medications m ON ml.medication_id = m.id
LEFT JOIN medication_schedules ms ON ml.schedule_id = ms.id
WHERE ml.status = 'pending'
  AND ml.scheduled_date = date('now')
ORDER BY ms.schedule_time;

-- Latest vitals per type per user
CREATE VIEW IF NOT EXISTS v_latest_vitals AS
SELECT 
    vr.*
FROM vital_readings vr
INNER JOIN (
    SELECT user_id, vital_type, MAX(recorded_at) as max_recorded
    FROM vital_readings
    GROUP BY user_id, vital_type
) latest ON vr.user_id = latest.user_id 
        AND vr.vital_type = latest.vital_type 
        AND vr.recorded_at = latest.max_recorded;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Create a default user if none exists
INSERT OR IGNORE INTO users (id, name, is_primary) VALUES (1, 'User', 1);

-- Default nutrition goals
INSERT OR IGNORE INTO nutrition_goals (user_id, calories, protein, carbs, fat, fiber, sodium)
VALUES (1, 2000, 100, 250, 65, 25, 2300);

-- Default hydration goal
INSERT OR IGNORE INTO hydration_goals (user_id, daily_goal_oz)
VALUES (1, 64);
