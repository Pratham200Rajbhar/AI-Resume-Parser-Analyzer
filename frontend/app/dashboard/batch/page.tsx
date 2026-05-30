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
          <Button onClick={() => setNewBatchOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !batches || batches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No batch jobs yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload multiple resumes to rank candidates
            </p>
            <Button onClick={() => setNewBatchOpen(true)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Batch Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Job Description (optional)</Label>
              <Select value={selectedJdId} onValueChange={setSelectedJdId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job description..." />
                </SelectTrigger>
                <SelectContent>
                  {(jds ?? []).map((jd) => (
                    <SelectItem key={jd.id} value={jd.id}>
                      {jd.title} {jd.company ? `— ${jd.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resume Files</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">
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
                <ul className="text-xs text-gray-500 space-y-1 max-h-24 overflow-y-auto">
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
                <p className="text-xs text-gray-500 text-center">Uploading... {uploadProgress}%</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setNewBatchOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreateBatch} disabled={isCreating || files.length === 0}>
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
    IN_PROGRESS: <Clock className="w-4 h-4 text-amber-500" />,
    COMPLETE: <CheckCircle className="w-4 h-4 text-green-500" />,
    FAILED: <XCircle className="w-4 h-4 text-red-500" />,
  }[batch.status]

  const statusLabel = {
    IN_PROGRESS: 'In Progress',
    COMPLETE: 'Complete',
    FAILED: 'Failed',
  }[batch.status]

  const statusColor = {
    IN_PROGRESS: 'bg-amber-100 text-amber-800',
    COMPLETE: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  }[batch.status]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <Badge className={cn('text-xs flex items-center gap-1', statusColor)}>
                {statusIcon}
                {statusLabel}
              </Badge>
              <span className="text-sm text-gray-500">
                {batch.completedCount}/{batch.totalCount} resumes
              </span>
              {batch.failedCount > 0 && (
                <span className="text-xs text-red-500">{batch.failedCount} failed</span>
              )}
            </div>
            {batch.status === 'IN_PROGRESS' && (
              <Progress value={pct} className="h-1.5" />
            )}
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(batch.createdAt)}</span>
            </div>
          </div>
          {batch.status === 'COMPLETE' && (
            <Link href={`/dashboard/batch/${batch.id}`}>
              <Button variant="outline" size="sm">
                View Rankings
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
