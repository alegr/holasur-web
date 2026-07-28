<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__logo">H</span>
      <span class="sidebar__title">Hola Sur</span>
    </div>
    <nav class="sidebar__nav">
      <RouterLink to="/" class="sidebar__link">
        <span class="sidebar__icon">&#9750;</span>
        Inicio
      </RouterLink>
      <RouterLink to="/propiedades" class="sidebar__link">
        <span class="sidebar__icon">&#9962;</span>
        Propiedades
      </RouterLink>
      <RouterLink to="/reservas" class="sidebar__link">
        <span class="sidebar__icon">&#128197;</span>
        Reservas
      </RouterLink>
      <RouterLink to="/pagos" class="sidebar__link">
        <span class="sidebar__icon">&#128179;</span>
        Pagos
      </RouterLink>
      <RouterLink to="/costes" class="sidebar__link">
        <span class="sidebar__icon">&#128176;</span>
        Costes
      </RouterLink>
      <RouterLink to="/analisis" class="sidebar__link">
        <span class="sidebar__icon">&#128202;</span>
        Analisis
      </RouterLink>
    </nav>
  </aside>
  <div class="main">
    <header class="header">
      <h1 class="header__title">Hola Sur</h1>
      <span class="header__subtitle">Panel de gestion</span>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-height: 100vh;
  background: var(--color-primary);
  color: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.sidebar__logo {
  width: 38px;
  height: 38px;
  background: var(--color-cream);
  color: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.sidebar__title {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 2px;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.95rem;
  font-weight: 400;
  transition: all 0.2s;
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

.sidebar__link.router-link-exact-active {
  background: rgba(244, 242, 226, 0.15);
  color: var(--color-cream);
  font-weight: 500;
}

.sidebar__icon {
  font-size: 1.2rem;
  width: 24px;
  text-align: center;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header {
  background: var(--color-surface);
  padding: 16px 32px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header__title {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  font-weight: 400;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.header__subtitle {
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  font-weight: 400;
}

.content {
  flex: 1;
  padding: 32px;
}
</style>
