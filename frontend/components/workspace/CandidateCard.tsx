'use client'

import { useState } from 'react'
import type { KanbanCandidate } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, getScoreBgColor } from '@/lib/utils'
import { GripVertical, Trash2, StickyNote, X, Check } from 'lucide-react'
import Link from 'next/link'

interface CandidateCardProps {
  candidate: KanbanCandidate
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onUpdateNotes: (notes: string) => void
  onRemove: () => void
}

export function CandidateCard({
  candidate,
  isDragging,
  onDragStart,
  onDragEnd,
  onUpdateNotes,
  onRemove,
}: CandidateCardProps) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(candidate.notes)

  function saveNotes() {
    onUpdateNotes(notesDraft)
    setEditingNotes(false)
  }

  function cancelNotes() {
    setNotesDraft(candidate.notes)
    setEditingNotes(false)
  }

  const atsBadgeClass =
    candidate.atsScore >= 75
      ? 'badge badge-emerald'
      : candidate.atsScore >= 50
      ? 'badge badge-amber'
      : 'badge badge-rose'

  const matchBadgeClass =
    candidate.matchScore >= 75
      ? 'badge badge-emerald'
      : candidate.matchScore >= 50
      ? 'badge badge-amber'
      : 'badge badge-rose'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'glass-card p-3 space-y-2.5 cursor-grab active:cursor-grabbing transition-all select-none',
        isDragging && 'opacity-40 scale-95 shadow-lg'
      )}
      style={{ background: 'rgba(17,24,39,0.5)' }}
      role="article"
      aria-label={`Candidate: ${candidate.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-white truncate">{candidate.name}</p>
        </div>
        <button
          onClick={onRemove}
          className="text-slate-500 hover:text-rose-400 transition-colors flex-shrink-0 bg-transparent border-0 cursor-pointer"
          aria-label="Remove candidate"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scores */}
      <div className="flex items-center gap-2">
        <span className={atsBadgeClass}>
          ATS {candidate.atsScore}
        </span>
        {candidate.matchScore > 0 && (
          <span className={matchBadgeClass}>
            Match {Math.round(candidate.matchScore)}%
          </span>
        )}
      </div>

      {/* Top skills */}
      {candidate.topSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {candidate.topSkills.map((skill, i) => (
            <span
              key={i}
              className="badge badge-gray text-[10px]"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Notes */}
      {editingNotes ? (
        <div className="space-y-1">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            className="w-full text-xs glass-input p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 text-white"
            rows={3}
            placeholder="Add notes..."
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={saveNotes}
              className="text-green-400 hover:text-green-300 bg-transparent border-0 cursor-pointer"
              aria-label="Save notes"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelNotes}
              className="text-slate-400 hover:text-slate-300 bg-transparent border-0 cursor-pointer"
              aria-label="Cancel notes"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          {candidate.notes ? (
            <p
              className="text-xs text-slate-400 flex-1 cursor-pointer hover:text-slate-200 line-clamp-2 leading-relaxed"
              onClick={() => setEditingNotes(true)}
            >
              {candidate.notes}
            </p>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-0 cursor-pointer"
            >
              <StickyNote className="w-3 h-3" />
              Add note
            </button>
          )}
        </div>
      )}

      {/* View link */}
      <Link
        href={`/dashboard/resumes/${candidate.resumeId}`}
        className="block text-xs text-blue-400 hover:text-blue-300 transition-colors mt-2 font-medium"
        onClick={(e) => e.stopPropagation()}
      >
        View analysis →
      </Link>
    </div>
  )
}
