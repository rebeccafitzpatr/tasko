import { defineStore } from 'pinia'
import { fetchSkills, createSkill, updateSkill, deleteSkill } from '../services/service'

export interface Skill {
  id: number
  name: string
  minutesSpent?: number // Total minutes spent on this skill
}

export const useSkillStore = defineStore('skill', {
  state: () => ({
    skills: [] as Skill[],
  }),
  actions: {
    async loadSkills() {
      this.skills = await fetchSkills();
    },
    async addSkill(skill: Skill) {
      //this.skills.push({ ...skill, minutesSpent: skill.minutesSpent ?? 0 })
      const newSkill = await createSkill(skill.name);
      this.skills.push({ ...newSkill, minutesSpent: newSkill.minutesSpent ?? 0 });
    },
    incrementSkillTime(skillId: number, minutes: number) {
      //const skill = this.skills.find(s => s.id === skillId)
     // if (skill) {
        //skill.minutesSpent = (skill.minutesSpent ?? 0) + minutes
      //}
      
    },
    async updateSkill(updated: Skill) {
      // const idx = this.skills.findIndex(s => s.id === updated.id)
      // if (idx !== -1) this.skills[idx] = updated
      const updatedskill = await updateSkill(updated.id, updated.name);
      const idx = this.skills.findIndex(s => s.id === updated.id);
      if (idx !== -1) this.skills[idx] = { ...this.skills[idx], ...updatedskill };
    },
    async deleteSkill(id: number) {
      //this.skills = this.skills.filter(s => s.id !== id)
      await deleteSkill(id);
      this.skills = this.skills.filter(s => s.id !== id);
    },
  },
  persist: true,
})
