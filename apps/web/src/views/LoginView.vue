<template>
  <section class="login-view" :class="{ 'signup-view': isRegistering }">
    <h1>{{ isRegistering ? 'Create your account' : 'Welcome back' }}</h1>
    <form ref="form" class="login-panel" :class="{ 'display-name-step': isRegistering && registrationStep === 2 }" @submit.prevent="submit">
      <div v-if="isRegistering" class="step-header">
        <button v-if="registrationStep === 2" type="button" class="switch-mode back-button" :disabled="busy" @click="goBack">Back</button>
        <p class="hint step-progress">Step {{ registrationStep }} of 2</p>
      </div>
      <label v-if="!isRegistering || registrationStep === 1">
        Email
        <input v-model="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" :disabled="busy" />
      </label>
      <label v-if="isRegistering && registrationStep === 2">
        <span>Display name <span class="optional">(optional)</span></span>
        <input ref="displayNameInput" v-model="displayName" name="displayName" type="text" autocomplete="nickname" maxlength="255" placeholder="How should we greet you?" :disabled="busy" />
      </label>
      <label v-if="!isRegistering || registrationStep === 1">
        Password
        <input
          v-model="password"
          name="password"
          type="password"
          :autocomplete="isRegistering ? 'new-password' : 'current-password'"
          required
          :minlength="isRegistering ? 8 : undefined"
          placeholder="Your password"
          :aria-describedby="isRegistering ? 'password-hint' : undefined"
          :disabled="busy"
        />
        <span v-if="isRegistering" id="password-hint" class="hint">Use at least 8 characters.</span>
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="busy">
        {{ busy ? 'Please wait…' : isRegistering ? registrationStep === 1 ? 'Continue' : 'Create account' : 'Log in' }}
      </button>

      <button type="button" class="switch-mode" :disabled="busy" @click="toggleMode">
        {{ isRegistering ? 'Already have an account? Log in' : 'New to Tasko? Create an account' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const isRegistering = ref(false)
const registrationStep = ref<1 | 2>(1)
const form = ref<HTMLFormElement | null>(null)
const displayNameInput = ref<HTMLInputElement | null>(null)
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const busy = ref(false)

function toggleMode() {
  isRegistering.value = !isRegistering.value
  registrationStep.value = 1
  error.value = ''
}

async function goBack() {
  registrationStep.value = 1
  error.value = ''
  await nextTick()
  form.value?.querySelector<HTMLInputElement>('[name="email"]')?.focus()
}

async function submit() {
  if (busy.value) return
  if (!form.value?.reportValidity()) return
  if (isRegistering.value && registrationStep.value === 1) {
    if (password.value.length < 8) {
      error.value = 'Use at least 8 characters.'
      return
    }
    registrationStep.value = 2
    error.value = ''
    await nextTick()
    displayNameInput.value?.focus()
    return
  }
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
.login-view h1 {
  margin: 0 0 1rem;
  font-size: clamp(1.9rem, 4.25vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.login-panel {
  max-width: 420px;
  margin: 0 auto;
  padding: clamp(1.15rem, 3vh, 1.65rem);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  text-align: left;
  background: var(--theme-light);
  border: 1px solid var(--theme-medium);
  border-radius: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-weight: 600;
}

.optional {
  font-weight: 400;
}

.step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.step-header .step-progress { margin-left: auto; text-align: right; }
.step-header .back-button { padding: 0; min-height: 0; }
.signup-view .login-panel { min-height: 490px; }
.display-name-step {
  display: grid;
  grid-template-rows: 1fr auto 1fr;
}
.display-name-step > .step-header { grid-row: 1; align-self: start; }
.display-name-step > label { grid-row: 2; transform: translateY(-45px); }
.display-name-step > button[type='submit'] {
  grid-column: 1;
  grid-row: 3;
  align-self: start;
  margin-top: 0.5rem;
  transform: translateY(-30px);
}
.display-name-step > .switch-mode { grid-column: 1; grid-row: 3; align-self: end; }
.display-name-step > .error { grid-row: 4; }

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

.switch-mode:hover:not(:disabled) {
  color: var(--theme-color);
  background: none;
  border-color: transparent;
}

.hint {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 400;
}

.error {
  margin: 0;
  color: #b3261e;
  font-weight: 600;
}

@media (max-height: 600px) {
  .login-view h1 { margin-bottom: 0.75rem; font-size: 1.75rem; }
  .login-panel { padding: 0.65rem 1.1rem; gap: 0.6rem; font-size: max(16px, 0.9rem); }
  .login-panel .hint { font-size: 0.8rem; }
  label { gap: 0.35rem; }
  button[type='submit'] { padding: 0.5rem; }
  .signup-view .login-panel { min-height: 365px; }
}
</style>
