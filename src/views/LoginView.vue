<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/services/api'

const router = useRouter()

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMsg.value = 'Ingrese email y contrasena'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    const res = await authApi.login(email.value, password.value)
    localStorage.setItem('holasur_token', res.token)
    localStorage.setItem('holasur_user', JSON.stringify(res.user))
    router.push('/')
  } catch (e) {
    if (e instanceof Error && e.message.includes('422')) {
      errorMsg.value = 'Email o contrasena incorrectos'
    } else {
      errorMsg.value = 'Error de conexion. Intente nuevamente.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__header">
        <h1 class="login-card__title">HOLA SUR</h1>
        <div class="login-card__accent"></div>
        <p class="login-card__subtitle">Panel de gestion</p>
      </div>
      <form class="login-card__form" @submit.prevent="handleLogin">
        <div class="login-card__field">
          <label class="login-card__label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="login-card__input"
            placeholder="admin@holasur.com.ar"
            autocomplete="username"
          />
        </div>
        <div class="login-card__field">
          <label class="login-card__label" for="password">Contrasena</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="login-card__input"
            placeholder="Ingrese su contrasena"
            autocomplete="current-password"
          />
        </div>
        <div v-if="errorMsg" class="login-card__error">{{ errorMsg }}</div>
        <button class="login-card__button" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner spinner--small"></span>
          {{ loading ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-cream);
  background-image:
    radial-gradient(circle at 20% 50%, rgba(22, 70, 63, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(212, 168, 83, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(22, 70, 63, 0.02) 0%, transparent 50%);
}

.login-card {
  background: var(--color-surface);
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(22, 70, 63, 0.08),
    0 12px 48px rgba(22, 70, 63, 0.06);
  padding: 56px 48px 48px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-card__header {
  margin-bottom: 32px;
}

.login-card__title {
  font-family: var(--font-heading);
  font-size: 2.2rem;
  font-weight: 400;
  color: var(--color-primary);
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}

.login-card__accent {
  width: 40px;
  height: 3px;
  background: var(--color-accent);
  border-radius: 2px;
  margin: 0 auto 16px;
}

.login-card__subtitle {
  font-size: 1rem;
  color: var(--color-text-secondary);
  font-weight: 400;
  letter-spacing: 0.02em;
}

.login-card__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-card__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.login-card__label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.login-card__input {
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.login-card__input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(22, 70, 63, 0.1);
}

.login-card__error {
  color: var(--color-error, #dc2626);
  font-size: 0.85rem;
  font-weight: 500;
  text-align: left;
  padding: 8px 12px;
  background: #fde8e8;
  border-radius: 6px;
}

.login-card__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 24px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.2s,
    box-shadow 0.2s;
  letter-spacing: 0.01em;
  margin-top: 8px;
}

.login-card__button:hover:not(:disabled) {
  background: var(--color-primary-light);
  box-shadow: 0 4px 16px rgba(22, 70, 63, 0.18);
}

.login-card__button:active:not(:disabled) {
  background: var(--color-primary-dark);
}

.login-card__button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
