'use client'

import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { FileText, TrendingUp, Award, MessageSquare } from 'lucide-react'

interface AnalyticsSummary {
  totalResumes: number
  avgAtsScore: number
  highestScoreThisMonth: number
  activeCoachingSessions: number
  statusCounts: Record<string, number>
  scoreDistribution: { range: string; count: number }[]
  weeklyTrend: { week: string; avgScore: number | null; count: number }[]
  topSkills: { skill: string; count: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  ANALYZED: '#6366f1',
  PENDING: '#f59e0b',
  PARSING: '#3b82f6',
  ANALYZING: '#8b5cf6',
  FAILED: '#ef4444',
}

const DIST_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#6366f1']

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: () => api.analytics.summary(),
  })

  if (isLoading) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader title="Analytics" description="Resume performance insights" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100/50 dark:bg-slate-800/40 border border-gray-100/50 dark:border-slate-800/30 rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-100/50 dark:bg-slate-800/40 border border-gray-100/50 dark:border-slate-800/30 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const stats = [
    { title: 'Total Resumes', value: data?.totalResumes ?? 0, icon: FileText, color: 'bg-blue-600 dark:bg-blue-500' },
    { title: 'Avg ATS Score', value: data?.avgAtsScore ? `${data.avgAtsScore}%` : '—', icon: TrendingUp, color: 'bg-green-600 dark:bg-green-500' },
    { title: 'Best This Month', value: data?.highestScoreThisMonth ? `${data.highestScoreThisMonth}%` : '—', icon: Award, color: 'bg-amber-600 dark:bg-amber-500' },
    { title: 'Coach Sessions', value: data?.activeCoachingSessions ?? 0, icon: MessageSquare, color: 'bg-purple-600 dark:bg-purple-500' },
  ]

  const statusData = Object.entries(data?.statusCounts ?? {}).map(([status, count]) => ({ status, count }))
  const trendData = (data?.weeklyTrend ?? []).filter((w) => w.avgScore !== null)
  const topSkills = (data?.topSkills ?? []).slice(0, 15)

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Resume performance insights across your portfolio" />

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.title} className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{s.title}</p>
                  <p className="text-2xl font-bold text-gray-950 dark:text-white mt-1.5">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ATS Score Trend */}
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">ATS Score Trend (12 weeks)</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {trendData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Not enough data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }} formatter={(v) => [`${v}`, 'Avg Score']} />
                  <Line type="monotone" dataKey="avgScore" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Resumes by Status</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {statusData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {(data?.scoreDistribution ?? []).every((d) => d.count === 0) ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No analyzed resumes yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.scoreDistribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data?.scoreDistribution ?? []).map((entry, i) => (
                      <Cell key={entry.range} fill={DIST_COLORS[i] ?? '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Skills */}
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Top 15 Skills</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {topSkills.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No skills data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topSkills} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.15)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis dataKey="skill" type="category" tick={{ fontSize: 9, fill: '#6b7280' }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
