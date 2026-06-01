'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ResumeAnalysis } from '@/types'

// Maximum number of polls before giving up waiting for analysis (30 × 3s = 90s)
const MAX_POLL_COUNT = 30

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
      // Stop polling once we have data, or if we've exceeded the max poll count
      if (query.state.data !== null) return false
      const fetchCount = query.state.dataUpdateCount + query.state.errorUpdateCount
      if (fetchCount >= MAX_POLL_COUNT) return false
      return 3000
    },
    retry: (failureCount, error) => {
      if ((error as { response?: { status?: number } }).response?.status === 404) return false
      return failureCount < 2
    },
  })
}
