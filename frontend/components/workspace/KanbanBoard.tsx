'use client'

import { useState } from 'react'
import type { KanbanCandidate, KanbanColumn } from '@/types'
import { CandidateCard } from './CandidateCard'
import { cn } from '@/lib/utils'

const COLUMNS: { id: KanbanColumn; label: string; color: string; headerColor: string }[] = [
  { id: 'shortlisted', label: 'Shortlisted', color: 'bg-blue-50 border-blue-200', headerColor: 'bg-blue-100 text-blue-800' },
  { id: 'under_review', label: 'Under Review', color: 'bg-amber-50 border-amber-200', headerColor: 'bg-amber-100 text-amber-800' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-50 border-red-200', headerColor: 'bg-red-100 text-red-800' },
  { id: 'hired', label: 'Hired', color: 'bg-green-50 border-green-200', headerColor: 'bg-green-100 text-green-800' },
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
              'flex flex-col rounded-xl border-2 transition-colors min-h-[400px]',
              col.color,
              isOver && 'ring-2 ring-indigo-400 ring-offset-1'
            )}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className={cn('px-3 py-2 rounded-t-xl flex items-center justify-between', col.headerColor)}>
              <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
              <span className="text-xs font-bold bg-white bg-opacity-60 rounded-full px-2 py-0.5">
                {colCandidates.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {colCandidates.length === 0 ? (
                <div
                  className={cn(
                    'h-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors',
                    isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
                  )}
                >
                  <p className="text-xs text-gray-400">Drop here</p>
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
