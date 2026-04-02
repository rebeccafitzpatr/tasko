import { defineStore } from 'pinia'

export interface Skill {
  id: string
  name: string
  minutesSpent?: number // Total minutes spent on this skill
}

export const useSkillStore = defineStore('skill', {
  state: () => ({
    skills: [] as Skill[],
  }),
  actions: {
    addSkill(skill: Skill) {
      this.skills.push({ ...skill, minutesSpent: skill.minutesSpent ?? 0 })
    },
    incrementSkillTime(skillId: string, minutes: number) {
      const skill = this.skills.find(s => s.id === skillId)
      if (skill) {
        skill.minutesSpent = (skill.minutesSpent ?? 0) + minutes
      }
    },
    updateSkill(updated: Skill) {
      const idx = this.skills.findIndex(s => s.id === updated.id)
      if (idx !== -1) this.skills[idx] = updated
    },
    deleteSkill(id: string) {
      this.skills = this.skills.filter(s => s.id !== id)
    },
  },
  persist: true,
})
