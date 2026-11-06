-- Apply once, after 20261105_session_history.sql, before deploying the updated API.
-- Legacy and manual sessions remain nullable and are not assigned invented IDs.
ALTER TABLE pomodoro_logs
  ADD COLUMN completion_id CHAR(36) NULL,
  ADD COLUMN completion_request VARCHAR(255) NULL,
  ADD UNIQUE KEY uq_logs_completion_id (completion_id);
