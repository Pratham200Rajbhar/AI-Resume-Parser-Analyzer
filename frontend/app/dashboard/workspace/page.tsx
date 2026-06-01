'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { KanbanBoard } from '@/components/workspace/KanbanBoard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useUIStore } from '@/stores/ui'
import { Plus, Sparkles } from 'lucide-react'
import type { KanbanCandidate, KanbanColumn } from '@/types'

interface WorkspaceCandidate {
  id: string
  resumeId: string
  name: string
  atsScore: number
  matchScore: number
  topSkills: string[]
  notes: string
  column: string
  position: number
  jobDescriptionId: string | null
  createdAt: string
  updatedAt: string
}

export default function WorkspacePage() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [activeJdId, setActiveJdId] = useState<string>('')
  const [isMatchingAll, setIsMatchingAll] = useState(false)

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  const { data: rawCandidates = [], isLoading } = useQuery<WorkspaceCandidate[]>({
    queryKey: ['workspace-candidates'],
    queryFn: () => api.workspace.listCandidates(),
  })

  // Map API candidates to KanbanCandidate shape
  const candidates: KanbanCandidate[] = rawCandidates.map((c) => ({
    id: c.id,
    resumeId: c.resumeId,
    name: c.name,
    atsScore: c.atsScore,
    matchScore: c.matchScore,
    topSkills: c.topSkills,
    notes: c.notes,
    column: c.column as KanbanColumn,
  }))

  const createMutation = useMutation({
    mutationFn: (data: {
      resumeId: string; name: string; atsScore: number; matchScore: number;
      topSkills: string[]; column: string; jobDescriptionId?: string
    }) =>
      api.workspace.addCandidate({
        resumeId: data.resumeId,
        name: data.name,
        atsScore: data.atsScore,
        matchScore: data.matchScore,
        topSkills: data.topSkills,
        column: data.column,
        jobDescriptionId: data.jobDescriptionId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-candidates'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { column?: string; notes?: string; position?: number; matchScore?: number } }) =>
      api.workspace.updateCandidate(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-candidates'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.workspace.removeCandidate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-candidates'] }),
  })

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  async function handleJdChange(val: string) {
    const jdId = val === 'none' ? '' : val
    setActiveJdId(jdId)

    if (!jdId || rawCandidates.length === 0) return

    setIsMatchingAll(true)
    try {
      await Promise.all(
        rawCandidates.map(async (c) => {
          try {
            const res = await api.jds.match(jdId, c.resumeId)
            const score = Math.round(res.matchScore * 100)
            await updateMutation.mutateAsync({ id: c.id, data: { matchScore: score } })
          } catch {
            // ignore individual failures
          }
        })
      )
      addToast({ title: 'Workspace updated with job match scores', variant: 'default' })
    } catch {
      addToast({ title: 'Failed to match some candidates', variant: 'destructive' })
    } finally {
      setIsMatchingAll(false)
    }
  }

  async function handleAddCandidate() {
    const resume = analyzedResumes.find((r) => r.id === selectedResumeId)
    if (!resume || !resume.analysis) return

    const alreadyAdded = rawCandidates.some((c) => c.resumeId === selectedResumeId)
    if (alreadyAdded) {
      addToast({ title: 'Candidate already in workspace', variant: 'destructive' })
      return
    }

    const entities = resume.analysis.entitiesJson
    const topSkills = (entities?.skills ?? [])
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 3)
      .map((s) => s.normalized ?? s.raw ?? '')

    let matchScore = 0
    if (activeJdId) {
      setIsMatchingAll(true)
      try {
        const res = await api.jds.match(activeJdId, resume.id)
        matchScore = Math.round(res.matchScore * 100)
      } catch {
        // ignore
      } finally {
        setIsMatchingAll(false)
      }
    }

    await createMutation.mutateAsync({
      resumeId: resume.id,
      name: entities?.name ?? resume.fileName,
      atsScore: resume.analysis.atsScore,
      matchScore,
      topSkills,
      column: 'shortlisted',
      jobDescriptionId: activeJdId || undefined,
    })

    setAddOpen(false)
    setSelectedResumeId('')
    addToast({ title: 'Candidate added to workspace', variant: 'default' })
  }

  function handleMove(candidateId: string, column: KanbanColumn) {
    updateMutation.mutate({ id: candidateId, data: { column } })
  }

  function handleUpdateNotes(candidateId: string, notes: string) {
    updateMutation.mutate({ id: candidateId, data: { notes } })
  }

  function handleRemove(candidateId: string) {
    deleteMutation.mutate(candidateId)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace"
        description="Organize and track candidates through your hiring pipeline"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl shadow-lg border border-white/5">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <Label htmlFor="active-jd-select" className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Target Job:
          </Label>
          <Select value={activeJdId || 'none'} onValueChange={handleJdChange}>
            <SelectTrigger id="active-jd-select" className="glass-input w-full h-10 text-xs text-white">
              <SelectValue placeholder="Select a job description to calculate matches..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
              <SelectItem value="none" className="text-xs dark:text-gray-200">No active job description</SelectItem>
              {(jds ?? []).map((jd) => (
                <SelectItem key={jd.id} value={jd.id} className="text-xs dark:text-gray-200">
                  {jd.title} {jd.company ? `(${jd.company})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          {isMatchingAll && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 animate-pulse font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Calculating matches...
            </div>
          )}
          <Button onClick={() => setAddOpen(true)} className="btn btn-primary rounded-full px-5 h-10">
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>
      </div>

      <KanbanBoard
        candidates={candidates}
        onMove={handleMove}
        onUpdateNotes={handleUpdateNotes}
        onRemove={handleRemove}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-white/5 bg-slate-950/95 backdrop-blur-md p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-white">Add Candidate to Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Select Resume</Label>
              <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                <SelectTrigger className="glass-input h-10 text-xs text-white">
                  <SelectValue placeholder="Choose an analyzed resume..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  {analyzedResumes.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs rounded-lg dark:text-gray-200">
                      {r.analysis?.entitiesJson?.name ?? r.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {analyzedResumes.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 font-sans">No analyzed resumes available.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} className="btn btn-secondary rounded-xl px-4 h-10">Cancel</Button>
              <Button
                onClick={handleAddCandidate}
                disabled={!selectedResumeId || isMatchingAll || createMutation.isPending}
                className="btn btn-primary rounded-xl px-5 h-10"
              >
                Add to Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
