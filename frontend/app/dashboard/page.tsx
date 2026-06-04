'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/upload/DropZone'
import { StatCard } from '@/components/layout/StatCard'
import { formatDate, getStatusColor, getStatusLabel, formatScore, cn } from '@/lib/utils'
import {
  FileText,
  TrendingUp,
  Layers,
  MessageSquare,
  ArrowRight,
  Upload,
  Sparkles,
  AlertCircle,
  RefreshCw,
  FolderOpen
} from 'lucide-react'
import type { Resume, BatchJob } from '@/types'

const STATUS_BADGE_MAP: Record<string, string> = {
  ANALYZED: 'badge badge-emerald',
  PARSED: 'badge badge-indigo',
  PROCESSING: 'badge badge-amber',
  FAILED: 'badge badge-rose',
}

function ResumeRow({ resume }: { resume: Resume }) {
  const badgeClass = STATUS_BADGE_MAP[resume.status] ?? 'badge badge-gray'
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-white truncate max-w-[220px]" title={resume.fileName}>
            {resume.fileName}
          </span>
        </div>
      </td>
      <td>
        <span className={badgeClass}>
          {getStatusLabel(resume.status)}
        </span>
      </td>
      <td>
        {resume.analysis ? (
          <span className={cn('text-sm font-bold', formatScore(resume.analysis.atsScore))}>
            {resume.analysis.atsScore}%
          </span>
        ) : (
          <span className="text-sm text-slate-500 font-medium">—</span>
        )}
      </td>
      <td className="text-sm text-slate-400 font-sans">
        {formatDate(resume.createdAt)}
      </td>
      <td className="text-right">
        <Link href={`/dashboard/resumes/${resume.id}`}>
          <button className="btn btn-sm btn-secondary">
            View
          </button>
        </Link>
      </td>
    </tr>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  const {
    data: resumesData,
    isLoading: resumesLoading,
    isError: resumesError,
    refetch: refetchResumes
  } = useQuery({
    queryKey: ['resumes', 1, 5],
    queryFn: () => api.resumes.list(1, 5),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      const hasProcessing = items.some((r) => r.status === 'PARSING' || r.status === 'ANALYZING' || r.status === 'PENDING')
      return hasProcessing ? 3000 : false
    }
  })

  const {
    data: batches,
    isLoading: batchesLoading,
    isError: batchesError,
    refetch: refetchBatches
  } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.batches.list(),
    refetchInterval: (query) => {
      const list = query.state.data ?? []
      const hasInProgress = list.some((b) => b.status === 'IN_PROGRESS')
      return hasInProgress ? 3000 : false
    }
  })

  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions
  } = useQuery({
    queryKey: ['coaching-sessions'],
    queryFn: () => api.coaching.listSessions(),
  })

  const hasErrors = resumesError || batchesError || sessionsError

  function handleRetryAll() {
    refetchResumes()
    refetchBatches()
    refetchSessions()
  }

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

  const greetingName = user?.fullName?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6 pb-12">
      {/* Premium Glassmorphic Welcome Card */}
      <div className="glass-card-glow p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-bold text-cyan-400 tracking-wider uppercase">Command Center</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-white">
            Welcome back, {greetingName}!
          </h1>
          <p className="text-sm text-slate-400 max-w-xl font-normal">
            Your resume parsing AI model has stabilized, and ATS matching engines are operational. Upload files below to start real-time scoring.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/resumes">
            <button className="btn btn-primary btn-lg">
              <Upload className="w-4 h-4 mr-2" />
              Upload Resume
            </button>
          </Link>
          <Link href="/dashboard/coach">
            <button className="btn btn-secondary btn-lg">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-400" />
              AI Coach
            </button>
          </Link>
        </div>
      </div>

      {/* Global Error Banner */}
      {hasErrors && (
        <div className="p-4 glass border-rose-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <p className="text-sm text-slate-300 font-medium">
              We encountered an issue fetching some workspace data. Please check your network and try again.
            </p>
          </div>
          <button
            onClick={handleRetryAll}
            className="btn btn-sm btn-danger self-start sm:self-center"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            Retry Connection
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid-4">
        {resumesLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Resumes"
              value={totalResumes}
              icon={FileText}
              colorClass="bg-blue-50"
              iconColor="text-blue-400"
            />
            <StatCard
              title="Avg ATS Score"
              value={avgAts > 0 ? `${avgAts}%` : '—'}
              icon={TrendingUp}
              description="Score of analyzed resumes"
              colorClass="bg-green-50"
              iconColor="text-emerald-400"
            />
            <StatCard
              title="Active Batches"
              value={activeBatches}
              icon={Layers}
              description={`${(batches ?? []).length} total runs`}
              colorClass="bg-amber-50"
              iconColor="text-amber-400"
            />
            <StatCard
              title="Coach Sessions"
              value={(sessions ?? []).length}
              icon={MessageSquare}
              colorClass="bg-purple-50"
              iconColor="text-purple-400"
            />
          </>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Resumes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header flex flex-row items-center justify-between">
              <div>
                <h2 className="card-title">Recent Resumes</h2>
                <p className="card-description">Your recently analyzed and matched resumes</p>
              </div>
              <Link href="/dashboard/resumes">
                <button className="btn btn-sm btn-ghost">
                  View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </Link>
            </div>
            <div className="card-body p-0">
              {resumesLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton h-10" />
                  ))}
                </div>
              ) : resumes.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-white/2 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <FolderOpen className="w-7 h-7 text-slate-500" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-white">No resumes processed</h3>
                  <p className="text-xs text-slate-400 max-w-[280px] mt-1 font-sans">
                    Drop a resume in the quick upload panel to start the AI analysis pipeline.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Pipeline Status</th>
                        <th>ATS Score</th>
                        <th>Uploaded At</th>
                        <th className="text-right" />
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
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Dropzone */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quick Upload</h2>
              <p className="card-description">Drag-and-drop a file to start ATS scoring</p>
            </div>
            <div className="card-body">
              <DropZone compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
