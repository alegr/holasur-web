import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/importar',
      name: 'importar',
      component: () => import('../views/ImportView.vue'),
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
  ],
})

export default router
