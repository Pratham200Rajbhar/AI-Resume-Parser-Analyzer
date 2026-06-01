'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { Toaster } from '@/components/ui/toaster'

function AuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize)
  const setUser = useAuthStore((s) => s.setUser)
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      initialize()
    }
  }, [initialize])

  // Fetch user profile on page load when token exists but user isn't loaded yet
  useEffect(() => {
    if (accessToken && !user) {
      import('@/lib/api').then(({ api }) => {
        api.auth.me().then(setUser).catch(() => {
          // Token is invalid — the axios interceptor will redirect to /login
        })
      })
    }
  }, [accessToken, user, setUser])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClientRef = useRef<QueryClient | null>(null)
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60,
          retry: 1,
        },
      },
    })
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <AuthInitializer />
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}
