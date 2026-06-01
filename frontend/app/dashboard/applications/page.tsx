'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Application } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUIStore } from '@/stores/ui'
import { Plus, Trash2, Calendar, Briefcase, ChevronRight } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

const STAGES = ['SAVED', 'APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED'] as const
const STAGE_LABELS: Record<string, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  PHONE_SCREEN: 'Phone Screen',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
}
const STAGE_COLORS: Record<string, string> = {
  SAVED: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200/40 dark:border-slate-700/30 rounded-full px-2 py-0.5 shadow-none',
  APPLIED: 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100/40 dark:border-blue-900/30 rounded-full px-2 py-0.5 shadow-none',
  PHONE_SCREEN: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100/40 dark:border-amber-900/30 rounded-full px-2 py-0.5 shadow-none',
  INTERVIEW: 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100/40 dark:border-purple-900/30 rounded-full px-2 py-0.5 shadow-none',
  OFFER: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100/40 dark:border-green-900/30 rounded-full px-2 py-0.5 shadow-none',
  REJECTED: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100/40 dark:border-red-900/30 rounded-full px-2 py-0.5 shadow-none',
}

function isDeadlineSoon(deadline: string | null): boolean {
  if (!deadline) return false
  const diff = new Date(deadline).getTime() - Date.now()
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000
}

function isDeadlinePast(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline).getTime() < Date.now()
}

export default function ApplicationsPage() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'kanban' | 'calendar'>('kanban')
  const [addOpen, setAddOpen] = useState(false)
  const [editApp, setEditApp] = useState<Application | null>(null)
  const [form, setForm] = useState({ company: '', jobTitle: '', stage: 'SAVED', notes: '', deadline: '' })

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.applications.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.applications.create({
        company: data.company,
        jobTitle: data.jobTitle,
        stage: data.stage,
        notes: data.notes,
        deadline: data.deadline || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setAddOpen(false)
      setForm({ company: '', jobTitle: '', stage: 'SAVED', notes: '', deadline: '' })
      addToast({ title: 'Application added', variant: 'default' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Application> }) =>
      api.applications.update(id, {
        company: data.company,
        jobTitle: data.jobTitle,
        stage: data.stage,
        notes: data.notes,
        deadline: data.deadline || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setEditApp(null)
      addToast({ title: 'Application updated', variant: 'default' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.applications.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      addToast({ title: 'Application deleted', variant: 'default' })
    },
  })

  function handleStageChange(id: string, stage: string) {
    updateMutation.mutate({ id, data: { stage } })
  }

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.stage === s)
    return acc
  }, {} as Record<string, Application[]>)

  // Calendar view: apps with deadlines
  const withDeadlines = applications.filter((a) => a.deadline).sort((a, b) =>
    new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Tracker"
        description="Track your job applications through every stage"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setView(view === 'kanban' ? 'calendar' : 'kanban')} className="rounded-full bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold px-4 h-10 text-xs">
              {view === 'kanban' ? 'Calendar View' : 'Kanban View'}
            </Button>
            <Button onClick={() => setAddOpen(true)} className="rounded-full shadow-sm hover:shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10">
              <Plus className="w-4 h-4 mr-2" />
              Add Application
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100/50 dark:bg-slate-800/40 rounded-2xl border border-gray-100/50 dark:border-slate-800/30 animate-pulse" />
          ))}
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {STAGES.map((stage) => (
            <div key={stage} className="min-w-[160px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{STAGE_LABELS[stage]}</span>
                <Badge className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-semibold rounded-full border border-gray-200/50 dark:border-white/5 shadow-none px-2">{byStage[stage].length}</Badge>
              </div>
              <div className="space-y-2">
                {byStage[stage].map((app) => (
                  <Card
                    key={app.id}
                    className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                    onClick={() => setEditApp(app)}
                  >
                    <CardContent className="p-3.5 space-y-1">
                      <p className="text-sm font-semibold text-gray-950 dark:text-white truncate">{app.company}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{app.jobTitle}</p>
                      {app.deadline && (
                        <div className={cn(
                          'flex items-center gap-1 text-[10px] font-sans font-semibold mt-1.5',
                          isDeadlinePast(app.deadline) ? 'text-red-600 dark:text-red-400' :
                          isDeadlineSoon(app.deadline) ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'
                        )}>
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(app.deadline)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-base font-semibold text-gray-950 dark:text-white">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {withDeadlines.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 font-sans py-4">No applications with deadlines.</p>
            ) : (
              <div className="space-y-3">
                {withDeadlines.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800/60 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <div>
                        <p className="text-sm font-semibold text-gray-950 dark:text-white">{app.jobTitle} at {app.company}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-sans mt-0.5">Deadline: {formatDate(app.deadline!)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDeadlineSoon(app.deadline) && (
                        <Badge className="bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border border-orange-100/40 dark:border-orange-900/20 text-[10px] rounded-full shadow-none">Soon</Badge>
                      )}
                      {isDeadlinePast(app.deadline) && (
                        <Badge className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100/40 dark:border-red-900/20 text-[10px] rounded-full shadow-none">Past</Badge>
                      )}
                      <Badge className={cn('text-[10px]', STAGE_COLORS[app.stage])}>{STAGE_LABELS[app.stage]}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-gray-950 dark:text-white">Add Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Job Title</Label>
              <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Software Engineer" className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  {STAGES.map((s) => <SelectItem key={s} value={s} className="text-xs dark:text-gray-200">{STAGE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Deadline (optional)</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent font-semibold px-4 h-10">Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.company || !form.jobTitle || createMutation.isPending}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10 shadow-sm"
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editApp && (
        <Dialog open={!!editApp} onOpenChange={() => setEditApp(null)}>
          <DialogContent className="max-w-md rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-semibold text-gray-950 dark:text-white">{editApp.company} — {editApp.jobTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Stage</Label>
                <Select
                  value={editApp.stage}
                  onValueChange={(v) => setEditApp({ ...editApp, stage: v })}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                    {STAGES.map((s) => <SelectItem key={s} value={s} className="text-xs dark:text-gray-200">{STAGE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Deadline</Label>
                <Input
                  type="date"
                  value={editApp.deadline ? editApp.deadline.split('T')[0] : ''}
                  onChange={(e) => setEditApp({ ...editApp, deadline: e.target.value })}
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Notes</Label>
                <Textarea
                  value={editApp.notes}
                  onChange={(e) => setEditApp({ ...editApp, notes: e.target.value })}
                  rows={3}
                  className="text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  className="rounded-xl text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 px-4 h-10"
                  onClick={() => deleteMutation.mutate(editApp.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditApp(null)} className="rounded-xl border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800 bg-transparent font-semibold px-4 h-10">Cancel</Button>
                  <Button
                    onClick={() => updateMutation.mutate({ id: editApp.id, data: editApp })}
                    disabled={updateMutation.isPending}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10 shadow-sm"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
