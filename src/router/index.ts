import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { authApi } from '@/services/api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/propiedades',
      name: 'propiedades',
      component: () => import('../views/PropertiesView.vue'),
    },
    {
      path: '/reservas',
      name: 'reservas',
      component: () => import('../views/BookingsView.vue'),
    },
    {
      path: '/propiedades/:id',
      name: 'propiedad-detalle',
      component: () => import('../views/PropertyDetailView.vue'),
    },
    {
      path: '/reservas/:id',
      name: 'reserva-detalle',
      component: () => import('../views/BookingDetailView.vue'),
    },
    {
      path: '/costes',
      name: 'costes',
      component: () => import('../views/CostsView.vue'),
    },
    {
      path: '/costes/compra/nueva',
      name: 'nueva-compra',
      component: () => import('../views/PurchaseFormView.vue'),
    },
    {
      path: '/costes/egreso/nuevo',
      name: 'nuevo-egreso',
      component: () => import('../views/ExpenseFormView.vue'),
    },
    {
      path: '/pagos',
      name: 'pagos',
      component: () => import('../views/PaymentsView.vue'),
    },
    {
      path: '/analisis',
      name: 'analisis',
      component: () => import('../views/AnalyticsView.vue'),
    },
    {
      path: '/analisis/propiedad/:id',
      name: 'propiedad-reporte',
      component: () => import('../views/PropertyReportView.vue'),
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: () => import('../views/ReportsView.vue'),
    },
    {
      path: '/propietarios',
      name: 'propietarios',
      component: () => import('../views/OwnersView.vue'),
    },
    {
      path: '/desvios',
      name: 'desvios',
      component: () => import('../views/DeviationsView.vue'),
    },
  ],
})

// Track whether we've validated the token this session
let tokenValidated = false

router.beforeEach(async (to) => {
  const token = localStorage.getItem('holasur_token')

  if (!token && to.name !== 'login') {
    return { name: 'login' }
  }

  if (token && to.name === 'login') {
    return { name: 'home' }
  }

      }
  }
})

export default router
