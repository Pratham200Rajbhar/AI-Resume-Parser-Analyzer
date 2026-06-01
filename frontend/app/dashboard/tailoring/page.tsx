'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUIStore } from '@/stores/ui'
import { api, type TailorResult } from '@/lib/api'
import { Wand2, Sparkles, TrendingUp, ArrowRight, Download, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ScoreDelta({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before
  return (
    <div className="flex-1 rounded-2xl border border-gray-100 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-lg font-semibold text-gray-400 dark:text-gray-500 line-through decoration-1">{before}</span>
        <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
        <span className="font-display text-2xl font-bold text-gray-950 dark:text-white">{after}</span>
        {delta !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              delta > 0
                ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            )}
          >
            <TrendingUp className={cn('h-3.5 w-3.5', delta < 0 && 'rotate-180')} />
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  )
}

export default function TailoringStudioPage() {
  const { addToast } = useUIStore()
  const [resumeId, setResumeId] = useState('')
  const [jdId, setJdId] = useState('')
  const [result, setResult] = useState<TailorResult | null>(null)
  const [exporting, setExporting] = useState(false)

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  const tailorMutation = useMutation({
    mutationFn: () => api.tailoring.generate(resumeId, jdId),
    onSuccess: (data) => {
      setResult(data)
      addToast({
        title: 'Resume tailored',
        description: `ATS ${data.before.atsScore} → ${data.after.atsScore}, match ${data.before.matchScore}% → ${data.after.matchScore}%`,
        variant: 'default',
      })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      addToast({
        title: 'Tailoring failed',
        description: detail ?? 'The tailoring service is unavailable. Please try again.',
        variant: 'destructive',
      })
    },
  })

  async function handleExport(format: 'pdf' | 'docx') {
    if (!result) return
    setExporting(true)
    try {
      const blob =
        format === 'pdf'
          ? await api.resumes.exportPdf(result.newResumeId)
          : await api.resumes.exportFormat(result.newResumeId, 'docx')
      downloadBlob(blob, `tailored-resume.${format}`)
      addToast({ title: `Exported as ${format.toUpperCase()}`, variant: 'default' })
    } catch {
      addToast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Tailoring Studio"
        description="Generate an ATS-optimized version of your resume targeted to a specific job, with a measured before/after lift"
      />

      {/* Config */}
      <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
        <CardContent className="p-6 font-sans">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Resume to tailor</Label>
              <Select value={resumeId} onValueChange={setResumeId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                  <SelectValue placeholder="Choose an analyzed resume..." />
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
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Target job description</Label>
              <Select value={jdId} onValueChange={setJdId}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                  <SelectValue placeholder="Choose the job to target..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  {(jds ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs rounded-lg dark:text-gray-200">
                      {j.title} {j.company ? `(${j.company})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => tailorMutation.mutate()}
              disabled={!resumeId || !jdId || tailorMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 font-semibold shadow-sm w-full md:w-auto flex items-center justify-center gap-1.5"
            >
              {tailorMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Tailoring...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Tailor Resume
                </>
              )}
            </Button>
          </div>
          {analyzedResumes.length === 0 && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              No analyzed resumes yet — upload and analyze a resume first.
            </p>
          )}
        </CardContent>
      </Card>

      {result ? (
        <div className="space-y-6">
          {/* Score lift */}
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
            <CardHeader className="px-6 pt-6 pb-2">
              <CardTitle className="font-display text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Projected Improvement
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <ScoreDelta label="ATS Score" before={result.before.atsScore} after={result.after.atsScore} />
                <ScoreDelta label="JD Match" before={result.before.matchScore} after={result.after.matchScore} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  className="rounded-full h-9 px-4 text-xs font-semibold border-gray-200 dark:border-slate-800 dark:text-gray-300"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('docx')}
                  disabled={exporting}
                  className="rounded-full h-9 px-4 text-xs font-semibold border-gray-200 dark:border-slate-800 dark:text-gray-300"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export DOCX
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Added keywords */}
          {result.addedKeywords.length > 0 && (
            <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
              <CardHeader className="px-6 pt-6 pb-2">
                <CardTitle className="font-display text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Keywords now covered ({result.addedKeywords.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="flex flex-wrap gap-1.5">
                  {result.addedKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      className="rounded-full bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-100/60 dark:border-green-900/30 text-xs shadow-none"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tailored summary */}
          {result.summary && (
            <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
              <CardHeader className="px-6 pt-6 pb-2">
                <CardTitle className="font-display text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Tailored Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 font-sans">{result.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Rewritten experience */}
          {result.rewrittenExperiences.length > 0 && (
            <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
              <CardHeader className="px-6 pt-6 pb-2">
                <CardTitle className="font-display text-sm font-semibold text-gray-950 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Rewritten Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-5">
                {result.rewrittenExperiences.map((exp, i) => (
                  <div key={i} className="border-l-2 border-blue-100 dark:border-blue-900/40 pl-4">
                    <p className="text-sm font-semibold text-gray-950 dark:text-white">
                      {exp.role}
                      {exp.company ? <span className="text-gray-400 dark:text-gray-500 font-normal"> · {exp.company}</span> : null}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {exp.rewrittenBullets.map((b, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-blue-400" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="p-16 border border-dashed border-[#e0e0e0]/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/30 rounded-2xl text-center max-w-md mx-auto flex flex-col items-center justify-center font-sans">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400">
            <Wand2 className="w-7 h-7" />
          </div>
          <h3 className="font-display text-sm font-semibold text-gray-950 dark:text-white">No tailored resume yet</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-sans leading-relaxed">
            Pick an analyzed resume and a target job, then let the studio rewrite it to maximize ATS match. The result is saved as a new version you can export.
          </p>
        </div>
      )}
    </div>
  )
}
