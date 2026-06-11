import { defineStore } from 'pinia'
import { fetchSkills, createSkill, updateSkill, deleteSkill, updateSkillMinutes } from '../services/service'

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
    async incrementSkillTime(skillId: number, minutes: number) {
      const s = this.skills.find(s => s.id === skillId);
      const current = s?.minutesSpent ?? 0;
      const total = current + minutes;
      const refreshed = await updateSkillMinutes(skillId, total);
      if (s) s.minutesSpent = refreshed.minutesSpent ?? total;
    },
    async updateSkill(updated: Skill) {
      // const idx = this.skills.findIndex(s => s.id === updated.id)
      // if (idx !== -1) this.skills[idx] = updated
      if (typeof updated.name === 'string') {
        const refreshed = await updateSkill(updated.id, updated.name);
        const idx = this.skills.findIndex(s => s.id === updated.id);
        if (idx !== -1) this.skills[idx] = { ...this.skills[idx], ...refreshed };
        return;
      }

      // If minutesSpent is provided, use new API
      if (typeof updated.minutesSpent === 'number') {
        const refreshed = await updateSkillMinutes(updated.id, updated.minutesSpent);
        const idx = this.skills.findIndex(s => s.id === updated.id);
        if (idx !== -1) this.skills[idx] = { ...this.skills[idx], ...(refreshed ?? {}) };
        return;
      }
    },
    async deleteSkill(id: number) {
      //this.skills = this.skills.filter(s => s.id !== id)
      await deleteSkill(id);
      this.skills = this.skills.filter(s => s.id !== id);
    },
  },
  persist: true,
})
