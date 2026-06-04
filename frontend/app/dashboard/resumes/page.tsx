'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUIStore } from '@/stores/ui'
import { formatDate, getStatusColor, getStatusLabel, cn } from '@/lib/utils'
import { FileText, Download, Trash2, ChevronUp, ChevronDown, Filter } from 'lucide-react'
import { DropZone } from '@/components/upload/DropZone'
import type { Resume } from '@/types'

type SortField = 'fileName' | 'atsScore' | 'createdAt' | 'status'
type SortOrder = 'asc' | 'desc'

export default function ResumesPage() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const PAGE_SIZE = 20

  const { data, isLoading } = useQuery({
    queryKey: ['resumes', page, PAGE_SIZE, sortBy, sortOrder, statusFilter],
    queryFn: () => api.resumes.list(page, PAGE_SIZE, sortBy, sortOrder, statusFilter || undefined),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      const hasProcessing = items.some((r) => r.status === 'PARSING' || r.status === 'ANALYZING' || r.status === 'PENDING')
      return hasProcessing ? 3000 : false
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.resumes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] })
      addToast({ title: 'Resume deleted', variant: 'default' })
    },
  })

  const resumes = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === resumes.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(resumes.map((r) => r.id)))
    }
  }

  async function handleBulkDelete() {
    for (const id of selected) {
      await deleteMutation.mutateAsync(id)
    }
    setSelected(new Set())
    setBulkMode(false)
  }

  function handleBulkExportCsv() {
    const selectedResumes = resumes.filter((r) => selected.has(r.id))
    const rows = [
      ['File Name', 'Status', 'ATS Score', 'Created At'],
      ...selectedResumes.map((r) => [
        r.fileName,
        r.status,
        String(r.analysis?.atsScore ?? ''),
        r.createdAt,
      ]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resumes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ChevronUp className="w-3 h-3 text-gray-300" />
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-600" />
      : <ChevronDown className="w-3 h-3 text-indigo-600" />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumes"
        description={`${total} resume${total !== 1 ? 's' : ''}`}
        action={
          <Button
            variant="outline"
            className="rounded-full bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold px-4"
            onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()) }}
          >
            {bulkMode ? 'Cancel' : 'Bulk Select'}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-3 rounded-2xl shadow-sm">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-lg border-gray-200 dark:border-slate-800 bg-transparent dark:text-white">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
            <SelectItem value="all" className="text-xs dark:text-gray-200">All statuses</SelectItem>
            {['PENDING', 'PARSING', 'ANALYZING', 'ANALYZED', 'FAILED'].map((s) => (
              <SelectItem key={s} value={s} className="text-xs dark:text-gray-200">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {bulkMode && selected.size > 0 && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={handleBulkExportCsv} className="text-xs h-8 rounded-full border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent">
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs h-8 rounded-full hover:bg-red-50/50 dark:hover:bg-red-950/20"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete ({selected.size})
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100/50 dark:bg-slate-800/40 rounded animate-pulse" />)}
                </div>
              ) : resumes.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No resumes found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800/60 bg-gray-50/30 dark:bg-slate-900/40">
                        {bulkMode && (
                          <th className="py-2 px-3 w-8">
                            <input
                              type="checkbox"
                              checked={selected.size === resumes.length && resumes.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded border-gray-300 dark:border-slate-700 bg-transparent dark:checked:bg-blue-600"
                            />
                          </th>
                        )}
                        <th className="text-left py-2.5 px-3">
                          <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('fileName')}>
                            File <SortIcon field="fileName" />
                          </button>
                        </th>
                        <th className="text-left py-2.5 px-3">
                          <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('status')}>
                            Status <SortIcon field="status" />
                          </button>
                        </th>
                        <th className="text-left py-2.5 px-3">
                          <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('atsScore')}>
                            ATS <SortIcon field="atsScore" />
                          </button>
                        </th>
                        <th className="text-left py-2.5 px-3">
                          <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort('createdAt')}>
                            Date <SortIcon field="createdAt" />
                          </button>
                        </th>
                        <th className="py-2.5 px-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {resumes.map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 dark:border-slate-800/60 hover:bg-[#fafafa]/80 dark:hover:bg-slate-800/30 transition-colors">
                          {bulkMode && (
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                                className="rounded border-gray-300 dark:border-slate-700 bg-transparent dark:checked:bg-blue-600"
                              />
                            </td>
                          )}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                              <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{r.fileName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-none', getStatusColor(r.status))}>
                              {getStatusLabel(r.status)}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            {r.analysis ? (
                              <span className={cn(
                                'font-bold text-sm',
                                r.analysis.atsScore >= 70 ? 'text-green-600 dark:text-green-400' :
                                r.analysis.atsScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                              )}>
                                {r.analysis.atsScore}%
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 font-semibold">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400 text-xs font-sans">{formatDate(r.createdAt)}</td>
                          <td className="py-2.5 px-3 text-right">
                            <Link href={`/dashboard/resumes/${r.id}`}>
                              <Button variant="ghost" size="sm" className="rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold px-4 text-xs">View</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800/60">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-sans">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1} className="text-xs h-7 rounded-lg border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent">Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages} className="text-xs h-7 rounded-lg border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent">Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Upload Resume</CardTitle>
            </CardHeader>
            <CardContent>
              <DropZone compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
