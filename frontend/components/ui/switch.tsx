'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      onCheckedChange?.(e.target.checked)
      onChange?.(e)
    }

    return (
      <label className={cn('relative inline-flex items-center cursor-pointer', className)}>
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div className="w-9 h-5 bg-muted dark:bg-slate-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 peer-focus:ring-offset-background rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
      </label>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
