'use client'

import type { BiasFlag } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BiasFlagsProps {
  flags: BiasFlag[]
}

const TYPE_COLORS: Record<BiasFlag['type'], string> = {
  gender: 'bg-purple-100 text-purple-800',
  age: 'bg-blue-100 text-blue-800',
  personal: 'bg-orange-100 text-orange-800',
}

const TYPE_LABELS: Record<BiasFlag['type'], string> = {
  gender: 'Gender',
  age: 'Age',
  personal: 'Personal',
}

export function BiasFlags({ flags }: BiasFlagsProps) {
  if (flags.length === 0) return null

  return (
    <div className="space-y-3">
      {flags.map((flag, i) => (
        <div
          key={i}
          className="p-3 rounded-lg border border-amber-100 bg-amber-50 space-y-2"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-xs', TYPE_COLORS[flag.type])}>
              {TYPE_LABELS[flag.type]}
            </Badge>
            <span className="text-xs font-semibold text-gray-700">
              Flagged term:{' '}
              <span className="bg-amber-200 text-amber-900 px-1 rounded">
                &ldquo;{flag.term}&rdquo;
              </span>
            </span>
          </div>

          <div className="text-xs text-gray-600 leading-relaxed">
            <span className="font-medium text-gray-500">Context: </span>
            {highlightTerm(flag.sentence, flag.term)}
          </div>

          <div className="flex items-start gap-1.5">
            <span className="text-xs font-medium text-green-700 flex-shrink-0">Suggestion:</span>
            <span className="text-xs text-green-700">{flag.suggestion}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function highlightTerm(sentence: string, term: string) {
  const idx = sentence.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return <span>{sentence}</span>

  return (
    <>
      {sentence.slice(0, idx)}
      <mark className="bg-amber-200 text-amber-900 rounded px-0.5">
        {sentence.slice(idx, idx + term.length)}
      </mark>
      {sentence.slice(idx + term.length)}
    </>
  )
}
