'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { Skill } from '@/types'

interface SkillsRadarProps {
  skills: Skill[]
}

export function SkillsRadar({ skills }: SkillsRadarProps) {
  // Group skills by category
  const categoryMap: Record<string, number> = {}
  for (const skill of skills) {
    const cat = skill.category ?? 'Other'
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
  }

  const data = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }))

  if (data.length < 3) {
    // Not enough categories for a radar — show a simple list
    return (
      <div className="flex flex-wrap gap-2">
        {skills.slice(0, 20).map((skill) => (
          <span
            key={skill.raw}
            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
          >
            {skill.normalized}
          </span>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: '#6b7280' }}
        />
        <Radar
          name="Skills"
          dataKey="count"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number) => [value, 'Skills']}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
