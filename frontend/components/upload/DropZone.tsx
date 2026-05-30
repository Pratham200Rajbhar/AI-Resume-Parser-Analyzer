'use client'

import { useResumeUpload } from '@/hooks/useResumeUpload'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

const STEP_LABELS: Record<string, string> = {
  JOB_STARTED: 'Starting...',
  PARSING_COMPLETE: 'Parsing complete',
  ENTITIES_READY: 'Extracting entities',
  ANALYSIS_READY: 'Running analysis',
  COMPLETE: 'Analysis complete',
  ERROR: 'Error',
}

interface DropZoneProps {
  compact?: boolean
  onComplete?: () => void
}

export function DropZone({ compact = false, onComplete }: DropZoneProps) {
  const { getRootProps, getInputProps, isDragActive, uploadState, progress, jobEvent, fileRejections, reset } =
    useResumeUpload()

  const isIdle = uploadState.status === 'idle'
  const isUploading = uploadState.status === 'uploading'
  const isProcessing = uploadState.status === 'processing'
  const isComplete = uploadState.status === 'complete'
  const isError = uploadState.status === 'error'

  if (isComplete && uploadState.resumeId) {
    return (
      <div className={cn('flex flex-col items-center gap-3 text-center', compact ? 'py-4' : 'py-8')}>
        <CheckCircle className="w-10 h-10 text-green-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">Analysis complete!</p>
          <p className="text-xs text-gray-500 mt-0.5">Your resume has been analyzed</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/resumes/${uploadState.resumeId}`}>
            <Button size="sm" onClick={onComplete}>
              View Analysis
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={reset}>
            Upload Another
          </Button>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn('flex flex-col items-center gap-3 text-center', compact ? 'py-4' : 'py-8')}>
        <XCircle className="w-10 h-10 text-red-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">Upload failed</p>
          <p className="text-xs text-red-500 mt-0.5">{uploadState.error}</p>
        </div>
        <Button size="sm" variant="outline" onClick={reset}>
          Try Again
        </Button>
      </div>
    )
  }

  if (isUploading || isProcessing) {
    return (
      <div className={cn('space-y-4', compact ? 'py-2' : 'py-6')}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {isUploading ? 'Uploading...' : (jobEvent ? STEP_LABELS[jobEvent.event] : 'Processing...')}
            </p>
            {jobEvent?.message && (
              <p className="text-xs text-gray-500 truncate">{jobEvent.message}</p>
            )}
          </div>
        </div>

        {isUploading && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-gray-400 text-right">{progress}%</p>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            {(['JOB_STARTED', 'PARSING_COMPLETE', 'ENTITIES_READY', 'ANALYSIS_READY', 'COMPLETE'] as const).map(
              (step) => {
                const steps = ['JOB_STARTED', 'PARSING_COMPLETE', 'ENTITIES_READY', 'ANALYSIS_READY', 'COMPLETE']
                const currentIdx = jobEvent ? steps.indexOf(jobEvent.event) : -1
                const stepIdx = steps.indexOf(step)
                const isDone = currentIdx > stepIdx
                const isCurrent = currentIdx === stepIdx

                return (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        isDone ? 'bg-green-500' : isCurrent ? 'bg-indigo-500 animate-pulse' : 'bg-gray-200'
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs',
                        isDone ? 'text-green-600' : isCurrent ? 'text-indigo-600 font-medium' : 'text-gray-400'
                      )}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                )
              }
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl transition-colors cursor-pointer',
          compact ? 'p-6' : 'p-10',
          isDragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
        )}
        role="button"
        aria-label="Upload resume file"
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className={cn(
              'rounded-full flex items-center justify-center',
              compact ? 'w-10 h-10 bg-indigo-50' : 'w-14 h-14 bg-indigo-50',
              isDragActive && 'bg-indigo-100'
            )}
          >
            <Upload
              className={cn(
                'text-indigo-500',
                compact ? 'w-5 h-5' : 'w-7 h-7'
              )}
            />
          </div>
          <div>
            <p className={cn('font-medium text-gray-900', compact ? 'text-sm' : 'text-base')}>
              {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, DOCX, TXT, PNG, JPG up to 10MB
            </p>
          </div>
          {!compact && (
            <Button type="button" variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Browse files
            </Button>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-2 space-y-1">
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} className="text-xs text-red-500">
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
