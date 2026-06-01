'use client'

import { Button } from '@/components/ui/button'
import { FileText, Mail, Mic, TrendingUp } from 'lucide-react'

const QUICK_ACTIONS = [
  {
    label: 'Rewrite bullets',
    icon: FileText,
    text: 'Please rewrite my resume bullet points to be more impactful and quantified.',
  },
  {
    label: 'Cover letter',
    icon: Mail,
    text: 'Help me write a compelling cover letter for this position based on my resume.',
  },
  {
    label: 'Interview prep',
    icon: Mic,
    text: 'What are the most likely interview questions for this role and how should I answer them?',
  },
  {
    label: 'Skill gap advice',
    icon: TrendingUp,
    text: 'Based on my resume and the job description, what skills should I focus on developing?',
  },
]

interface QuickActionsProps {
  onAction: (text: string) => void
}

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => onAction(action.text)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold glass hover:bg-blue-500/10 hover:text-blue-300 border border-white/5 text-slate-300 transition-all cursor-pointer select-none shadow-sm"
          aria-label={`Quick action: ${action.label}`}
        >
          <action.icon className="w-3 h-3 text-blue-400" />
          {action.label}
        </button>
      ))}
    </div>
  )
}
