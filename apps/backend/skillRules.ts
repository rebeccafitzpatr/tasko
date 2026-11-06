export interface SkillNode {
  id: number
  name: string
  parentId: number | null
}

export function validateSkillParent(skills: SkillNode[], id: number | null, parentId: number | null): string | null {
  if (parentId === null) return null
  if (!Number.isSafeInteger(parentId) || parentId < 1) return 'parentId must be a positive integer or null.'
  if (parentId === id) return 'A skill cannot be its own parent.'
  const parent = skills.find(skill => skill.id === parentId)
  if (!parent) return 'Parent skill not found. Choose an existing top-level skill.'
  if (parent.parentId !== null) return 'Only top-level skills can have sub-skills.'
  if (id !== null && skills.some(skill => skill.parentId === id)) {
    return "Move or promote this skill's sub-skills before assigning it a parent."
  }
  return null
}

export function validSkillName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 255
}
