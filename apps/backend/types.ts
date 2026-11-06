export interface Skill {
  id: number
  name: string
  parentId?: number | null
  parentName?: string | null
  minutesSpent?: number
}

export interface Task {
  id: number
  name: string
  skillId?: number | null
  skillPath?: string | null
  parentSkillId?: number | null
  parentSkillName?: string | null
  start?: string | null
  end?: string | null
  date?: string | null
  completedPomodoros?: number
  minutesSpent?: number
}

export interface PomodoroLog {
  parentSkillId?: number | null
  parentSkillName?: string | null
  skillPath?: string | null
  id: number
  taskId?: number | null
  skillId?: number | null
  taskName: string | null
  skillName: string | null
  duration: number
  completedAt: string
  type: 'timer' | 'manual'
}