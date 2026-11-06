import type { Skill } from './service'

export function skillLabel(skill: Skill, skills: Skill[]): string {
  const parent = skills.find(item => item.id === skill.parentId)
  const parentName = parent?.name ?? skill.parentName
  return parentName ? `${parentName} / ${skill.name}` : skill.name
}
