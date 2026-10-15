import { create } from 'zustand'

export interface AuthUser {
  id: string
  username: string
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isOpen: boolean
  mode: 'login' | 'register'
  error: string | null

  setOpen: (open: boolean) => void
  setMode: (mode: 'login' | 'register') => void
  clearError: () => void

  checkSession: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isOpen: false,
  mode: 'login',
  error: null,

  setOpen: (open) => set({ isOpen: open, error: null }),
  setMode: (mode) => set({ mode, error: null }),
  clearError: () => set({ error: null }),

  async checkSession() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as AuthUser
        set({ user: data })
      } else {
        set({ user: null })
      }
    } catch {
      set({ user: null })
    }
  },

  async login(username, password) {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json()) as { id?: string; username?: string; error?: string }
      if (!res.ok) {
        set({ error: data.error || '登录失败', isLoading: false })
        return
      }
      set({ user: { id: data.id!, username: data.username! }, isOpen: false, isLoading: false })
    } catch {
      set({ error: '网络错误', isLoading: false })
    }
  },

  async register(username, password) {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json()) as { id?: string; username?: string; error?: string }
      if (!res.ok) {
        set({ error: data.error || '注册失败', isLoading: false })
        return
      }
      set({ user: { id: data.id!, username: data.username! }, isOpen: false, isLoading: false })
    } catch {
      set({ error: '网络错误', isLoading: false })
    }
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      set({ user: null })
    }
  },
}))
