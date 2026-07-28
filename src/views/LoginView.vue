<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function handleLogin() {
  localStorage.setItem('holasur_logged_in', 'true')
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__header">
        <h1 class="login-card__title">HOLA SUR</h1>
        <div class="login-card__accent"></div>
        <p class="login-card__subtitle">Panel de gestión</p>
      </div>
      <button class="login-card__button" @click="handleLogin">
        Ingresar como administrador
      </button>
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
  margin-bottom: 40px;
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

.login-card__button {
  display: block;
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
  transition: background 0.2s, box-shadow 0.2s;
  letter-spacing: 0.01em;
}

.login-card__button:hover {
  background: var(--color-primary-light);
  box-shadow: 0 4px 16px rgba(22, 70, 63, 0.18);
}

.login-card__button:active {
  background: var(--color-primary-dark);
}
</style>
