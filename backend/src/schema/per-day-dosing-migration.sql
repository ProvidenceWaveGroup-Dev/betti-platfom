-- ============================================================================
-- Per-Day Dosing Schema Migration (Option A)
-- Changes to one row per day-time combination for easier querying
-- ============================================================================

-- Add day_of_week column to medication_schedules if it doesn't exist
-- This enables per-day dosing (one row per medication/day/time combination)
ALTER TABLE medication_schedules ADD COLUMN day_of_week TEXT;

-- Create unique index for per-day scheduling
-- Prevents duplicate entries for same medication/day/time
CREATE UNIQUE INDEX IF NOT EXISTS idx_med_schedule_unique
ON medication_schedules(medication_id, day_of_week, schedule_time)
WHERE day_of_week IS NOT NULL AND is_active = 1;

-- Example data structure for Levothyroxine (25mcg weekdays, 50mcg weekends at 7am):
-- medication_id=1, day_of_week='mon', schedule_time='07:00', dosage_amount=25
-- medication_id=1, day_of_week='tue', schedule_time='07:00', dosage_amount=25
-- medication_id=1, day_of_week='wed', schedule_time='07:00', dosage_amount=25
-- medication_id=1, day_of_week='thu', schedule_time='07:00', dosage_amount=25
-- medication_id=1, day_of_week='fri', schedule_time='07:00', dosage_amount=25
-- medication_id=1, day_of_week='sat', schedule_time='07:00', dosage_amount=50
-- medication_id=1, day_of_week='sun', schedule_time='07:00', dosage_amount=50

-- Example for Metformin (500mg twice daily, same every day):
-- medication_id=2, day_of_week='mon', schedule_time='08:00', dosage_amount=500
-- medication_id=2, day_of_week='mon', schedule_time='18:00', dosage_amount=500
-- medication_id=2, day_of_week='tue', schedule_time='08:00', dosage_amount=500
-- medication_id=2, day_of_week='tue', schedule_time='18:00', dosage_amount=500
-- ... (one row for each day x time combination)
