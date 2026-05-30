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
import { Plus, Trash2, Briefcase, Building2, Calendar } from 'lucide-react'
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
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add JD
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !jds || jds.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No job descriptions yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add a job description to start matching resumes
            </p>
            <Button onClick={() => setAddOpen(true)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Job Description</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jd-title">Job Title *</Label>
                <Input
                  id="jd-title"
                  placeholder="e.g. Senior Software Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={!!errors.title}
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="jd-company">Company</Label>
                <Input
                  id="jd-company"
                  placeholder="e.g. Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jd-text">Job Description Text *</Label>
              <Textarea
                id="jd-text"
                placeholder="Paste the full job description here..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={10}
                aria-invalid={!!errors.rawText}
              />
              {errors.rawText && <p className="text-sm text-red-500">{errors.rawText}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{jd.title}</CardTitle>
            {jd.company && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{jd.company}</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
            aria-label="Delete job description"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">{preview}</p>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(jd.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
