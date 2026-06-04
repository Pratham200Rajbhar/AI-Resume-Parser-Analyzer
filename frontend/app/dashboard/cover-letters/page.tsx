'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useUIStore } from '@/stores/ui'
import { api } from '@/lib/api'
import { Copy, Download, Trash2, FileText, Sparkles, Mail, Eye, Clock, Check, Loader2, Save } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CoverLetter {
  id: string
  resumeId: string
  jobDescriptionId: string | null
  title: string
  content: string
  tone: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'concise', label: 'Concise' },
]

const LENGTHS = [
  { value: 150, label: 'Short (~150 words)' },
  { value: 300, label: 'Standard (~300 words)' },
  { value: 500, label: 'Detailed (~500 words)' },
]

export default function CoverLettersPage() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [selectedLetter, setSelectedLetter] = useState<CoverLetter | null>(null)
  const [form, setForm] = useState({ resumeId: '', jdId: '', tone: 'professional', wordCount: 300 })
  const [editContent, setEditContent] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  const { data: letters = [], isLoading } = useQuery<CoverLetter[]>({
    queryKey: ['cover-letters'],
    queryFn: () => api.coverLetters.list(),
  })

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      api.coverLetters.generate(
        form.resumeId,
        form.jdId === 'none' || !form.jdId ? undefined : form.jdId,
        form.tone,
        form.wordCount
      ),
    onSuccess: (letter) => {
      queryClient.invalidateQueries({ queryKey: ['cover-letters'] })
      setSelectedLetter(letter)
      setEditContent(letter.content)
      addToast({ title: 'Cover letter generated successfully!', variant: 'default' })
    },
    onError: () => addToast({ title: 'Generation failed', description: 'Could not connect to generator models.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.coverLetters.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cover-letters'] })
      if (selectedLetter) setSelectedLetter(null)
      addToast({ title: 'Cover letter deleted', variant: 'default' })
    },
    onError: () => addToast({ title: 'Failed to delete letter', variant: 'destructive' }),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.coverLetters.update(selectedLetter!.id, { content: editContent }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['cover-letters'] })
      setSelectedLetter(updated)
      addToast({ title: 'Changes saved', variant: 'default' })
    },
    onError: () => addToast({ title: 'Failed to save changes', variant: 'destructive' }),
  })

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  function handleCopy() {
    navigator.clipboard.writeText(editContent || selectedLetter?.content || '')
    setIsCopied(true)
    addToast({ title: 'Copied to clipboard', variant: 'default' })
    setTimeout(() => setIsCopied(false), 2000)
  }

  function handleDownload() {
    const content = editContent || selectedLetter?.content || ''
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedLetter?.title || 'cover-letter'}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    addToast({ title: 'Downloaded text file', variant: 'default' })
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Cover Letters"
        description="Craft compelling, AI-tailored cover letters that perfectly align your background with roles"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Sidebar Controls */}
        <div className="space-y-5">
          {/* Generation Config Card */}
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="font-display text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                AI Cover Letter Builder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Select Resume</Label>
                <Select value={form.resumeId} onValueChange={(v) => setForm({ ...form, resumeId: v })}>
                  <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                    <SelectValue placeholder="Which resume should we analyze?" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                    {analyzedResumes.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs rounded-lg dark:text-gray-200">
                        {r.analysis?.entitiesJson?.name ?? r.fileName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Job Description (optional)</Label>
                <Select value={form.jdId} onValueChange={(v) => setForm({ ...form, jdId: v })}>
                  <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                    <SelectValue placeholder="Align to a specific job..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                    <SelectItem value="none" className="text-xs rounded-lg dark:text-gray-200">None (General Pitch)</SelectItem>
                    {(jds ?? []).map((j) => (
                      <SelectItem key={j.id} value={j.id} className="text-xs rounded-lg dark:text-gray-200">
                        {j.title} {j.company ? `(${j.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tone</Label>
                  <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                    <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs rounded-lg dark:text-gray-200">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Length</Label>
                  <Select value={String(form.wordCount)} onValueChange={(v) => setForm({ ...form, wordCount: Number(v) })}>
                    <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                      {LENGTHS.map((l) => (
                        <SelectItem key={l.value} value={String(l.value)} className="text-xs rounded-lg dark:text-gray-200">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all duration-150 flex items-center justify-center gap-1.5"
                onClick={() => generateMutation.mutate()}
                disabled={!form.resumeId || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Pitch...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Cover Letter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Saved letters history */}
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-5 border-b border-gray-100 dark:border-slate-800/60">
              <CardTitle className="font-display text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Saved Documents ({letters.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-11 bg-gray-50/50 dark:bg-slate-800/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : letters.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <Mail className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">No cover letters generated yet.</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 scrollbar-thin">
                  {letters.map((l) => (
                    <button
                      key={l.id}
                      className={`w-full text-left px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-all flex items-start gap-3 ${selectedLetter?.id === l.id ? 'bg-blue-50/60 dark:bg-blue-950/20 border-l-4 border-blue-600 dark:border-blue-500' : 'border-l-4 border-transparent'}`}
                      onClick={() => { setSelectedLetter(l); setEditContent(l.content) }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">{l.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-0.5"><Clock className="w-3.5 h-3.5" /> {formatDate(l.createdAt)}</span>
                          <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.2 rounded font-sans uppercase font-semibold scale-90">{l.tone}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Google Doc Editor View */}
        <div className="lg:col-span-2">
          {selectedLetter ? (
            <div className="flex flex-col h-full rounded-2xl border border-[#e0e0e0]/40 dark:border-white/5 shadow-sm overflow-hidden bg-[#ffffff] dark:bg-slate-900/30">
              {/* Document bar */}
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/50 dark:bg-slate-950/20">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <h3 className="font-display text-sm font-semibold text-gray-900 dark:text-white truncate leading-none">
                      {selectedLetter.title}
                    </h3>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium font-sans mt-1">
                    Word count: ~{selectedLetter.wordCount} words · Edited in real-time
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold text-gray-600 dark:text-gray-300 px-3 flex items-center gap-1.5"
                    onClick={handleCopy}
                  >
                    {isCopied ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold text-gray-600 dark:text-gray-300 px-3 flex items-center gap-1.5"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 flex items-center gap-1.5 shadow-sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || editContent === selectedLetter?.content}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </Button>
                  <div className="w-px h-5 bg-gray-200 dark:bg-slate-800 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2"
                    onClick={() => deleteMutation.mutate(selectedLetter.id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-red-600 dark:text-red-400" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Page editor canvas */}
              <div className="p-6 md:p-8 bg-[#f0f4f9]/80 dark:bg-slate-950/40 min-h-[550px] flex justify-center overflow-y-auto">
                <div className="w-full max-w-[650px] bg-white dark:bg-slate-900 border border-[#e0e0e0] dark:border-slate-800 shadow-md dark:shadow-2xl p-8 md:p-12 min-h-[500px] flex flex-col font-sans relative">
                  {/* Google Doc margin lines or elegant header */}
                  <div className="absolute top-4 left-6 right-6 border-b border-gray-100 dark:border-slate-800 pb-2 text-[10px] text-gray-300 dark:text-gray-600 font-sans uppercase flex justify-between select-none">
                    <span>ResumeAI SmartDoc</span>
                    <span>Tone: {selectedLetter.tone}</span>
                  </div>

                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full flex-1 border-none focus-visible:ring-0 p-0 text-[#202124] dark:text-gray-100 leading-relaxed text-sm md:text-[14.5px] font-sans resize-none mt-4 font-normal bg-transparent focus:ring-0 focus-visible:outline-none"
                    placeholder="Document body is generating..."
                    style={{ minHeight: '440px' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Card className="h-full min-h-[450px] flex flex-col items-center justify-center border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 glass-card shadow-sm rounded-2xl p-8">
              <div className="text-center max-w-[280px]">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/20 rounded-full flex items-center justify-center mb-4 mx-auto border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Mail className="w-7 h-7" />
                </div>
                <h3 className="font-display text-sm font-semibold text-gray-950 dark:text-white">Select a letter to display</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-sans">
                  Choose an existing document from the sidebar history or tweak settings and click Generate.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
