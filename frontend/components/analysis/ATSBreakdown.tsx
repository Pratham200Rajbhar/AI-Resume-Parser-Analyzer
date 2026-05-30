'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ATSBreakdown as ATSBreakdownType } from '@/types'

interface ATSBreakdownProps {
  breakdown: ATSBreakdownType
}

function getBarColor(value: number): string {
  if (value >= 75) return '#16a34a'
  if (value >= 50) return '#d97706'
  return '#dc2626'
}

export function ATSBreakdown({ breakdown }: ATSBreakdownProps) {
  const data = [
    { name: 'Keywords', value: breakdown.keywords },
    { name: 'Format', value: breakdown.format },
    { name: 'Sections', value: breakdown.sections },
    { name: 'Contact', value: breakdown.contact },
    { name: 'Length', value: breakdown.length },
  ]

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#374151' }}
          tickLine={false}
          axisLine={false}
          width={65}
        />
        <Tooltip
          formatter={(value: number) => [`${value}/100`, 'Score']}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
