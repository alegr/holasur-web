<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { authApi } from '@/services/api'
import ImportTracker from '@/components/ImportTracker.vue'
import AvantioLoginModal from '@/components/AvantioLoginModal.vue'

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

async function handleLogout() {
  try {
    await authApi.logout()
  } catch {
    // ignore logout errors
  }
  localStorage.removeItem('holasur_logged_in')
  
  router.push('/login')
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}

// Close sidebar on route change (mobile)
watch(() => route.path, () => {
  sidebarOpen.value = false
})
</script>

<template>
  <template v-if="route.name === 'login'">
    <RouterView />
  </template>
  <template v-else>
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="sidebar-overlay"
      @click="closeSidebar"
    ></div>
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
      <div class="sidebar__brand">
        <span class="sidebar__logo">H</span>
        <span class="sidebar__title">Hola Sur</span>
      </div>
      <nav class="sidebar__nav">
        <RouterLink to="/" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#9750;</span>
          Inicio
        </RouterLink>
        <RouterLink to="/propiedades" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#9962;</span>
          Propiedades
        </RouterLink>
        <RouterLink to="/propietarios" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128100;</span>
          Propietarios
        </RouterLink>
        <RouterLink to="/reservas" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128197;</span>
          Reservas
        </RouterLink>
        <RouterLink to="/servicios" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#9881;</span>
          Servicios
        </RouterLink>
        <RouterLink to="/costes" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128176;</span>
          Gastos generales
        </RouterLink>
        <!-- Hidden until ready:
        <RouterLink to="/pagos" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128179;</span>
          Pagos
        </RouterLink>
        <RouterLink to="/facturas" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128196;</span>
          Facturas
        </RouterLink>
        <RouterLink to="/costes" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128176;</span>
          Costes
        </RouterLink>
        <RouterLink to="/reportes" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128200;</span>
          Reportes
        </RouterLink>
        <RouterLink to="/desvios" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128203;</span>
          Desvios
        </RouterLink>
        <RouterLink to="/analisis" class="sidebar__link" @click="closeSidebar">
          <span class="sidebar__icon">&#128202;</span>
          Analisis
        </RouterLink>
        -->
      </nav>
      <div class="sidebar__footer">
        <button class="sidebar__logout" @click="handleLogout">
          Cerrar sesion
        </button>
      </div>
    </aside>
    <div class="main">
      <header class="header">
        <button class="header__hamburger" @click="toggleSidebar" aria-label="Menu">
          &#9776;
        </button>
        <h1 class="header__title">Hola Sur</h1>
        <span class="header__subtitle">Panel de gestion</span>
      </header>
      <main class="content">
        <RouterView />
      </main>
      <ImportTracker />
      <AvantioLoginModal />
    </div>
  </template>
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
  flex: 1;
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

.sidebar__footer {
  padding: 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.sidebar__logout {
  display: block;
  width: 100%;
  padding: 8px 16px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius-md);
  transition: all 0.2s;
}

.sidebar__logout:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
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

.header__hamburger {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-primary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  line-height: 1;
}

.header__hamburger:hover {
  background: var(--color-background-mute);
}

.sidebar-overlay {
  display: none;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: var(--shadow-lg);
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }

  .header__hamburger {
    display: block;
  }

  .header__subtitle {
    display: none;
  }

  .header__title {
    font-size: 1.1rem;
  }

  .header {
    padding: 12px 16px;
  }

  .content {
    padding: 16px;
  }
}
</style>
