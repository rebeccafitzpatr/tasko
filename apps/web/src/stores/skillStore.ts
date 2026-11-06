import { defineStore } from 'pinia'
import { fetchSkills, createSkill, updateSkill, deleteSkill, updateSkillMinutes } from '../services/service'
import { useAnalyticsStore } from './analyticsStore'
import type { Skill } from '../services/service'

export type { Skill } from '../services/service'

export const useSkillStore = defineStore('skill', {
  state: () => ({
    skills: [] as Skill[],
  }),
  actions: {
    async loadSkills() {
      this.skills = await fetchSkills();
    },
    async addSkill(skill: Skill) {
      const newSkill = await createSkill(skill.name, skill.parentId ?? null);
      this.skills.push({ ...newSkill, minutesSpent: newSkill.minutesSpent ?? 0 });
      useAnalyticsStore().invalidate()
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
        const refreshed = await updateSkill(updated.id, updated.name, updated.parentId);
        const idx = this.skills.findIndex(s => s.id === updated.id);
        if (idx !== -1) this.skills[idx] = { ...this.skills[idx], ...refreshed };
        useAnalyticsStore().invalidate()
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
      await deleteSkill(id)
      this.skills = this.skills.filter(skill => skill.id !== id)
      useAnalyticsStore().invalidate()
    },
  },
  persist: true,
})
