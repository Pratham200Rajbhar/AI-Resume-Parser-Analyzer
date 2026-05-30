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

      const optimisticUser: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }

      const optimisticAssistant: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }

      // Track the count before optimistic update so we can slice back on error
      const prevLength = queryClient.getQueryData<CoachingSession>(['coaching-session', sessionId])?.messages.length ?? 0

      queryClient.setQueryData<CoachingSession>(['coaching-session', sessionId], (old) => {
        if (!old) return old
        return {
          ...old,
          messages: [...old.messages, optimisticUser, optimisticAssistant],
        }
      })

      setIsLoading(true)
      try {
        await api.coaching.sendMessageStream(sessionId, content, (chunk) => {
          queryClient.setQueryData<CoachingSession>(['coaching-session', sessionId], (old) => {
            if (!old) return old
            const msgs = [...old.messages]
            const lastMsg = msgs[msgs.length - 1]
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                content: lastMsg.content + chunk,
              }
            }
            return {
              ...old,
              messages: msgs,
            }
          })
        })
      } catch (err) {
        // Rollback by slicing back to the pre-optimistic length
        queryClient.setQueryData<CoachingSession>(['coaching-session', sessionId], (old) => {
          if (!old) return old
          return {
            ...old,
            messages: old.messages.slice(0, prevLength),
          }
        })
        throw err
      } finally {
        setIsLoading(false)
        queryClient.invalidateQueries({ queryKey: ['coaching-session', sessionId] })
        queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] })
      }
    },
    [sessionId, queryClient]
  )

  return { messages, sendMessage, isLoading, session }
}
