-- One-time migration for existing installations.
-- Before applying, inspect invalid legacy durations as described in session-history.md.
ALTER TABLE pomodoro_logs
  ADD COLUMN task_name_snapshot VARCHAR(255) NULL,
  ADD COLUMN skill_name_snapshot VARCHAR(255) NULL,
  ADD COLUMN completed_at_is_utc BOOLEAN NOT NULL DEFAULT FALSE;

-- This captures the current labels for records whose foreign keys still resolve.
-- It cannot recover labels from records already detached by a prior deletion.
UPDATE pomodoro_logs pl
LEFT JOIN tasks t ON t.id = pl.task_id
LEFT JOIN skills s ON s.id = pl.skill_id
SET pl.task_name_snapshot = t.name,
    pl.skill_name_snapshot = s.name;

ALTER TABLE pomodoro_logs
  MODIFY COLUMN duration_minutes INT NOT NULL,
  MODIFY COLUMN completed_at DATETIME NOT NULL,
  MODIFY COLUMN type ENUM('timer','manual') NOT NULL,
  ADD CONSTRAINT chk_pomodoro_duration_positive CHECK (duration_minutes > 0);
