CREATE TABLE IF NOT EXISTS skills (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  minutes_spent BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  skill_id BIGINT,
  status ENUM('backlog','active','completed') NOT NULL DEFAULT 'active',
  completed_pomodoros BIGINT NOT NULL DEFAULT 0,
  minutes_spent BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
);

-- Session logs are the source of truth; task/skill minute counters are compatibility caches.
-- Snapshots preserve labels when ON DELETE SET NULL detaches a historical session.
CREATE TABLE IF NOT EXISTS pomodoro_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT,
  skill_id BIGINT,
  task_name_snapshot VARCHAR(255) NULL,
  skill_name_snapshot VARCHAR(255) NULL,
  duration_minutes INT NOT NULL,
  completed_at DATETIME NOT NULL,
  completed_at_is_utc BOOLEAN NOT NULL DEFAULT TRUE,
  type ENUM('timer','manual') NOT NULL,
  CONSTRAINT chk_pomodoro_duration_positive CHECK (duration_minutes > 0),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
);

-- Optional indexes for performance
CREATE INDEX idx_logs_task ON pomodoro_logs (task_id);
CREATE INDEX idx_logs_skill ON pomodoro_logs (skill_id);
CREATE INDEX idx_logs_completed_at ON pomodoro_logs (completed_at);