-- Apply once after both session-history and timer-completion migrations.
-- Existing skills remain standalone; task and log foreign keys are unchanged.
ALTER TABLE skills
  ADD COLUMN parent_id BIGINT NULL,
  ADD CONSTRAINT fk_skills_parent FOREIGN KEY (parent_id) REFERENCES skills(id) ON DELETE RESTRICT;

-- Parent snapshots deliberately have no foreign key: historical grouping survives deletion.
ALTER TABLE pomodoro_logs
  ADD COLUMN parent_skill_id_snapshot BIGINT NULL,
  ADD COLUMN parent_skill_name_snapshot VARCHAR(255) NULL,
  ADD COLUMN skill_path_snapshot VARCHAR(513) NULL;

UPDATE pomodoro_logs pl
LEFT JOIN skills s ON s.id = pl.skill_id
SET pl.skill_path_snapshot = COALESCE(pl.skill_name_snapshot, s.name);
