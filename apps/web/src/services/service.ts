export type Skill = {
  id: number;
  name: string;
  parentId?: number | null;
  parentName?: string | null;
  minutesSpent?: number;
};

export type Task = {
  skillPath?: string | null;
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
  parentSkillId?: number | null;
  parentSkillName?: string | null;
  skillPath?: string | null;
  completionId?: string | null;
  id?: number;
  taskId: number | null;
  skillId: number | null;
  taskName: string | null;
  skillName: string | null;
  duration: number;
  completedAt: string;
  type: 'timer' | 'manual';
};

export type AnalyticsSummary = {
  range?: { start: string | null; end: string | null; timezone: 'UTC'; endInclusive: true };
  totalPomodoros: number;
  totalMinutes?: number;
  totalTasks?: number;
  breakdown?: Array<{
    skillId?: number
    skillName?: string
    parentId?: number | null
    parentName?: string | null
    skillPath?: string
    directPomodoros?: number
    directMinutes?: number
    pomodoros?: number
    minutes?: number
    todayMinutes?: number
    weekMinutes?: number
    yearMinutes?: number
  }>;
};

const API_BASE = import.meta.env.VITE_API_BASE

async function requireOk(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    if (res.headers.get('content-type')?.includes('application/json')) {
      const body: unknown = JSON.parse(text);
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        throw new Error(body.error);
      }
    }
    throw new Error(text || 'API request failed');
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  await requireOk(res);
  return res.json() as Promise<T>;
}

// Skills
export async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch(`${API_BASE}/skills`);
  return handleResponse<Skill[]>(res);
}
export async function createSkill(name: string, parentId: number | null = null): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
  return handleResponse<Skill>(res);
}
export async function updateSkill(id: number, name: string, parentId?: number | null): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
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
  await requireOk(res);
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
  await requireOk(res);
}

// Pomodoro logs
export async function addPomodoro(taskId: number, duration: number, completionId: string): Promise<PomodoroLog> {
  const res = await fetch(`${API_BASE}/pomodoros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, duration, completionId, type: 'timer' }),
  });
  return handleResponse<PomodoroLog>(res);
}
export interface DateRange {
  start?: string;
  end?: string;
}

export interface HistoryOptions extends DateRange {
  limit?: number;
  cursor?: string;
}

export interface SessionPage {
  items: PomodoroLog[];
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

function rangeParams(range: DateRange) {
  const params = new URLSearchParams();
  if (range.start) params.set('start', range.start);
  if (range.end) params.set('end', range.end);
  return params;
}

export async function fetchPomodoros(options: HistoryOptions = {}): Promise<SessionPage> {
  const params = rangeParams(options);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const res = await fetch(`${API_BASE}/pomodoros?${params}`);
  return handleResponse<SessionPage>(res);
}

export interface SessionDetails {
  taskId: number | null;
  skillId: number | null;
  duration: number;
  completedAt: string;
}

export async function createManualSession(details: SessionDetails): Promise<PomodoroLog> {
  const res = await fetch(`${API_BASE}/pomodoros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...details, type: 'manual' }),
  });
  return handleResponse<PomodoroLog>(res);
}

export async function editSession(id: number, details: SessionDetails): Promise<PomodoroLog> {
  const res = await fetch(`${API_BASE}/pomodoros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });
  return handleResponse<PomodoroLog>(res);
}

// Analytics (optional)
export async function fetchAnalytics(range: DateRange = {}): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/analytics/summary?${rangeParams(range)}`);
  return handleResponse<AnalyticsSummary>(res);
}