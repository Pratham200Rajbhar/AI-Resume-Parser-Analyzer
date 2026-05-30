'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useUIStore } from '@/stores/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScoreGauge } from '@/components/analysis/ScoreGauge'
import { ATSBreakdown } from '@/components/analysis/ATSBreakdown'
import { SkillsRadar } from '@/components/analysis/SkillsRadar'
import { EntityPanel } from '@/components/analysis/EntityPanel'
import { SkillGapChart } from '@/components/analysis/SkillGapChart'
import { CareerTimeline } from '@/components/analysis/CareerTimeline'
import { BiasFlags } from '@/components/analysis/BiasFlags'
import { formatDate, getStatusColor, getStatusLabel, cn } from '@/lib/utils'
import {
  Download,
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { JdMatchResult } from '@/types'

export default function ResumeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { addToast } = useUIStore()
  const resumeId = params.id as string

  const [selectedJdId, setSelectedJdId] = useState<string>('')
  const [matchResult, setMatchResult] = useState<JdMatchResult | null>(null)
  const [isMatching, setIsMatching] = useState(false)
  const [biasOpen, setBiasOpen] = useState(false)
  const [fraudOpen, setFraudOpen] = useState(false)

  const { data: resume, isLoading: resumeLoading } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => api.resumes.get(resumeId),
    enabled: !!resumeId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && status !== 'ANALYZED' && status !== 'FAILED' ? 3000 : false
    },
  })

  const { data: analysis, isLoading: analysisLoading } = useAnalysis(resumeId)

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  async function handleExportPdf() {
    try {
      const blob = await api.resumes.exportPdf(resumeId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resume?.fileName ?? 'resume'}-analysis.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  async function handleMatch() {
    if (!selectedJdId) return
    setIsMatching(true)
    try {
      const result = await api.jds.match(selectedJdId, resumeId)
      setMatchResult(result)
    } catch {
      addToast({ title: 'Match failed', variant: 'destructive' })
    } finally {
      setIsMatching(false)
    }
  }

  if (resumeLoading || analysisLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!resume) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Resume not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    )
  }

  const entities = analysis?.entitiesJson
  const biasFlags = analysis?.biasFlagsJson ?? []
  const fraudFlags = analysis?.fraudFlagsJson ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Link href="/dashboard/resumes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Resumes
          </Button>
        </Link>
      </div>

      <PageHeader
        title={resume.fileName}
        description={`Uploaded ${formatDate(resume.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <Badge className={cn(getStatusColor(resume.status))}>
              {getStatusLabel(resume.status)}
            </Badge>
            {analysis && (
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
          </div>
        }
      />

      {!analysis ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              {resume.status === 'FAILED'
                ? 'Analysis failed for this resume.'
                : 'Analysis is in progress. Please check back shortly.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score + Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="flex flex-col items-center justify-center py-8">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-base">ATS Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <ScoreGauge score={analysis.atsScore} size={160} label="ATS" />
                <p className="text-sm text-gray-500 text-center">
                  {analysis.atsScore >= 75
                    ? 'Great ATS compatibility'
                    : analysis.atsScore >= 50
                    ? 'Moderate ATS compatibility'
                    : 'Low ATS compatibility'}
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ATSBreakdown breakdown={analysis.atsBreakdown} />
              </CardContent>
            </Card>
          </div>

          {/* Suggestions */}
          {analysis.atsBreakdown.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Improvement Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.atsBreakdown.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Skills Radar */}
          {entities && entities.skills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Skills Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <SkillsRadar skills={entities.skills} />
              </CardContent>
            </Card>
          )}

          {/* Entities */}
          {entities && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Extracted Information</CardTitle>
              </CardHeader>
              <CardContent>
                <EntityPanel entities={entities} />
              </CardContent>
            </Card>
          )}

          {/* Career Timeline */}
          {entities && entities.experience.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Career Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <CareerTimeline experience={entities.experience} />
              </CardContent>
            </Card>
          )}

          {/* JD Match */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Job Description Match</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Select value={selectedJdId} onValueChange={setSelectedJdId}>
                  <SelectTrigger className="flex-1">
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
                <Button onClick={handleMatch} disabled={!selectedJdId || isMatching}>
                  {isMatching ? 'Matching...' : 'Match'}
                </Button>
              </div>

              {matchResult && <SkillGapChart matchResult={matchResult} />}
            </CardContent>
          </Card>

          {/* Bias Flags */}
          {biasFlags.length > 0 && (
            <Card>
              <button
                className="w-full"
                onClick={() => setBiasOpen((o) => !o)}
                aria-expanded={biasOpen}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <CardTitle className="text-base">
                        Bias Flags ({biasFlags.length})
                      </CardTitle>
                    </div>
                    {biasOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
              </button>
              {biasOpen && (
                <CardContent>
                  <BiasFlags flags={biasFlags} />
                </CardContent>
              )}
            </Card>
          )}

          {/* Fraud Flags */}
          {fraudFlags.length > 0 && (
            <Card>
              <button
                className="w-full"
                onClick={() => setFraudOpen((o) => !o)}
                aria-expanded={fraudOpen}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <CardTitle className="text-base">
                        Fraud Flags ({fraudFlags.length})
                      </CardTitle>
                    </div>
                    {fraudOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
              </button>
              {fraudOpen && (
                <CardContent>
                  <div className="space-y-3">
                    {fraudFlags.map((flag, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-red-100 bg-red-50 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            className={cn(
                              'text-xs',
                              flag.severity === 'high'
                                ? 'bg-red-100 text-red-800'
                                : flag.severity === 'medium'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                            )}
                          >
                            {flag.severity}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900">{flag.type}</span>
                        </div>
                        <p className="text-sm text-gray-600">{flag.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
