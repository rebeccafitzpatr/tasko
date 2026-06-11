export interface Skill {
  id: number
  name: string
  minutesSpent?: number
}

export interface Task {
  id: number
  name: string
  skillId?: number | null
  start?: string | null
  end?: string | null
  date?: string | null
  completedPomodoros?: number
  minutesSpent?: number
}

export interface PomodoroLog {
  id?: number
  taskId?: number | null
  skillId?: number | null
  duration: number
  completedAt: string
  type?: 'timer' | 'manual'
}