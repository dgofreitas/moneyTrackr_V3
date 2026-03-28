import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import LoginPage from '../pages/auth/LoginPage.vue'
import RegisterPage from '../pages/auth/RegisterPage.vue'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.vue'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage.vue'
import ProtectedRoute from '../components/common/ProtectedRoute.vue'

// Lazy load protected pages
const DashboardPage = () => import('../pages/DashboardPage.vue')
const TransactionsPage = () => import('../pages/transactions/TransactionsPage.vue')
const TransactionFormPage = () => import('../pages/transactions/TransactionFormPage.vue')
const PositionsPage = () => import('../pages/positions/PositionsPage.vue')

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { requiresGuest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
    meta: { requiresGuest: true },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordPage,
    meta: { requiresGuest: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ResetPasswordPage,
    meta: { requiresGuest: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/transactions',
    name: 'transactions',
    component: TransactionsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/transactions/new',
    name: 'new-transaction',
    component: TransactionFormPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/transactions/:id/edit',
    name: 'edit-transaction',
    component: TransactionFormPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/positions',
    name: 'positions',
    component: PositionsPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guards
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const isAuthenticated = !!token

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({
      path: '/login',
      query: { returnUrl: to.fullPath },
    })
    return
  }

  // Check if route is for guests only (login, register, etc.)
  if (to.meta.requiresGuest && isAuthenticated) {
    next('/dashboard')
    return
  }

  next()
})

export default router
