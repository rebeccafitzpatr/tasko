<template>
  <div>
    <h1>Analytics</h1>
    <div>
      <p>Total tasks: {{ tasks.length }}</p>
      <h2>Time spent per skill (task count)</h2>
      <ul>
        <li v-for="skill in skills" :key="skill.id">
          {{ skill.name }}: {{ countTasksForSkill(skill.id) }} tasks under this skillset
          <br />
          Time spent on {{ skill.name }}: {{ totalMinutesForSkill(skill.id) }} minutes
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '../stores/taskStore'
import { useSkillStore } from '../stores/skillStore'

const taskStore = useTaskStore()
const skillStore = useSkillStore()

const tasks = taskStore.tasks
const skills = skillStore.skills

function countTasksForSkill(skillId: string) {
  return tasks.filter(t => t.skillId === skillId).length
}

function totalMinutesForSkill(skillId: string) {
  return tasks
    .filter(t => t.skillId === skillId)
    .reduce((sum, t) => sum + (t.minutesSpent || 0), 0)
}
</script>
