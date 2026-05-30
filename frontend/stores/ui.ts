import { create } from 'zustand'
import type { Toast } from '@/types'

interface UIState {
  sidebarOpen: boolean
  activeJobIds: string[]
  toasts: Toast[]
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  addActiveJob: (id: string) => void
  removeActiveJob: (id: string) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeJobIds: [],
  toasts: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  addActiveJob: (id) =>
    set((state) => ({
      activeJobIds: state.activeJobIds.includes(id)
        ? state.activeJobIds
        : [...state.activeJobIds, id],
    })),

  removeActiveJob: (id) =>
    set((state) => ({
      activeJobIds: state.activeJobIds.filter((j) => j !== id),
    })),

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
