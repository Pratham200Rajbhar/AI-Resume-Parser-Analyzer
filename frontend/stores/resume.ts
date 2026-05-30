import { create } from 'zustand'
import type { JobProgressEvent } from '@/types'

interface ResumeState {
  selectedResumeId: string | null
  uploadProgress: Record<string, number>
  jobProgress: Record<string, JobProgressEvent>
  selectResume: (id: string | null) => void
  setUploadProgress: (id: string, pct: number) => void
  setJobProgress: (id: string, event: JobProgressEvent) => void
  clearJobProgress: (id: string) => void
}

export const useResumeStore = create<ResumeState>((set) => ({
  selectedResumeId: null,
  uploadProgress: {},
  jobProgress: {},

  selectResume: (id) => set({ selectedResumeId: id }),

  setUploadProgress: (id, pct) =>
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, [id]: pct },
    })),

  setJobProgress: (id, event) =>
    set((state) => ({
      jobProgress: { ...state.jobProgress, [id]: event },
    })),

  clearJobProgress: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.jobProgress
      return { jobProgress: rest }
    }),
}))
