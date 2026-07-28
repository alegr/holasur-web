<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function login() {
  localStorage.setItem('holasur_logged_in', 'true')
  router.push('/')
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <h1 class="login__title">HOLA SUR</h1>
      <div class="login__accent"></div>
      <p class="login__subtitle">Panel de gestión</p>
      <button class="btn btn--primary login__btn" @click="login">
        Ingresar como administrador
      </button>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-cream, #f4f2e2);
}
.login__card {
  background: white;
  padding: 48px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(22,70,63,0.12);
  text-align: center;
  max-width: 400px;
  width: 100%;
}
.login__title {
  font-family: var(--font-heading);
  color: var(--color-primary, #16463f);
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.login__accent {
  width: 40px;
  height: 3px;
  background: var(--color-accent, #d4a853);
  margin: 0 auto 16px;
  border-radius: 2px;
}
.login__subtitle {
  color: var(--color-text-secondary, #6b7f7a);
  margin-bottom: 32px;
}
.login__btn {
  width: 100%;
  padding: 14px;
  font-size: 1rem;
}
</style>
