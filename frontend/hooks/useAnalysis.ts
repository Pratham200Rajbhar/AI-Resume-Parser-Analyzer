'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ResumeAnalysis } from '@/types'

export function useAnalysis(resumeId: string) {
  return useQuery<ResumeAnalysis | null, Error>({
    queryKey: ['analysis', resumeId],
    queryFn: async () => {
      try {
        return await api.resumes.getAnalysis(resumeId)
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response?.status
        if (status === 404) return null
        throw err
      }
    },
    enabled: !!resumeId,
    staleTime: 1000 * 60 * 5,
    refetchInterval: (query) => {
      // Keep polling until we get a result
      return query.state.data === null ? 3000 : false
    },
    retry: (failureCount, error) => {
      if ((error as { response?: { status?: number } }).response?.status === 404) return false
      return failureCount < 2
    },
  })
}
