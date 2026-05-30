'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useUIStore } from '@/stores/ui'
import { formatScore, cn } from '@/lib/utils'
import { ArrowLeft, Download, Trophy, ChevronUp, ChevronDown } from 'lucide-react'
import type { RankedCandidate } from '@/types'

type SortKey = 'rank' | 'compositeScore' | 'atsScore' | 'matchScore' | 'skillsScore' | 'experienceScore' | 'educationScore'

export default function BatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { addToast } = useUIStore()
  const batchId = params.id as string

  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => api.batches.getStatus(batchId),
    enabled: !!batchId,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'IN_PROGRESS' ? 3000 : false
    },
  })

  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ['batch-rankings', batchId],
    queryFn: () => api.batches.getRankings(batchId),
    enabled: !!batchId && batch?.status === 'COMPLETE',
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'rank' ? 'asc' : 'desc')
    }
  }

  async function handleExportCsv() {
    try {
      const blob = await api.batches.exportCsv(batchId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-${batchId}-rankings.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const sorted = [...(rankings ?? [])].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    const dir = sortDir === 'asc' ? 1 : -1
    return (aVal - bVal) * dir
  })

  const pct =
    batch && batch.totalCount > 0
      ? Math.round((batch.completedCount / batch.totalCount) * 100)
      : 0

  if (batchLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Batch not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/batch">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Batches
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Batch Rankings"
        description={`${batch.totalCount} candidates processed`}
        action={
          batch.status === 'COMPLETE' && (
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )
        }
      />

      {batch.status === 'IN_PROGRESS' && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Processing resumes...</span>
              <span className="font-medium">
                {batch.completedCount}/{batch.totalCount}
              </span>
            </div>
            <Progress value={pct} />
            <p className="text-xs text-gray-400">This page will update automatically</p>
          </CardContent>
        </Card>
      )}

      {batch.status === 'COMPLETE' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{batch.totalCount}</p>
                <p className="text-xs text-gray-500 mt-1">Total Candidates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{batch.completedCount}</p>
                <p className="text-xs text-gray-500 mt-1">Analyzed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{batch.failedCount}</p>
                <p className="text-xs text-gray-500 mt-1">Failed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Candidate Rankings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rankingsLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">No rankings available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {(
                          [
                            { key: 'rank', label: 'Rank' },
                            { key: 'compositeScore', label: 'Composite' },
                            { key: 'atsScore', label: 'ATS' },
                            { key: 'matchScore', label: 'JD Match' },
                            { key: 'skillsScore', label: 'Skills' },
                            { key: 'experienceScore', label: 'Experience' },
                            { key: 'educationScore', label: 'Education' },
                          ] as { key: SortKey; label: string }[]
                        ).map((col) => (
                          <th
                            key={col.key}
                            className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
                            onClick={() => handleSort(col.key)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {sortKey === col.key ? (
                                sortDir === 'asc' ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )
                              ) : null}
                            </div>
                          </th>
                        ))}
                        <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Candidate
                        </th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((candidate) => (
                        <RankRow key={candidate.resumeId} candidate={candidate} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {batch.status === 'FAILED' && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 font-medium">Batch processing failed</p>
            <p className="text-sm text-gray-500 mt-1">Please try creating a new batch</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ScoreCell({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-12 h-7 rounded-full text-xs font-semibold',
        score >= 75
          ? 'bg-green-100 text-green-800'
          : score >= 50
          ? 'bg-amber-100 text-amber-800'
          : 'bg-red-100 text-red-800'
      )}
    >
      {Math.round(score)}
    </span>
  )
}

function RankRow({ candidate }: { candidate: RankedCandidate }) {
  const name = candidate.entities.name ?? candidate.fileName

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          {candidate.rank <= 3 && (
            <Trophy
              className={cn(
                'w-4 h-4',
                candidate.rank === 1
                  ? 'text-yellow-500'
                  : candidate.rank === 2
                  ? 'text-gray-400'
                  : 'text-amber-600'
              )}
            />
          )}
          <span className="text-sm font-semibold text-gray-900">#{candidate.rank}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <ScoreCell score={candidate.compositeScore} />
      </td>
      <td className="py-3 px-4">
        <ScoreCell score={candidate.atsScore} />
      </td>
      <td className="py-3 px-4">
        <ScoreCell score={candidate.matchScore} />
      </td>
      <td className="py-3 px-4">
        <ScoreCell score={candidate.skillsScore} />
      </td>
      <td className="py-3 px-4">
        <ScoreCell score={candidate.experienceScore} />
      </td>
      <td className="py-3 px-4">
        <ScoreCell score={candidate.educationScore} />
      </td>
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-400 truncate max-w-[140px]">{candidate.fileName}</p>
        </div>
      </td>
      <td className="py-3 px-4">
        <Link href={`/dashboard/resumes/${candidate.resumeId}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      </td>
    </tr>
  )
}
