<template>
  <section class="settings-view">
    <h1>Settings</h1>
    <div class="settings-panel">
      <h2>Colour theme</h2>
      <p class="settings-description">Choose the colour used throughout Tasko.</p>

      <div class="theme-options" role="radiogroup" aria-label="Colour theme">
        <button
          v-for="theme in themes"
          :key="theme.key"
          class="theme-option"
          :class="{ selected: selectedTheme === theme.key }"
          type="button"
          role="radio"
          :aria-checked="selectedTheme === theme.key"
          @click="selectTheme(theme.key)"
        >
          <span class="theme-swatch" :style="{ backgroundColor: theme.color }"></span>
          <span>{{ theme.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const themes = [
  { key: 'grey', label: 'Grey', color: '#737373' },
  { key: 'blue', label: 'Blue', color: '#2563a6' },
  { key: 'green', label: 'Green', color: '#27734a' },
  { key: 'orange', label: 'Orange', color: '#b85c1b' },
] as const

type ThemeKey = (typeof themes)[number]['key']

const selectedTheme = ref<ThemeKey>(getSavedTheme())

function getSavedTheme(): ThemeKey {
  const savedTheme = localStorage.getItem('theme-key')
  return themes.some(theme => theme.key === savedTheme) ? savedTheme as ThemeKey : 'grey'
}

function selectTheme(themeKey: ThemeKey) {
  selectedTheme.value = themeKey
  const theme = themes.find(item => item.key === themeKey)

  if (!theme) return
  document.documentElement.style.setProperty('--theme-color', theme.color)
  localStorage.setItem('theme-key', theme.key)
}

selectTheme(selectedTheme.value)
</script>

<style scoped>
.settings-panel {
  max-width: 520px;
  margin: 0 auto;
  padding: 1.5rem;
  text-align: left;
  background: var(--theme-light);
  border: 1px solid var(--theme-medium);
  border-radius: 10px;
}

.settings-description {
  margin-bottom: 1.25rem;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem;
  color: var(--text-h);
  background: var(--bg);
  border: 2px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.theme-option:hover,
.theme-option.selected {
  border-color: var(--theme-color);
}

.theme-option:focus-visible {
  outline: 3px solid var(--theme-medium);
  outline-offset: 2px;
}

.theme-swatch {
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 auto;
  border: 1px solid var(--theme-text);
  border-radius: 50%;
}

@media (max-width: 520px) {
  .theme-options {
    grid-template-columns: 1fr;
  }
}
</style>