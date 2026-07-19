<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__logo">H</span>
      <span class="sidebar__title">HolaSur</span>
    </div>
    <nav class="sidebar__nav">
      <RouterLink to="/" class="sidebar__link">
        <span class="sidebar__icon">&#9750;</span>
        Inicio
      </RouterLink>
      <RouterLink to="/importar" class="sidebar__link">
        <span class="sidebar__icon">&#8635;</span>
        Importar
      </RouterLink>
      <RouterLink to="/propiedades" class="sidebar__link">
        <span class="sidebar__icon">&#9962;</span>
        Propiedades
      </RouterLink>
    </nav>
  </aside>
  <div class="main">
    <header class="header">
      <h1 class="header__title">HolaSur</h1>
      <span class="header__subtitle">Panel de gestión</span>
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
  background: var(--color-secondary);
  color: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar__logo {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
}

.sidebar__title {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 4px;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
}

.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.sidebar__link.router-link-exact-active {
  background: var(--color-primary);
  color: white;
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
  gap: 16px;
  box-shadow: var(--shadow-sm);
}

.header__title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-primary);
}

.header__subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.content {
  flex: 1;
  padding: 32px;
}
</style>
