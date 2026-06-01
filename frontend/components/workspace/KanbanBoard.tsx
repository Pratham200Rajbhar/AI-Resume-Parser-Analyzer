'use client'

import { useState } from 'react'
import type { KanbanCandidate, KanbanColumn } from '@/types'
import { CandidateCard } from './CandidateCard'
import { cn } from '@/lib/utils'

const COLUMNS: { id: KanbanColumn; label: string; color: string; headerColor: string }[] = [
  { id: 'shortlisted', label: 'Shortlisted', color: 'glass border-blue-500/20', headerColor: 'border-b border-white/5 bg-blue-500/10 text-blue-400' },
  { id: 'under_review', label: 'Under Review', color: 'glass border-amber-500/20', headerColor: 'border-b border-white/5 bg-amber-500/10 text-amber-400' },
  { id: 'rejected', label: 'Rejected', color: 'glass border-rose-500/20', headerColor: 'border-b border-white/5 bg-rose-500/10 text-rose-400' },
  { id: 'hired', label: 'Hired', color: 'glass border-emerald-500/20', headerColor: 'border-b border-white/5 bg-emerald-500/10 text-emerald-400' },
]

interface KanbanBoardProps {
  candidates: KanbanCandidate[]
  onMove: (candidateId: string, column: KanbanColumn) => void
  onUpdateNotes: (candidateId: string, notes: string) => void
  onRemove: (candidateId: string) => void
}

export function KanbanBoard({ candidates, onMove, onUpdateNotes, onRemove }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumn | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  function handleDragStart(e: React.DragEvent, candidateId: string) {
    e.dataTransfer.setData('candidateId', candidateId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(candidateId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragOver(e: React.DragEvent, column: KanbanColumn) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(column)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  function handleDrop(e: React.DragEvent, column: KanbanColumn) {
    e.preventDefault()
    const candidateId = e.dataTransfer.getData('candidateId')
    if (candidateId) {
      onMove(candidateId, column)
    }
    setDragOverColumn(null)
    setDraggingId(null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      {COLUMNS.map((col) => {
        const colCandidates = candidates.filter((c) => c.column === col.id)
        const isOver = dragOverColumn === col.id

        return (
          <div
            key={col.id}
            className={cn(
              'flex flex-col rounded-xl border transition-all min-h-[400px]',
              col.color,
              isOver && 'ring-2 ring-blue-500/40 ring-offset-0 bg-white/2'
            )}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className={cn('px-3.5 py-2.5 rounded-t-xl flex items-center justify-between', col.headerColor)}>
              <span className="text-xs font-semibold uppercase tracking-wider">{col.label}</span>
              <span className="text-[10px] font-bold bg-white/10 text-white rounded-full px-2 py-0.5">
                {colCandidates.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 max-h-[600px]">
              {colCandidates.length === 0 ? (
                <div
                  className={cn(
                    'h-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors',
                    isOver ? 'border-blue-400 bg-blue-500/5' : 'border-white/5'
                  )}
                >
                  <p className="text-xs text-slate-500">Drop here</p>
                </div>
              ) : (
                colCandidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    isDragging={draggingId === candidate.id}
                    onDragStart={(e) => handleDragStart(e, candidate.id)}
                    onDragEnd={handleDragEnd}
                    onUpdateNotes={(notes) => onUpdateNotes(candidate.id, notes)}
                    onRemove={() => onRemove(candidate.id)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
