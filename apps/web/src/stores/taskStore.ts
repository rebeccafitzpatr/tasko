import { defineStore } from 'pinia'
import { useSkillStore } from './skillStore'
import { fetchTasks, createTask, updateTask, deleteTask, addPomodoro } from '../services/service'

export interface Task {
  id: number
  name: string
  skillId?: number | null
  start?: string // ISO date
  end?: string // ISO date
  date?: string // ISO date
  completedPomodoros?: number // Number of completed pomodoros
  minutesSpent?: number // Total minutes spent on this task
  createdAt?: string // ISO date
  updatedAt?: string // ISO date
  skillName?: string // Optional skill name for display purposes
  
}

export interface PomodoroLogEntry {
  taskId: number
  skillId?: number | null
  duration: number // in minutes
  completedAt: string // ISO date string
}


export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
    pomodoroLog: [] as PomodoroLogEntry[],
  }),
  actions: {
    async loadTasks() {
      this.tasks = await fetchTasks();
    },
    async addTask(task: Task) {
      const newTask = await createTask(task.name, task.skillId ?? null);
      this.tasks.push(newTask);
    },
    async updateTask(updated: Task) {
      //const idx = this.tasks.findIndex(t => t.id === updated.id)
      //if (idx !== -1) this.tasks[idx] = { ...updated }
      try {
        const t = await updateTask(updated.id, updated);
        const idx = this.tasks.findIndex(x => x.id === updated.id);
        if (idx !== -1) this.tasks[idx] = t;
      } catch (e) {
        console.error(e);
        // Optional: reconcile with backend to ensure consistency
        await this.loadTasks();
      }
    },
    async deleteTask(id: number) {
      //this.tasks = this.tasks.filter(t => t.id !== id)
      try {
        await deleteTask(id);
        this.tasks = this.tasks.filter(t => t.id !== id);
      } catch (e) {
        console.error(e);
        // Optional: reconcile with backend
        await this.loadTasks();
      }
    },
    async incrementPomodoro(taskId: number, minutes: number) {
      try {
        const task = this.tasks.find(t => t.id === taskId);
        await addPomodoro(taskId, minutes, task?.skillId ?? null);

        // Update local state optimistically (or rely on re-fetch)
        if (task) {
          task.completedPomodoros = (task.completedPomodoros ?? 0) + 1;
          task.minutesSpent = (task.minutesSpent ?? 0) + minutes;
          const skillStore = useSkillStore();
          const skill = skillStore.skills.find(s => s.id === task.skillId);
          if (skill) {
            skill.minutesSpent = (skill.minutesSpent ?? 0) + minutes;
            console.log(`Updated skill ${skill.name}: spent ${skill.minutesSpent} minutes`);
          }

          this.pomodoroLog.push({
            taskId: taskId,
            skillId: task.skillId ?? null,
            duration: minutes,
            completedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error(e);
        // Optional: refresh to reconcile state with backend
        await this.loadTasks();
      }
    },
  },
  persist: true,
})
