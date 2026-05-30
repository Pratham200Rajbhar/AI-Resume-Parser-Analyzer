'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ResumeAnalysis } from '@/types'

export function useAnalysis(resumeId: string) {
  return useQuery<ResumeAnalysis, Error>({
    queryKey: ['analysis', resumeId],
    queryFn: () => api.resumes.getAnalysis(resumeId),
    enabled: !!resumeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404
      if ((error as { response?: { status?: number } }).response?.status === 404) return false
      return failureCount < 2
    },
  })
}
