import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
  colorClass: string
  iconColor: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  colorClass,
}: StatCardProps) {
  // Map Tailwind color classes to custom design tokens from globals.css
  let glassColor = 'blue'
  if (colorClass.includes('green') || colorClass.includes('emerald')) {
    glassColor = 'emerald'
  } else if (colorClass.includes('amber')) {
    glassColor = 'amber'
  } else if (colorClass.includes('purple')) {
    glassColor = 'purple'
  } else if (colorClass.includes('indigo')) {
    glassColor = 'indigo'
  } else if (colorClass.includes('cyan')) {
    glassColor = 'cyan'
  }

  return (
    <div className="stat-card">
      <div className="flex-grow space-y-1">
        <p className="stat-label">{title}</p>
        <p className="stat-value">{value}</p>
        {description && (
          <p className="text-caption mt-1.5 font-normal">{description}</p>
        )}
      </div>
      <div className={cn('stat-card-icon', glassColor)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  )
}
