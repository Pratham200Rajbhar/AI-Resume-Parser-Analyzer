import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 font-normal font-sans">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  )
}
