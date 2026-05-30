'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropZone } from '@/components/upload/DropZone'
import { formatDate, formatFileSize, getStatusColor, getStatusLabel, formatScore, cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { FileText, Search, Upload, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Resume, UploadStatus } from '@/types'

const STATUS_FILTERS: { label: string; value: UploadStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Analyzed', value: 'ANALYZED' },
  { label: 'Analyzing', value: 'ANALYZING' },
  { label: 'Parsing', value: 'PARSING' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed', value: 'FAILED' },
]

const PAGE_SIZE = 10

export default function ResumesPage() {
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UploadStatus | 'ALL'>('ALL')
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['resumes', page, PAGE_SIZE],
    queryFn: () => api.resumes.list(page, PAGE_SIZE),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.resumes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] })
      addToast({ title: 'Resume deleted', variant: 'default' })
    },
    onError: () => {
      addToast({ title: 'Delete failed', variant: 'destructive' })
    },
  })

  const allResumes = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filtered = allResumes.filter((r) => {
    const matchesSearch = r.fileName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumes"
        description={`${total} resume${total !== 1 ? 's' : ''} uploaded`}
        action={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Resume
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    statusFilter === f.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No resumes found</h3>
              <p className="text-sm text-gray-500 mb-4">
                {search || statusFilter !== 'ALL'
                  ? 'Try adjusting your filters'
                  : 'Upload your first resume to get started'}
              </p>
              {!search && statusFilter === 'ALL' && (
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Resume
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        File
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        ATS Score
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Size
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Uploaded
                      </th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((resume) => (
                      <ResumeRow
                        key={resume.id}
                        resume={resume}
                        onDelete={() => deleteMutation.mutate(resume.id)}
                        isDeleting={deleteMutation.isPending && deleteMutation.variables === resume.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Resume</DialogTitle>
          </DialogHeader>
          <DropZone onComplete={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResumeRow({
  resume,
  onDelete,
  isDeleting,
}: {
  resume: Resume
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
            {resume.fileName}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge className={cn('text-xs', getStatusColor(resume.status))}>
          {getStatusLabel(resume.status)}
        </Badge>
      </td>
      <td className="py-3 px-4">
        {resume.analysis ? (
          <span className={cn('text-sm font-semibold', formatScore(resume.analysis.atsScore))}>
            {resume.analysis.atsScore}/100
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-gray-500">{formatFileSize(resume.fileSize)}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-gray-500">{formatDate(resume.createdAt)}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1 justify-end">
          <Link href={`/dashboard/resumes/${resume.id}`}>
            <Button variant="ghost" size="sm" aria-label="View resume">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Delete resume"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
