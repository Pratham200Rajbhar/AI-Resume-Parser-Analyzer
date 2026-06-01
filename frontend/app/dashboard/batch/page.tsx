'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useUIStore } from '@/stores/ui'
import { formatDate, cn } from '@/lib/utils'
import { Plus, Layers, Calendar, CheckCircle, XCircle, Clock, Upload } from 'lucide-react'
import type { BatchJob } from '@/types'

export default function BatchPage() {
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const [newBatchOpen, setNewBatchOpen] = useState(false)
  const [selectedJdId, setSelectedJdId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.batches.list(),
    refetchInterval: (query) => {
      const data = query.state.data as BatchJob[] | undefined
      const hasActive = data?.some((b) => b.status === 'IN_PROGRESS')
      return hasActive ? 5000 : false
    },
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  async function handleCreateBatch() {
    if (files.length === 0) {
      addToast({ title: 'Please select files', variant: 'destructive' })
      return
    }
    setIsCreating(true)
    setUploadProgress(0)
    try {
      const batch = await api.batches.create(selectedJdId || undefined)
      await api.batches.uploadFiles(batch.id, files, undefined, (pct) => {
        setUploadProgress(pct)
      })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      addToast({ title: 'Batch created', description: `Processing ${files.length} resumes`, variant: 'success' })
      setNewBatchOpen(false)
      setFiles([])
      setSelectedJdId('')
    } catch {
      addToast({ title: 'Failed to create batch', variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Ranking"
        description="Rank multiple candidates against a job description"
        action={
          <Button onClick={() => setNewBatchOpen(true)} className="rounded-full shadow-sm hover:shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5">
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200/50 dark:bg-slate-800/40 rounded-xl animate-pulse border border-gray-100/50 dark:border-slate-800/30" />
          ))}
        </div>
      ) : !batches || batches.length === 0 ? (
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="py-16 text-center">
            <Layers className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No batch jobs yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Upload multiple resumes to rank candidates
            </p>
            <Button onClick={() => setNewBatchOpen(true)} className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5">
              <Plus className="w-4 h-4 mr-2" />
              New Batch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}

      <Dialog open={newBatchOpen} onOpenChange={setNewBatchOpen}>
        <DialogContent className="max-w-lg rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-gray-950 dark:text-white">New Batch Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Job Description (optional)</Label>
              <Select value={selectedJdId} onValueChange={setSelectedJdId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white">
                  <SelectValue placeholder="Select a job description..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  {(jds ?? []).map((jd) => (
                    <SelectItem key={jd.id} value={jd.id} className="text-xs rounded-lg dark:text-gray-200">
                      {jd.title} {jd.company ? `— ${jd.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Resume Files</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold font-sans">
                  {files.length > 0
                    ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
                    : 'Click to select PDF/DOCX files'}
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              {files.length > 0 && (
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 max-h-24 overflow-y-auto font-sans">
                  {files.map((f, i) => (
                    <li key={i} className="truncate">
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isCreating && (
              <div className="space-y-1">
                <Progress value={uploadProgress} />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center font-sans">Uploading... {uploadProgress}%</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setNewBatchOpen(false)} disabled={isCreating} className="rounded-xl border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent font-semibold px-4 h-10">
                Cancel
              </Button>
              <Button onClick={handleCreateBatch} disabled={isCreating || files.length === 0} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10 shadow-sm">
                {isCreating ? 'Creating...' : 'Start Batch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BatchCard({ batch }: { batch: BatchJob }) {
  const pct =
    batch.totalCount > 0
      ? Math.round((batch.completedCount / batch.totalCount) * 100)
      : 0

  const statusIcon = {
    IN_PROGRESS: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    COMPLETE: <CheckCircle className="w-3.5 h-3.5 text-green-500 animate-pulse" />,
    FAILED: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  }[batch.status]

  const statusLabel = {
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    FAILED: 'Failed',
  }[batch.status]

  const statusColor = {
    IN_PROGRESS: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/20',
    COMPLETE: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100/50 dark:border-green-900/20',
    FAILED: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100/50 dark:border-red-900/20',
  }[batch.status]

  return (
    <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl hover:shadow-md transition-all duration-200 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="flex items-center gap-3">
              <Badge className={cn('text-xs font-semibold flex items-center gap-1.5 px-2.5 py-0.5 rounded-full shadow-none', statusColor)}>
                {statusIcon}
                {statusLabel}
              </Badge>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {batch.completedCount}/{batch.totalCount} resumes
              </span>
              {batch.failedCount > 0 && (
                <span className="text-xs font-bold text-red-500 dark:text-red-400">{batch.failedCount} failed</span>
              )}
            </div>
            {batch.status === 'IN_PROGRESS' && (
              <Progress value={pct} className="h-1.5" />
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-sans">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(batch.createdAt)}</span>
            </div>
          </div>
          {batch.status === 'COMPLETE' && (
            <Link href={`/dashboard/batch/${batch.id}`}>
              <Button variant="outline" size="sm" className="rounded-full bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold px-4 h-9 text-xs">
                View Rankings
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
