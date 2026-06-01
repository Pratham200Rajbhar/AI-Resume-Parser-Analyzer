'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SharedReport {
  token: string
  visibleSections: string[]
  atsScore?: number
  atsBreakdown?: Record<string, unknown>
  entities?: Record<string, unknown>
  biasFlags?: unknown[]
  fraudFlags?: unknown[]
}

export default function SharedReportPage({ params }: { params: { token: string } }) {
  const { token } = params

  const { data, isLoading, error } = useQuery<SharedReport>({
    queryKey: ['shared-report', token],
    queryFn: () => api.share.getShared(token) as unknown as Promise<SharedReport>,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h1>
          <p className="text-gray-500">This link may have expired or been deleted.</p>
        </div>
      </div>
    )
  }

  const entities = data?.entities as any
  const breakdown = data?.atsBreakdown as any

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Resume Analysis Report</h1>
          <p className="text-sm text-gray-500 mt-1">Shared via ResumeAI</p>
        </div>

        {data?.atsScore !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">ATS Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={cn(
                  'text-5xl font-bold',
                  data.atsScore >= 70 ? 'text-green-600' :
                  data.atsScore >= 40 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {data.atsScore}
                </div>
                <div className="text-gray-400 text-lg">/100</div>
              </div>
            </CardContent>
          </Card>
        )}

        {breakdown && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(breakdown).filter(([k]) => k !== 'suggestions').map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm capitalize text-gray-600">{key}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.min(100, Number(val))}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{String(val)}</span>
                  </div>
                </div>
              ))}
              {breakdown.suggestions?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Suggestions</p>
                  <ul className="space-y-1">
                    {breakdown.suggestions.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-indigo-400 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {entities && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Candidate Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {entities.name && <p className="text-lg font-semibold">{entities.name}</p>}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {entities.email && <div><span className="text-gray-400">Email:</span> {entities.email}</div>}
                {entities.phone && <div><span className="text-gray-400">Phone:</span> {entities.phone}</div>}
                {entities.location && <div><span className="text-gray-400">Location:</span> {entities.location}</div>}
              </div>
              {entities.skills?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {entities.skills.slice(0, 20).map((s: any) => (
                      <Badge key={s.normalized} className="text-xs bg-indigo-50 text-indigo-700">
                        {s.normalized}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
