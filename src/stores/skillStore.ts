import { defineStore } from 'pinia'

export interface Skill {
  id: string
  name: string
}

export const useSkillStore = defineStore('skill', {
  state: () => ({
    skills: [] as Skill[],
  }),
  actions: {
    addSkill(skill: Skill) {
      this.skills.push(skill)
    },
    updateSkill(updated: Skill) {
      const idx = this.skills.findIndex(s => s.id === updated.id)
      if (idx !== -1) this.skills[idx] = updated
    },
    deleteSkill(id: string) {
      this.skills = this.skills.filter(s => s.id !== id)
    },
  },
})
