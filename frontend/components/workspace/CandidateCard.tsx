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

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm p-3 space-y-2 cursor-grab active:cursor-grabbing transition-all select-none',
        isDragging && 'opacity-40 scale-95 shadow-lg'
      )}
      role="article"
      aria-label={`Candidate: ${candidate.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          <p className="text-sm font-semibold text-gray-900 truncate">{candidate.name}</p>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
          aria-label="Remove candidate"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scores */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
            getScoreBgColor(candidate.atsScore)
          )}
        >
          ATS {candidate.atsScore}
        </span>
        {candidate.matchScore > 0 && (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
              getScoreBgColor(candidate.matchScore)
            )}
          >
            Match {Math.round(candidate.matchScore)}
          </span>
        )}
      </div>

      {/* Top skills */}
      {candidate.topSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {candidate.topSkills.map((skill, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
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
            className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            rows={3}
            placeholder="Add notes..."
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={saveNotes}
              className="text-green-600 hover:text-green-700"
              aria-label="Save notes"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelNotes}
              className="text-gray-400 hover:text-gray-600"
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
              className="text-xs text-gray-500 flex-1 cursor-pointer hover:text-gray-700 line-clamp-2"
              onClick={() => setEditingNotes(true)}
            >
              {candidate.notes}
            </p>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
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
        className="block text-xs text-indigo-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        View analysis →
      </Link>
    </div>
  )
}
