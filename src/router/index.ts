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
  ],
})

export default router
