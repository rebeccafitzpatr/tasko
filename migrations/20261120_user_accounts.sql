-- User accounts: run after 20261106_skill_hierarchy.sql, before deploying the updated API/client.
-- Existing rows keep user_id NULL; the first account to register claims them automatically.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Opaque bearer tokens; only the SHA-256 hash of a token is stored.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE skills
  ADD COLUMN user_id BIGINT NULL,
  ADD CONSTRAINT fk_skills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Skill names are now unique per user instead of globally.
ALTER TABLE skills DROP INDEX name;
ALTER TABLE skills ADD UNIQUE KEY uq_skills_user_name (user_id, name);

ALTER TABLE tasks
  ADD COLUMN user_id BIGINT NULL,
  ADD CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE pomodoro_logs
  ADD COLUMN user_id BIGINT NULL,
  ADD CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_user ON tasks (user_id);
CREATE INDEX idx_logs_user ON pomodoro_logs (user_id);
CREATE INDEX idx_tokens_expires ON auth_tokens (expires_at);
