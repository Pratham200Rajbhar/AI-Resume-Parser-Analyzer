'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/upload/DropZone'
import { formatDate, formatFileSize, getStatusColor, getStatusLabel, formatScore, cn } from '@/lib/utils'
import { FileText, TrendingUp, Layers, MessageSquare, ArrowRight, Upload } from 'lucide-react'
import type { Resume, BatchJob, CoachingSession } from '@/types'

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
          </div>
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ResumeRow({ resume }: { resume: Resume }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
            {resume.fileName}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge className={cn('text-xs', getStatusColor(resume.status))}>
          {getStatusLabel(resume.status)}
        </Badge>
      </td>
      <td className="py-3 px-4">
        {resume.analysis ? (
          <span className={cn('text-sm font-semibold', formatScore(resume.analysis.atsScore))}>
            {resume.analysis.atsScore}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-gray-500">{formatDate(resume.createdAt)}</span>
      </td>
      <td className="py-3 px-4">
        <Link href={`/dashboard/resumes/${resume.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      </td>
    </tr>
  )
}

export default function DashboardPage() {
  const { data: resumesData, isLoading: resumesLoading } = useQuery({
    queryKey: ['resumes', 1, 5],
    queryFn: () => api.resumes.list(1, 5),
  })

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.batches.list(),
  })

  const { data: sessions } = useQuery({
    queryKey: ['coaching-sessions'],
    queryFn: () => api.coaching.listSessions(),
  })

  const resumes = resumesData?.items ?? []
  const totalResumes = resumesData?.total ?? 0
  const analyzedResumes = resumes.filter((r) => r.status === 'ANALYZED')
  const avgAts =
    analyzedResumes.length > 0
      ? Math.round(
          analyzedResumes.reduce((sum, r) => sum + (r.analysis?.atsScore ?? 0), 0) /
            analyzedResumes.length
        )
      : 0
  const activeBatches = (batches ?? []).filter((b: BatchJob) => b.status === 'IN_PROGRESS').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your resume analysis dashboard"
        action={
          <Link href="/dashboard/resumes">
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Resume
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Resumes"
          value={totalResumes}
          icon={FileText}
          color="bg-indigo-500"
        />
        <StatCard
          title="Avg ATS Score"
          value={avgAts > 0 ? `${avgAts}` : '—'}
          icon={TrendingUp}
          description="Across analyzed resumes"
          color="bg-green-500"
        />
        <StatCard
          title="Active Batches"
          value={activeBatches}
          icon={Layers}
          color="bg-amber-500"
        />
        <StatCard
          title="Coach Sessions"
          value={(sessions ?? []).length}
          icon={MessageSquare}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Recent Resumes</CardTitle>
              <Link href="/dashboard/resumes">
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View all <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {resumesLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : resumes.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No resumes yet. Upload your first one!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          File
                        </th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          ATS
                        </th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Date
                        </th>
                        <th className="py-2 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {resumes.map((resume) => (
                        <ResumeRow key={resume.id} resume={resume} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Quick Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <DropZone compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
