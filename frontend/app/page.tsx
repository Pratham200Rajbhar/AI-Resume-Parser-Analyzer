'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export default function HomePage() {
  const router = useRouter()
  const { accessToken, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading) {
      if (accessToken) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }
  }, [accessToken, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}
