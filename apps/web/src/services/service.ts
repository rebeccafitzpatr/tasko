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
    todayTasks?: number
    weekTasks?: number
    yearTasks?: number
    todayPomodoros?: number
    weekPomodoros?: number
    yearPomodoros?: number
    todayMinutes?: number
    weekMinutes?: number
    yearMinutes?: number
  }>;
};

const API_BASE = import.meta.env.VITE_API_BASE

const TOKEN_KEY = 'tasko-auth-token'

export type AuthUser = { id: number; email: string; displayName: string | null };

export interface AuthSession {
  token: string;
  user: AuthUser;
}

// localStorage/window are absent in some test environments; degrade to "logged out".
function tokenStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function getAuthToken(): string | null {
  return tokenStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function hasAuthToken(): boolean {
  return getAuthToken() !== null;
}

export function setAuthToken(token: string | null): void {
  const storage = tokenStorage();
  if (!storage) return;
  if (token) storage.setItem(TOKEN_KEY, token);
  else storage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}

async function requireOk(res: Response): Promise<void> {
  if (!res.ok) {
    if (res.status === 401) {
      // Expired or missing session: drop the token and let the app redirect to login.
      setAuthToken(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('tasko:unauthorized'));
    }
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

// Auth
export async function registerAccount(email: string, password: string, displayName: string | null): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const session = await handleResponse<AuthSession>(res);
  setAuthToken(session.token);
  return session.user;
}

export async function loginAccount(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await handleResponse<AuthSession>(res);
  setAuthToken(session.token);
  return session.user;
}

export async function logoutAccount(): Promise<void> {
  const token = getAuthToken();
  setAuthToken(null);
  if (!token) return;
  // Best-effort server-side revocation; the local token is already gone.
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Ignore network failures; the token expires server-side regardless.
  }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  const body = await handleResponse<{ user: AuthUser }>(res);
  return body.user;
}

// Skills
export async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch(`${API_BASE}/skills`, { headers: authHeaders() });
  return handleResponse<Skill[]>(res);
}
export async function createSkill(name: string, parentId: number | null = null): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, parentId }),
  });
  return handleResponse<Skill>(res);
}
export async function updateSkill(id: number, name: string, parentId?: number | null): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, parentId }),
  });
  return handleResponse<Skill>(res);
}
export async function updateSkillMinutes(id: number, minutesSpent: number): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ minutesSpent }),
  })
  return handleResponse<Skill>(res)
}
export async function deleteSkill(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE', headers: authHeaders() });
  await requireOk(res);
}

// Tasks
export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`, { headers: authHeaders() });
  return handleResponse<Task[]>(res);
}
export async function createTask(name: string, skillId?: number | null): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, skillId }),
  });
  return handleResponse<Task>(res);
}
export async function updateTask(id: number, payload: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Task>(res);
}
export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: authHeaders() });
  await requireOk(res);
}

// Pomodoro logs
export async function addPomodoro(taskId: number, duration: number, completionId: string): Promise<PomodoroLog> {
  const res = await fetch(`${API_BASE}/pomodoros`, {
    method: 'POST',
    headers: jsonHeaders(),
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
  const res = await fetch(`${API_BASE}/pomodoros?${params}`, { headers: authHeaders() });
  const page = await handleResponse<unknown>(res);
  if (!isSessionPage(page)) {
    throw new Error('Session history response is in an outdated format. Restart or redeploy the backend with the latest code and migrations.');
  }
  return page;
}

export async function fetchActivityPomodoros(): Promise<PomodoroLog[]> {
  const sessions: PomodoroLog[] = []
  let cursor: string | undefined

  while (true) {
    const page = await fetchPomodoros({ limit: 100, cursor })
    sessions.push(...page.items)

    if (!page.hasMore || !page.nextCursor) break
    cursor = page.nextCursor
  }

  return sessions
}

function isSessionPage(value: unknown): value is SessionPage {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as Partial<SessionPage>;
  return Array.isArray(page.items)
    && typeof page.hasMore === 'boolean'
    && (page.nextCursor === null || typeof page.nextCursor === 'string');
}

export async function exportHistory(range: DateRange = {}): Promise<Blob | null> {
  const res = await fetch(`${API_BASE}/pomodoros/export?${rangeParams(range)}`, { headers: authHeaders() });
  await requireOk(res);
  if (res.status === 204) return null;
  return res.blob();
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
    headers: jsonHeaders(),
    body: JSON.stringify({ ...details, type: 'manual' }),
  });
  return handleResponse<PomodoroLog>(res);
}

export async function editSession(id: number, details: SessionDetails): Promise<PomodoroLog> {
  const res = await fetch(`${API_BASE}/pomodoros/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(details),
  });
  return handleResponse<PomodoroLog>(res);
}

// Analytics (optional)
export async function fetchAnalytics(range: DateRange = {}): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/analytics/summary?${rangeParams(range)}`, { headers: authHeaders() });
  return handleResponse<AnalyticsSummary>(res);
}