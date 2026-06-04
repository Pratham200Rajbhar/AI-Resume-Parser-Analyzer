'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUIStore } from '@/stores/ui'
import { api } from '@/lib/api'
import { GraduationCap, Clock, ExternalLink, Lightbulb, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LearningPlan, LearningPlanItem } from '@/types'

export default function LearningPlanPage() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [resumeId, setResumeId] = useState('')
  const [jdId, setJdId] = useState('')

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  const { data: learningPlans, isLoading: loadingPlans } = useQuery<LearningPlan[]>({
    queryKey: ['learningPlans'],
    queryFn: () => api.learningPlans.list(),
  })

  const generateMutation = useMutation({
    mutationFn: () => api.learningPlans.generate(resumeId, jdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learningPlans'] })
      addToast({
        title: 'Learning plan created',
        description: 'Successfully generated your personalized learning plan.',
        variant: 'default',
      })
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      addToast({
        title: 'Generation failed',
        description: detail ?? 'Failed to generate learning plan. Did you run match analysis first?',
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (planId: string) => api.learningPlans.remove(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learningPlans'] })
      addToast({
        title: 'Plan deleted',
        variant: 'default',
      })
    },
  })

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  function getImportanceBadge(importance: string) {
    const imp = importance.toLowerCase()
    if (imp === 'high') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">High Priority</Badge>
    if (imp === 'medium') return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Medium Priority</Badge>
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Low Priority</Badge>
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Learning Plans"
        description="Convert your skill gaps into an actionable, prioritized learning roadmap."
      />

      {/* Config */}
      <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 shadow-sm rounded-2xl">
        <CardContent className="p-6 font-sans">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Target Resume</Label>
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
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Target Job Description</Label>
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
              onClick={() => generateMutation.mutate()}
              disabled={!resumeId || !jdId || generateMutation.isPending}
              className="h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-sm transition-all"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans List */}
      {loadingPlans ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : learningPlans?.length === 0 ? (
        <Card className="border-dashed shadow-none bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-gray-500 dark:text-gray-400">
            <GraduationCap className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No learning plans yet</p>
            <p className="text-sm mt-1 max-w-md">Select a resume and a job description to generate your first personalized learning roadmap based on skill gaps.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {learningPlans?.map((plan: LearningPlan) => {
            const items: LearningPlanItem[] = typeof plan.planJson === 'string'
              ? JSON.parse(plan.planJson)
              : plan.planJson
            return (
              <Card key={plan.id} className="rounded-2xl border border-gray-100 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 shadow-sm overflow-hidden">
                <CardHeader className="p-6 pb-4 flex flex-row items-start justify-between bg-gray-50/50 dark:bg-slate-800/20 border-b border-gray-100 dark:border-slate-800/60">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      {plan.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Created on {new Date(plan.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    onClick={() => deleteMutation.mutate(plan.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {items.map((item: LearningPlanItem, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{item.skill}</h4>
                            {getImportanceBadge(item.importance)}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{item.action}</span>
                            &bull;
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {item.timeEstimate || item.time_estimate}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                          <div className="text-xs bg-gray-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700/50 text-gray-700 dark:text-gray-300 flex gap-2 items-start max-w-sm">
                            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>{item.projectIdea || item.project_idea}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                            <ExternalLink className="w-3.5 h-3.5" />
                            {item.resource}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}