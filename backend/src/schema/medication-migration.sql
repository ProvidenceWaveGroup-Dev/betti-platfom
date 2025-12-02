-- ============================================================================
-- Medication Schema Migration
-- Adds support for complex scheduling patterns
-- ============================================================================

-- Add new columns to medications table for PRN support
ALTER TABLE medications ADD COLUMN dosage_unit TEXT DEFAULT 'tablet';
ALTER TABLE medications ADD COLUMN start_date DATE;
ALTER TABLE medications ADD COLUMN end_date DATE;
ALTER TABLE medications ADD COLUMN is_prn INTEGER DEFAULT 0;
ALTER TABLE medications ADD COLUMN prn_max_daily INTEGER;
ALTER TABLE medications ADD COLUMN notes TEXT;

-- Add new columns to medication_schedules for variable dosing
ALTER TABLE medication_schedules ADD COLUMN dosage_amount REAL DEFAULT 1;
ALTER TABLE medication_schedules ADD COLUMN frequency_type TEXT DEFAULT 'daily';
ALTER TABLE medication_schedules ADD COLUMN interval_days INTEGER;
ALTER TABLE medication_schedules ADD COLUMN interval_start DATE;
ALTER TABLE medication_schedules ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Create index for efficient schedule lookups
CREATE INDEX IF NOT EXISTS idx_med_schedules_med ON medication_schedules(medication_id, is_active);

-- Update v_pending_medications view to include new fields
DROP VIEW IF EXISTS v_pending_medications;
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
