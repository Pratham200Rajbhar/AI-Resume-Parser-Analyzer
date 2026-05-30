'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ChatMessage, CoachingSession } from '@/types'

export function useCoachSession(sessionId: string) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const { data: session } = useQuery<CoachingSession, Error>({
    queryKey: ['coaching-session', sessionId],
    queryFn: () => api.coaching.getSession(sessionId),
    enabled: !!sessionId,
  })

  const messages = session?.messages ?? []

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim()) return

      const optimisticMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }

      // Optimistically update the cache
      queryClient.setQueryData<CoachingSession>(['coaching-session', sessionId], (old) => {
        if (!old) return old
        return {
          ...old,
          messages: [...old.messages, optimisticMessage],
        }
      })

      setIsLoading(true)
      try {
        const assistantMessage = await api.coaching.sendMessage(sessionId, content)

        queryClient.setQueryData<CoachingSession>(['coaching-session', sessionId], (old) => {
          if (!old) return old
          return {
            ...old,
            messages: [...old.messages, assistantMessage],
          }
        })
      } catch (err) {
        // Rollback optimistic update on error
        queryClient.setQueryData<CoachingSession>(['coaching-session', sessionId], (old) => {
          if (!old) return old
          return {
            ...old,
            messages: old.messages.filter((m) => m !== optimisticMessage),
          }
        })
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, queryClient]
  )

  return { messages, sendMessage, isLoading, session }
}
