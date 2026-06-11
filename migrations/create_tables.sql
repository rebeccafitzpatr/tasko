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

CREATE TABLE IF NOT EXISTS pomodoro_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT,
  skill_id BIGINT,
  duration_minutes INT NOT NULL,
  completed_at DATETIME NOT NULL,
  type ENUM('timer','manual') NOT NULL DEFAULT 'timer',
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
);

-- Optional indexes for performance
CREATE INDEX idx_logs_task ON pomodoro_logs (task_id);
CREATE INDEX idx_logs_skill ON pomodoro_logs (skill_id);
CREATE INDEX idx_logs_completed_at ON pomodoro_logs (completed_at);