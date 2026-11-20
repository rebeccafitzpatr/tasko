<template>
  <section class="login-view">
    <h1>{{ isRegistering ? 'Create your account' : 'Welcome back' }}</h1>
    <form class="login-panel" @submit.prevent="submit">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="email" required placeholder="you@example.com" />
      </label>
      <label v-if="isRegistering">
        Display name <span class="optional">(optional)</span>
        <input v-model="displayName" type="text" autocomplete="nickname" maxlength="255" placeholder="How should we greet you?" />
      </label>
      <label>
        Password
        <input
          v-model="password"
          type="password"
          :autocomplete="isRegistering ? 'new-password' : 'current-password'"
          required
          :minlength="isRegistering ? 8 : undefined"
          placeholder="Your password"
        />
      </label>
      <p v-if="isRegistering" class="hint">Use at least 8 characters.</p>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="busy">
        {{ busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Log in' }}
      </button>

      <button type="button" class="switch-mode" @click="toggleMode">
        {{ isRegistering ? 'Already have an account? Log in' : 'New to Tasko? Create an account' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const isRegistering = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const busy = ref(false)

function toggleMode() {
  isRegistering.value = !isRegistering.value
  error.value = ''
}

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (isRegistering.value) {
      await auth.register(email.value, password.value, displayName.value.trim() || null)
    } else {
      await auth.login(email.value, password.value)
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/tasks'
    router.push(redirect)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.login-panel {
  max-width: 420px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  text-align: left;
  background: var(--theme-light);
  border: 1px solid var(--theme-medium);
  border-radius: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-weight: 600;
}

.optional {
  font-weight: 400;
}

input {
  padding: 0.6rem;
  font: inherit;
  color: var(--text-h);
  background: var(--bg);
  border: 2px solid var(--border);
  border-radius: 8px;
}

input:focus-visible {
  outline: 3px solid var(--theme-medium);
  outline-offset: 1px;
}

button[type='submit'] {
  padding: 0.7rem;
  font: inherit;
  font-weight: 600;
  color: var(--text-on-accent);
  background: var(--theme-color);
  border: 2px solid var(--theme-color);
  border-radius: 8px;
  cursor: pointer;
}

button[type='submit']:disabled {
  opacity: 0.7;
  cursor: wait;
}

.switch-mode {
  padding: 0.4rem;
  font: inherit;
  color: var(--text-h);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}

.hint {
  margin: 0;
  font-size: 0.9rem;
}

.error {
  margin: 0;
  color: #b3261e;
  font-weight: 600;
}
</style>
