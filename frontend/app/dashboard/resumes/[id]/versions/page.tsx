'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useUIStore } from '@/stores/ui'
import { formatDate, cn } from '@/lib/utils'
import { ArrowLeft, GitBranch, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface VersionInfo {
  id: string
  fileName: string
  atsScore: number | null
  createdAt: string
  isCurrent: boolean
  parentResumeId: string | null
}

export default function ResumeVersionsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { addToast } = useUIStore()

  const { data: versions = [], isLoading } = useQuery<VersionInfo[]>({
    queryKey: ['resume-versions', id],
    queryFn: () => api.resumes.getVersions(id),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/resumes/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <PageHeader title="Version History" description={`${versions.length} version${versions.length !== 1 ? 's' : ''}`} />
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No version history yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {versions.map((v, i) => {
              const prev = versions[i - 1]
              const scoreDelta = prev?.atsScore != null && v.atsScore != null
                ? v.atsScore - prev.atsScore
                : null

              return (
                <div key={v.id} className="relative flex items-start gap-4 pl-14">
                  {/* Timeline dot */}
                  <div className={cn(
                    'absolute left-4 w-4 h-4 rounded-full border-2 border-white shadow-sm',
                    v.isCurrent ? 'bg-indigo-600' : 'bg-gray-300'
                  )} />

                  <Card className={cn('flex-1', v.isCurrent && 'border-indigo-200 bg-indigo-50/30')}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{v.fileName}</p>
                            {v.isCurrent && (
                              <Badge className="text-xs bg-indigo-100 text-indigo-700">Current</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(v.createdAt)}</p>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {v.atsScore != null && (
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">{v.atsScore}</p>
                              <p className="text-xs text-gray-400">ATS Score</p>
                            </div>
                          )}

                          {scoreDelta !== null && (
                            <div className={cn(
                              'flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-lg',
                              scoreDelta > 0 ? 'bg-green-100 text-green-700' :
                              scoreDelta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            )}>
                              {scoreDelta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
                               scoreDelta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
                               <Minus className="w-3.5 h-3.5" />}
                              {scoreDelta > 0 ? '+' : ''}{scoreDelta}
                            </div>
                          )}

                          <Link href={`/dashboard/resumes/${v.id}`}>
                            <Button variant="outline" size="sm" className="text-xs">View</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
