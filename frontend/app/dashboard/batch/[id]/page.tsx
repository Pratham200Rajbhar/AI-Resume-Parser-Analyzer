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
      <div className="flex items-center gap-3">
        <Link href="/dashboard/batch">
          <button className="btn btn-sm btn-ghost">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Batches
          </button>
        </Link>
      </div>

      <PageHeader
        title="Batch Rankings"
        description={`${batch.totalCount} candidates processed`}
        action={
          batch.status === 'COMPLETE' && (
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          )
        }
      />

      {batch.status === 'IN_PROGRESS' && (
        <div className="card">
          <div className="card-body space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Processing resumes...</span>
              <span className="font-medium text-white">
                {batch.completedCount}/{batch.totalCount}
              </span>
            </div>
            <Progress value={pct} />
            <p className="text-xs text-slate-500">This page will update automatically</p>
          </div>
        </div>
      )}

      {batch.status === 'COMPLETE' && (
        <>
          <div className="grid-3">
            <div className="card">
              <div className="card-body text-center">
                <p className="text-2xl font-bold text-white">{batch.totalCount}</p>
                <p className="text-xs text-slate-400 mt-1">Total Candidates</p>
              </div>
            </div>
            <div className="card">
              <div className="card-body text-center">
                <p className="text-2xl font-bold text-emerald-400">{batch.completedCount}</p>
                <p className="text-xs text-slate-400 mt-1">Analyzed</p>
              </div>
            </div>
            <div className="card">
              <div className="card-body text-center">
                <p className="text-2xl font-bold text-rose-400">{batch.failedCount}</p>
                <p className="text-xs text-slate-400 mt-1">Failed</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Candidate Rankings</h2>
            </div>
            <div className="card-body p-0">
              {rankingsLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton h-12" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No rankings available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
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
                            className="cursor-pointer select-none hover:text-white"
                            onClick={() => handleSort(col.key)}
                          >
                            <div className="flex items-center gap-1">
                              {col.label}
                              {sortKey === col.key ? (
                                sortDir === 'asc' ? (
                                  <ChevronUp className="w-3 h-3 text-blue-400" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-blue-400" />
                                )
                              ) : null}
                            </div>
                          </th>
                        ))}
                        <th>Candidate</th>
                        <th />
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
            </div>
          </div>
        </>
      )}

      {batch.status === 'FAILED' && (
        <div className="card">
          <div className="card-body py-12 text-center">
            <p className="text-rose-400 font-medium">Batch processing failed</p>
            <p className="text-sm text-slate-500 mt-1">Please try creating a new batch</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreCell({ score }: { score: number }) {
  const badgeClass =
    score >= 75
      ? 'badge badge-emerald'
      : score >= 50
      ? 'badge badge-amber'
      : 'badge badge-rose'

  return <span className={badgeClass}>{Math.round(score)}</span>
}

function RankRow({ candidate }: { candidate: RankedCandidate }) {
  const name = candidate.entities?.name ?? candidate.fileName ?? 'Unknown'

  return (
    <tr>
      <td>
        <div className="flex items-center gap-1.5">
          {candidate.rank <= 3 && (
            <Trophy
              className={cn(
                'w-4 h-4',
                candidate.rank === 1
                  ? 'text-yellow-400'
                  : candidate.rank === 2
                  ? 'text-slate-300'
                  : 'text-amber-500'
              )}
            />
          )}
          <span className="text-sm font-bold text-white">#{candidate.rank}</span>
        </div>
      </td>
      <td>
        <ScoreCell score={candidate.compositeScore} />
      </td>
      <td>
        <ScoreCell score={candidate.atsScore} />
      </td>
      <td>
        <ScoreCell score={candidate.matchScore} />
      </td>
      <td>
        <ScoreCell score={candidate.skillsScore} />
      </td>
      <td>
        <ScoreCell score={candidate.experienceScore} />
      </td>
      <td>
        <ScoreCell score={candidate.educationScore} />
      </td>
      <td>
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-slate-400 truncate max-w-[140px] font-sans mt-0.5">{candidate.fileName}</p>
        </div>
      </td>
      <td className="text-right">
        <Link href={`/dashboard/resumes/${candidate.resumeId}`}>
          <button className="btn btn-sm btn-secondary">
            View
          </button>
        </Link>
      </td>
    </tr>
  )
}
