export type Skill = {
  id: number;
  name: string;
  minutesSpent?: number;
};

export type Task = {
  id: number;
  name: string;
  skillId?: number | null;
  status?: string;
  completedPomodoros?: number;
  minutesSpent?: number;
  createdAt?: string;
  updatedAt?: string;
  skillName?: string;
};

export type PomodoroLog = {
  id?: number;
  taskId?: number | null;
  skillId?: number | null;
  duration?: number;
  durationMinutes?: number;
  completedAt?: string;
  type?: string;
};

const API_BASE = '/api'; // or 'http://localhost:3000/api' if not using a proxy

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'API request failed');
  }
  return res.json() as Promise<T>;
}

// Skills
export async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch(`${API_BASE}/skills`);
  return handleResponse<Skill[]>(res);
}
export async function createSkill(name: string): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return handleResponse<Skill>(res);
}
export async function updateSkill(id: number, name: string): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return handleResponse<Skill>(res);
}
export async function updateSkillMinutes(id: number, minutesSpent: number): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutesSpent }),
  })
  return handleResponse<Skill>(res)
}
export async function deleteSkill(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

// Tasks
export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`);
  return handleResponse<Task[]>(res);
}
export async function createTask(name: string, skillId?: number | null): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, skillId }),
  });
  return handleResponse<Task>(res);
}
export async function updateTask(id: number, payload: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Task>(res);
}
export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

// Pomodoro logs
export async function addPomodoro(taskId: number, duration: number, skillId?: number | null): Promise<{ taskId: number; duration: number }> {
  const res = await fetch(`${API_BASE}/pomodoros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, duration, skillId }),
  });
  return handleResponse<{ taskId: number; duration: number }>(res);
}
export async function fetchPomodoros(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/pomodoros`);
  return handleResponse<any[]>(res);
}

// Analytics (optional)
export async function fetchAnalytics(): Promise<{ totalPomodoros: number; totalMinutes: number }> {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  return handleResponse<{ totalPomodoros: number; totalMinutes: number }>(res);
}