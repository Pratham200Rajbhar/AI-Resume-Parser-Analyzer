'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { api } from '@/lib/api'
import { JobProgressSocket } from '@/lib/websocket'
import { useResumeStore } from '@/stores/resume'
import { useUIStore } from '@/stores/ui'
import type { JobProgressEvent } from '@/types'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
  resumeId?: string
  jobId?: string
}

export function useResumeUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [progress, setProgress] = useState(0)
  const [jobEvent, setJobEvent] = useState<JobProgressEvent | null>(null)

  const { setUploadProgress, setJobProgress } = useResumeStore()
  const { addActiveJob, removeActiveJob, addToast } = useUIStore()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setUploadState({ status: 'uploading' })
      setProgress(0)
      setJobEvent(null)

      try {
        const result = await api.resumes.upload(file, (pct) => {
          setProgress(pct)
          setUploadProgress(file.name, pct)
        })

        const { jobId, resumeId } = result as { jobId: string; resumeId: string }
        setUploadState({ status: 'processing', resumeId, jobId })
        addActiveJob(jobId)

        const socket = new JobProgressSocket(jobId)
        socket.onEvent((event) => {
          setJobEvent(event)
          setJobProgress(jobId, event)

          if (event.type === 'COMPLETE') {
            setUploadState({ status: 'complete', resumeId, jobId })
            removeActiveJob(jobId)
            socket.disconnect()
            addToast({
              title: 'Resume analyzed',
              description: `${file.name} has been successfully analyzed.`,
              variant: 'success',
            })
          } else if (event.type === 'ERROR') {
            setUploadState({
              status: 'error',
              error: event.message ?? 'Analysis failed',
              resumeId,
              jobId,
            })
            removeActiveJob(jobId)
            socket.disconnect()
            addToast({
              title: 'Analysis failed',
              description: event.message ?? 'An error occurred during analysis.',
              variant: 'destructive',
            })
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setUploadState({ status: 'error', error: message })
        addToast({
          title: 'Upload failed',
          description: message,
          variant: 'destructive',
        })
      }
    },
    [setUploadProgress, setJobProgress, addActiveJob, removeActiveJob, addToast]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
  })

  const reset = useCallback(() => {
    setUploadState({ status: 'idle' })
    setProgress(0)
    setJobEvent(null)
  }, [])

  return {
    getRootProps,
    getInputProps,
    isDragActive,
    uploadState,
    progress,
    jobEvent,
    fileRejections,
    reset,
  }
}
