import { describe, expect, test } from 'bun:test'
import { validateSkillParent, validSkillName } from './skillRules.js'

const skills = [
  { id: 1, name: 'Languages', parentId: null },
  { id: 2, name: 'French', parentId: 1 },
  { id: 3, name: 'Coding', parentId: null },
]
describe('one-level skill rules', () => {
  test('allows standalone, promotion and moves between top-level parents', () => {
    expect(validateSkillParent(skills, null, null)).toBeNull()
    expect(validateSkillParent(skills, 2, null)).toBeNull()
    expect(validateSkillParent(skills, 2, 3)).toBeNull()
    expect(validateSkillParent(skills, null, 1)).toBeNull()
  })
  test('rejects invalid IDs, self-parenting, missing parents and grandchildren', () => {
    for (const parent of [0, -1, 1.5, 999, 2]) expect(validateSkillParent(skills, 2, parent)).not.toBeNull()
    expect(validateSkillParent(skills, 1, 3)).toContain('sub-skills')
    expect(validateSkillParent(skills, 3, 2)).toContain('top-level')
  })
  test('validates trimmed names and column length', () => {
    for (const name of ['', '  ', null, 4, 'a'.repeat(256)]) expect(validSkillName(name)).toBe(false)
    expect(validSkillName('  French  ')).toBe(true)
    expect(validSkillName('a'.repeat(255))).toBe(true)
  })
})
