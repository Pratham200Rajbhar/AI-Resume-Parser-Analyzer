'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUIStore } from '@/stores/ui'
import { api } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { Edit2, Save, X, ArrowLeft, RefreshCw } from 'lucide-react'

interface JDDetail {
  id: string
  title: string
  company: string | null
  rawText: string
  createdAt: string
}

interface MatchResult {
  id: string
  resumeId: string
  matchScore: number
  matchedSkills: string[]
  gapSkills: string[]
  createdAt: string
  resumeFileName: string | null
}

export default function JDDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', company: '', rawText: '' })

  const { data: jd, isLoading } = useQuery<JDDetail>({
    queryKey: ['jd', id],
    queryFn: () => api.jds.get(id) as unknown as Promise<JDDetail>,
  })

  const { data: matches = [], isLoading: matchesLoading } = useQuery<MatchResult[]>({
    queryKey: ['jd-matches', id],
    queryFn: () => api.jds.getMatches(id) as unknown as Promise<MatchResult[]>,
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof editForm) =>
      api.jds.update(id, { title: data.title, company: data.company, rawText: data.rawText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jd', id] })
      queryClient.invalidateQueries({ queryKey: ['jd-matches', id] })
      setEditing(false)
      addToast({ title: 'Job description updated', variant: 'default' })
    },
    onError: () => addToast({ title: 'Update failed', variant: 'destructive' }),
  })

  function startEdit() {
    if (!jd) return
    setEditForm({ title: jd.title, company: jd.company ?? '', rawText: jd.rawText })
    setEditing(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!jd) return <div className="text-sm text-gray-500">Job description not found.</div>

  const sortedMatches = [...matches].sort((a, b) => b.matchScore - a.matchScore)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/jds">
          <button className="btn btn-sm btn-ghost">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </button>
        </Link>
        <PageHeader
          title={editing ? 'Edit Job Description' : jd.title}
          description={jd.company ?? undefined}
        />
        {!editing && (
          <button className="btn btn-sm btn-secondary" onClick={startEdit}>
            <Edit2 className="w-4 h-4 mr-1" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="card">
          <div className="card-body space-y-4">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="input" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Job Description Text</label>
              <textarea
                className="textarea font-mono text-xs"
                value={editForm.rawText}
                onChange={(e) => setEditForm({ ...editForm, rawText: e.target.value })}
                rows={12}
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => updateMutation.mutate(editForm)}
                disabled={updateMutation.isPending}
                className="btn btn-primary"
              >
                <Save className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? 'Saving...' : 'Save & Re-run Matches'}
              </button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Job Description</h2>
              </div>
              <div className="card-body">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
                  {jd.rawText}
                </pre>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Details</h2>
              </div>
              <div className="card-body space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Created</span>
                  <span className="text-slate-200">{formatDate(jd.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Matches</span>
                  <span className="text-slate-200">{matches.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matched Resumes */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Matched Resumes ({matches.length})</h2>
        </div>
        <div className="card-body p-0">
          {matchesLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10" />)}
            </div>
          ) : sortedMatches.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No matches yet. Match resumes against this JD from the Resumes page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Resume</th>
                    <th>Match Score</th>
                    <th>Matched Skills</th>
                    <th>Date</th>
                    <th className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium text-white truncate max-w-[200px]">
                        {m.resumeFileName ?? m.resumeId.slice(0, 8)}
                      </td>
                      <td>
                        <span className={cn(
                          'font-bold text-sm',
                          m.matchScore >= 0.7 ? 'text-emerald-400' :
                          m.matchScore >= 0.4 ? 'text-amber-400' : 'text-rose-400'
                        )}>
                          {Math.round(m.matchScore * 100)}%
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(m.matchedSkills as string[]).slice(0, 3).map((s) => (
                            <span key={s} className="badge badge-emerald">{s}</span>
                          ))}
                          {m.matchedSkills.length > 3 && (
                            <span className="text-xs text-slate-500">+{m.matchedSkills.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-slate-400 font-sans">{formatDate(m.createdAt)}</td>
                      <td className="text-right">
                        <Link href={`/dashboard/resumes/${m.resumeId}`}>
                          <button className="btn btn-sm btn-secondary">View</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
