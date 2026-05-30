'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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

export default function WorkspacePage() {
  const { addToast } = useUIStore()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [candidates, setCandidates] = useState<KanbanCandidate[]>([])
  const [activeJdId, setActiveJdId] = useState<string>('')
  const [isMatchingAll, setIsMatchingAll] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCandidates = localStorage.getItem('workspace_candidates')
      if (savedCandidates) {
        try {
          setCandidates(JSON.parse(savedCandidates))
        } catch {
          // ignore malformed
        }
      }
      const savedJdId = localStorage.getItem('workspace_active_jd_id')
      if (savedJdId) {
        setActiveJdId(savedJdId)
      }
    }
    setIsMounted(true)
  }, [])

  // Auto-persist candidates to localStorage
  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('workspace_candidates', JSON.stringify(candidates))
    }
  }, [candidates, isMounted])

  // Auto-persist activeJdId to localStorage
  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('workspace_active_jd_id', activeJdId)
    }
  }, [activeJdId, isMounted])

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  async function handleJdChange(val: string) {
    const jdId = val === 'none' ? '' : val
    setActiveJdId(jdId)

    if (!jdId) {
      setCandidates((prev) => prev.map((c) => ({ ...c, matchScore: 0 })))
      return
    }

    if (candidates.length === 0) return

    setIsMatchingAll(true)
    try {
      const updated = await Promise.all(
        candidates.map(async (c) => {
          try {
            const res = await api.jds.match(jdId, c.resumeId)
            return { ...c, matchScore: Math.round(res.matchScore * 100) }
          } catch (err) {
            console.error('Failed to match candidate:', c.name, err)
            return { ...c, matchScore: 0 }
          }
        })
      )
      setCandidates(updated)
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

    const alreadyAdded = candidates.some((c) => c.resumeId === selectedResumeId)
    if (alreadyAdded) {
      addToast({ title: 'Candidate already in workspace', variant: 'destructive' })
      return
    }

    const entities = resume.analysis.entitiesJson
    const topSkills = (entities.skills ?? [])
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((s) => s.normalized)

    let matchScore = 0
    if (activeJdId) {
      setIsMatchingAll(true)
      try {
        const res = await api.jds.match(activeJdId, resume.id)
        matchScore = Math.round(res.matchScore * 100)
      } catch (err) {
        console.error('Failed to match new candidate:', err)
      } finally {
        setIsMatchingAll(false)
      }
    }

    const newCandidate: KanbanCandidate = {
      id: Math.random().toString(36).slice(2),
      resumeId: resume.id,
      name: entities.name ?? resume.fileName,
      atsScore: resume.analysis.atsScore,
      matchScore,
      topSkills,
      notes: '',
      column: 'shortlisted',
    }

    setCandidates((prev) => [...prev, newCandidate])
    setAddOpen(false)
    setSelectedResumeId('')
    addToast({ title: 'Candidate added to workspace', variant: 'default' })
  }

  function handleMove(candidateId: string, column: KanbanColumn) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, column } : c))
    )
  }

  function handleUpdateNotes(candidateId: string, notes: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, notes } : c))
    )
  }

  function handleRemove(candidateId: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace"
        description="Organize and track candidates through your hiring pipeline"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-150 shadow-sm">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <Label htmlFor="active-jd-select" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            Target Job:
          </Label>
          <Select value={activeJdId || 'none'} onValueChange={handleJdChange}>
            <SelectTrigger id="active-jd-select" className="w-full">
              <SelectValue placeholder="Select a job description to calculate matches..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No active job description (Clear matches)</SelectItem>
              {(jds ?? []).map((jd) => (
                <SelectItem key={jd.id} value={jd.id}>
                  {jd.title} {jd.company ? `(${jd.company})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          {isMatchingAll && (
            <div className="flex items-center gap-1 text-xs text-indigo-600 animate-pulse font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Calculating matches...
            </div>
          )}
          <Button onClick={() => setAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Candidate to Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Select Resume</Label>
              <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an analyzed resume..." />
                </SelectTrigger>
                <SelectContent>
                  {analyzedResumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.analysis?.entitiesJson.name ?? r.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {analyzedResumes.length === 0 && (
                <p className="text-xs text-gray-500">
                  No analyzed resumes available. Upload and analyze resumes first.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCandidate} disabled={!selectedResumeId || isMatchingAll} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Add to Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
