'use client'

import type { Experience } from '@/types'

interface CareerTimelineProps {
  experience: Experience[]
}

function parseYear(dateStr?: string): number | null {
  if (!dateStr) return null
  const match = dateStr.match(/\d{4}/)
  return match ? parseInt(match[0], 10) : null
}

export function CareerTimeline({ experience }: CareerTimelineProps) {
  if (experience.length === 0) return null

  // Sort by start date descending (most recent first)
  const sorted = [...experience].sort((a, b) => {
    const aYear = parseYear(a.startDate) ?? 0
    const bYear = parseYear(b.startDate) ?? 0
    return bYear - aYear
  })

  const allYears = sorted.flatMap((e) => [
    parseYear(e.startDate),
    parseYear(e.endDate),
  ]).filter((y): y is number => y !== null)

  const minYear = allYears.length > 0 ? Math.min(...allYears) : new Date().getFullYear() - 10
  const maxYear = allYears.length > 0 ? Math.max(...allYears) : new Date().getFullYear()
  const range = Math.max(maxYear - minYear, 1)

  const SVG_WIDTH = 600
  const SVG_HEIGHT = sorted.length * 72 + 20
  const TRACK_X = 24
  const CONTENT_X = 48
  const ROW_H = 72

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        style={{ minWidth: 320 }}
        aria-label="Career timeline"
        role="img"
      >
        {/* Vertical track line */}
        <line
          x1={TRACK_X}
          y1={10}
          x2={TRACK_X}
          y2={SVG_HEIGHT - 10}
          stroke="#e5e7eb"
          strokeWidth={2}
        />

        {sorted.map((exp, i) => {
          const y = i * ROW_H + 20
          const startYear = parseYear(exp.startDate) ?? minYear
          const endYear = parseYear(exp.endDate) ?? maxYear
          const barStart = ((startYear - minYear) / range) * (SVG_WIDTH - CONTENT_X - 20) + CONTENT_X
          const barEnd = ((endYear - minYear) / range) * (SVG_WIDTH - CONTENT_X - 20) + CONTENT_X
          const barWidth = Math.max(barEnd - barStart, 8)

          const colors = [
            '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
            '#ef4444', '#ec4899', '#14b8a6',
          ]
          const color = colors[i % colors.length]

          return (
            <g key={i}>
              {/* Circle on track */}
              <circle cx={TRACK_X} cy={y + 8} r={6} fill={color} />

              {/* Role */}
              <text
                x={CONTENT_X}
                y={y + 4}
                fontSize={12}
                fontWeight="600"
                fill="#111827"
              >
                {exp.role.length > 40 ? exp.role.slice(0, 40) + '…' : exp.role}
              </text>

              {/* Company */}
              <text x={CONTENT_X} y={y + 18} fontSize={11} fill="#6b7280">
                {exp.company.length > 40 ? exp.company.slice(0, 40) + '…' : exp.company}
              </text>

              {/* Date range bar */}
              <rect
                x={CONTENT_X}
                y={y + 26}
                width={barWidth}
                height={8}
                rx={4}
                fill={color}
                opacity={0.25}
              />
              <rect
                x={CONTENT_X}
                y={y + 26}
                width={Math.min(barWidth, 40)}
                height={8}
                rx={4}
                fill={color}
                opacity={0.7}
              />

              {/* Date label */}
              <text x={CONTENT_X} y={y + 50} fontSize={10} fill="#9ca3af">
                {exp.startDate ?? '?'} — {exp.endDate ?? 'Present'}
                {exp.durationMonths
                  ? `  (${Math.floor(exp.durationMonths / 12)}y ${exp.durationMonths % 12}m)`
                  : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
