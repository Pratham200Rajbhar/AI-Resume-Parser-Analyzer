'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/stores/ui'
import { api } from '@/lib/api'
import { ChevronDown, ChevronUp, Send, Star, HelpCircle, Sparkles, BookOpen, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InterviewQuestion {
  category: string
  question: string
  starTemplate: string
}

interface PracticeFeedback {
  score: number
  clarity: string
  specificity: string
  metricsUsage: string
  improvementNotes: string
}

const CATEGORY_COLORS: Record<string, string> = {
  behavioural: 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100/70 dark:border-blue-900/30',
  technical: 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100/70 dark:border-purple-900/30',
  situational: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/70 dark:border-emerald-900/30',
}

function QuestionCard({ q, index }: { q: InterviewQuestion; index: number }) {
  const [open, setOpen] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null)
  const { addToast } = useUIStore()

  const practiceMutation = useMutation({
    mutationFn: () => api.interviewPrep.practiceFeedback(q.question, answer),
    onSuccess: (data) => {
      setFeedback(data)
      addToast({ title: 'Feedback generated!', variant: 'default' })
    },
    onError: () => addToast({ title: 'Evaluation failed', description: 'Could not connect to evaluator model.', variant: 'destructive' }),
  })

  return (
    <Card className={cn(
      'glass-card border transition-all duration-200 rounded-2xl overflow-hidden shadow-sm',
      open ? 'border-blue-200/60 dark:border-blue-900/30 bg-white/80 dark:bg-slate-900/40 ring-1 ring-blue-50/20 dark:ring-blue-950/20' : 'border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 hover:border-gray-300 dark:hover:border-white/10'
    )}>
      <CardContent className="p-5 font-sans">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <span className="font-display text-sm font-semibold text-gray-400 dark:text-gray-500 mt-1 w-6 flex-shrink-0">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge className={cn('text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border shadow-none bg-transparent', CATEGORY_COLORS[q.category] ?? 'bg-gray-50 text-gray-700 border-gray-100')}>
                  {q.category}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-gray-950 dark:text-white leading-snug font-sans">{q.question}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(!open)}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full flex-shrink-0 w-8 h-8"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {open && (
          <div className="mt-5 space-y-4 pl-9 pr-2 border-t border-gray-100 dark:border-slate-800/60 pt-4 animate-fade-in">
            <div className="bg-gray-50/20 dark:bg-slate-800/20 rounded-2xl p-4 border border-gray-100 dark:border-slate-800/60">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-1.5 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-blue-500" /> Suggested STAR Approach
              </p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed font-normal">{q.starTemplate}</pre>
            </div>

            {!practiceMode ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPracticeMode(true)}
                className="rounded-full bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-slate-800/50 font-semibold px-4 h-9 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-500 dark:text-blue-400 animate-pulse" />
                Practice & Get AI Feedback
              </Button>
            ) : (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Your Response</Label>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Draft your answer here using the STAR format (Situation, Task, Action, Result)..."
                    rows={4}
                    className="text-sm rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500 font-sans p-3"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => practiceMutation.mutate()}
                    disabled={!answer.trim() || practiceMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold px-4 flex items-center gap-1.5 h-9 text-xs shadow-sm"
                  >
                    {practiceMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Evaluate Answer
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPracticeMode(false); setFeedback(null); setAnswer('') }}
                    className="rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold px-4 h-9 text-xs"
                  >
                    Cancel
                  </Button>
                </div>

                {feedback && (
                  <div className="bg-blue-50/20 dark:bg-blue-950/10 rounded-2xl p-5 border border-blue-100/30 dark:border-blue-900/20 space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/60 dark:border-blue-900/20 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-gray-950 dark:text-white">AI Quality Score:</span>
                        <div className="flex gap-0.5">
                          {[...Array(10)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn('w-3.5 h-3.5 transition-colors', i < feedback.score ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-gray-800')}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="font-display text-base font-bold text-blue-700 dark:text-blue-400">{feedback.score}/10</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                      <div className="space-y-1 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800/60">
                        <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[9px]">Clarity</span>
                        <p className="text-gray-700 dark:text-gray-300 leading-normal mt-0.5">{feedback.clarity}</p>
                      </div>
                      <div className="space-y-1 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800/60">
                        <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[9px]">Specificity</span>
                        <p className="text-gray-700 dark:text-gray-300 leading-normal mt-0.5">{feedback.specificity}</p>
                      </div>
                      <div className="space-y-1 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800/60">
                        <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[9px]">Metrics Usage</span>
                        <p className="text-gray-700 dark:text-gray-300 leading-normal mt-0.5">{feedback.metricsUsage}</p>
                      </div>
                    </div>

                    <div className="bg-white/60 dark:bg-slate-900/60 rounded-xl p-3.5 border border-blue-100 dark:border-blue-900/40 text-xs">
                      <span className="font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider text-[9px] block mb-1">Key Actionable Improvements</span>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-normal">{feedback.improvementNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function InterviewPrepPage() {
  const { addToast } = useUIStore()
  const [form, setForm] = useState({ resumeId: '', jdId: '' })
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])

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
      api.interviewPrep.generate(
        form.resumeId,
        form.jdId === 'none' || !form.jdId ? undefined : form.jdId
      ),
    onSuccess: (data) => {
      setQuestions(data)
      addToast({ title: 'Interview questions compiled!', description: `${data.length} questions customized for your background.`, variant: 'default' })
    },
    onError: () => addToast({ title: 'Generation failed', description: 'Could not connect to query builder.', variant: 'destructive' }),
  })

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Interview Prep"
        description="Generate tailor-made situational, behavioural, and technical questions powered by your parsed resume"
      />

      {/* Selector Options Card */}
      <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
        <CardContent className="p-6 font-sans">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Select Analyzed Resume</Label>
              <Select value={form.resumeId} onValueChange={(v) => setForm({ ...form, resumeId: v })}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                  <SelectValue placeholder="Choose a resume profile..." />
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
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Target Job Description (optional)</Label>
              <Select value={form.jdId} onValueChange={(v) => setForm({ ...form, jdId: v })}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500">
                  <SelectValue placeholder="Target a specific JD..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  <SelectItem value="none" className="text-xs rounded-lg dark:text-gray-200">None (General Industry Practice)</SelectItem>
                  {(jds ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs rounded-lg dark:text-gray-200">
                      {j.title} {j.company ? `(${j.company})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!form.resumeId || generateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 font-semibold shadow-sm w-full md:w-auto flex items-center justify-center gap-1.5"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Build Questions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions list container */}
      {questions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800/60 pb-3 font-sans">
            <h2 className="font-display text-base font-semibold text-gray-950 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Generated Prep Guide ({questions.length} Questions)
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {['behavioural', 'technical', 'situational'].map((cat) => {
                const count = questions.filter((q) => q.category === cat).length
                if (count === 0) return null
                return (
                  <Badge key={cat} className={cn('text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border shadow-none bg-transparent', CATEGORY_COLORS[cat])}>
                    {count} {cat}
                  </Badge>
                )
              })}
            </div>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionCard key={i} q={q} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-16 border border-dashed border-[#e0e0e0]/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/30 rounded-2xl text-center max-w-md mx-auto flex flex-col items-center justify-center font-sans">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400">
            <HelpCircle className="w-7 h-7" />
          </div>
          <h3 className="font-display text-sm font-semibold text-gray-950 dark:text-white">Prep material not created</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-sans leading-relaxed">
            Choose an analyzed resume to unlock interactive prep questions mapped directly to your skills.
          </p>
        </div>
      )}
    </div>
  )
}
