'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { KanbanBoard } from '@/components/workspace/KanbanBoard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useUIStore } from '@/stores/ui'
import { Plus } from 'lucide-react'
import type { KanbanCandidate, KanbanColumn } from '@/types'

export default function WorkspacePage() {
  const { addToast } = useUIStore()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [candidates, setCandidates] = useState<KanbanCandidate[]>([])

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  function handleAddCandidate() {
    const resume = analyzedResumes.find((r) => r.id === selectedResumeId)
    if (!resume || !resume.analysis) return

    const alreadyAdded = candidates.some((c) => c.resumeId === selectedResumeId)
    if (alreadyAdded) {
      addToast({ title: 'Candidate already in workspace', variant: 'destructive' })
      return
    }

    const entities = resume.analysis.entitiesJson
    const topSkills = entities.skills
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((s) => s.normalized)

    const newCandidate: KanbanCandidate = {
      id: Math.random().toString(36).slice(2),
      resumeId: resume.id,
      name: entities.name ?? resume.fileName,
      atsScore: resume.analysis.atsScore,
      matchScore: 0,
      topSkills,
      notes: '',
      column: 'shortlisted',
    }

    setCandidates((prev) => [...prev, newCandidate])
    setAddOpen(false)
    setSelectedResumeId('')
    addToast({ title: 'Candidate added to workspace', variant: 'success' })
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
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        }
      />

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
              <Button onClick={handleAddCandidate} disabled={!selectedResumeId}>
                Add to Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
