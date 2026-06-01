import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  logout: () => void
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  setTokens: (access, refresh) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      document.cookie = `access_token=${access}; path=/; max-age=86400; SameSite=Lax`
      document.cookie = `refresh_token=${refresh}; path=/; max-age=604800; SameSite=Lax`
    }
    set({ accessToken: access, refreshToken: refresh })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
    set({ user: null, accessToken: null, refreshToken: null })
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const access = localStorage.getItem('access_token')
      const refresh = localStorage.getItem('refresh_token')
      if (access) {
        document.cookie = `access_token=${access}; path=/; max-age=86400; SameSite=Lax`
      }
      if (refresh) {
        document.cookie = `refresh_token=${refresh}; path=/; max-age=604800; SameSite=Lax`
      }
      set({
        accessToken: access,
        refreshToken: refresh,
        isLoading: false,
      })
    } else {
      set({ isLoading: false })
    }
  },
}))
