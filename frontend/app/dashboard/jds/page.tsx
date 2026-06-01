'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUIStore } from '@/stores/ui'
import { formatDate, cn } from '@/lib/utils'
import { Plus, Trash2, Briefcase, Building2, Calendar, Link2, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { JobDescription } from '@/types'

export default function JDsPage() {
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [rawText, setRawText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  const { data: jds, isLoading } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.jds.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jds'] })
      addToast({ title: 'Job description deleted' })
    },
    onError: () => {
      addToast({ title: 'Delete failed', variant: 'destructive' })
    },
  })

  async function handleImportUrl() {
    if (!urlInput.trim()) return
    setUrlLoading(true)
    setUrlError('')
    try {
      const data = await api.jds.importUrl(urlInput.trim())
      setTitle(data.title || '')
      setCompany(data.company || '')
      setRawText(data.rawText || '')
      setUrlInput('')
      addToast({ title: 'URL imported — review and save', variant: 'default' })
    } catch (err: any) {
      setUrlError(err?.response?.data?.detail ?? 'Failed to fetch URL')
    } finally {
      setUrlLoading(false)
    }
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (!rawText.trim()) errs.rawText = 'Job description text is required'
    else if (rawText.trim().length < 50) errs.rawText = 'Please provide a more detailed description'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      await api.jds.create(title, company || undefined, rawText)
      queryClient.invalidateQueries({ queryKey: ['jds'] })
      addToast({ title: 'Job description added', variant: 'success' })
      setAddOpen(false)
      setTitle('')
      setCompany('')
      setRawText('')
    } catch {
      addToast({ title: 'Failed to add job description', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Descriptions"
        description="Manage job descriptions for resume matching"
        action={
          <Button onClick={() => setAddOpen(true)} className="rounded-full shadow-sm hover:shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5">
            <Plus className="w-4 h-4 mr-2" />
            Add JD
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-200/50 dark:bg-slate-800/40 rounded-xl animate-pulse border border-gray-100/50 dark:border-slate-800/30" />
          ))}
        </div>
      ) : !jds || jds.length === 0 ? (
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No job descriptions yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Add a job description to start matching resumes
            </p>
            <Button onClick={() => setAddOpen(true)} className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5">
              <Plus className="w-4 h-4 mr-2" />
              Add JD
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jds.map((jd) => (
            <JDCard
              key={jd.id}
              jd={jd}
              onDelete={() => deleteMutation.mutate(jd.id)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === jd.id}
            />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-gray-950 dark:text-white">Add Job Description</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* URL Import */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Import from URL (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://jobs.example.com/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImportUrl}
                  disabled={!urlInput.trim() || urlLoading}
                  className="whitespace-nowrap rounded-xl border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent font-semibold px-4 h-10"
                >
                  {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                  {urlLoading ? 'Fetching...' : 'Import'}
                </Button>
              </div>
              {urlError && <p className="text-sm text-red-500 dark:text-red-400">{urlError}</p>}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200 dark:border-slate-800" /></div>
              <div className="relative flex justify-center text-[10px] text-gray-400 dark:text-gray-500 uppercase font-semibold"><span className="bg-white dark:bg-slate-900 px-2">or enter manually</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jd-title" className="text-xs font-semibold text-gray-600 dark:text-gray-400">Job Title *</Label>
                <Input
                  id="jd-title"
                  placeholder="e.g. Senior Software Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                  aria-invalid={!!errors.title}
                />
                {errors.title && <p className="text-sm text-red-500 dark:text-red-400">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="jd-company" className="text-xs font-semibold text-gray-600 dark:text-gray-400">Company</Label>
                <Input
                  id="jd-company"
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jd-text" className="text-xs font-semibold text-gray-600 dark:text-gray-400">Job Description Text *</Label>
              <Textarea
                id="jd-text"
                placeholder="Paste the full job description here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                className="text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500"
                aria-invalid={!!errors.rawText}
              />
              {errors.rawText && <p className="text-sm text-red-500 dark:text-red-400">{errors.rawText}</p>}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent font-semibold px-4 h-10">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10 shadow-sm">
                {isSubmitting ? 'Saving...' : 'Save JD'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function JDCard({
  jd,
  onDelete,
  isDeleting,
}: {
  jd: JobDescription
  onDelete: () => void
  isDeleting: boolean
}) {
  const preview = jd.rawText.slice(0, 120) + (jd.rawText.length > 120 ? '...' : '')

  return (
    <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl hover:shadow-md transition-all duration-200 overflow-hidden">
      <CardHeader className="pb-2 px-5 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/dashboard/jds/${jd.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <CardTitle className="text-sm font-semibold text-gray-950 dark:text-white truncate">{jd.title}</CardTitle>
            </Link>
            {jd.company && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{jd.company}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href={`/dashboard/jds/${jd.id}`}>
              <Button variant="ghost" size="sm" className="rounded-full text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 p-2">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-full text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 p-2"
              aria-label="Delete job description"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">{preview}</p>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-sans">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(jd.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
