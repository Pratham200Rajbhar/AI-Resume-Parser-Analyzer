'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type AppNotification } from '@/lib/api'
import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import Link from 'next/link'

const TYPE_COLORS: Record<string, string> = {
  ANALYSIS_COMPLETE: 'badge badge-emerald',
  BATCH_COMPLETE: 'badge badge-blue',
  DEADLINE_REMINDER: 'badge badge-amber',
  COACH_INACTIVE: 'badge badge-purple',
  WEEKLY_DIGEST: 'badge badge-gray',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(),
    refetchInterval: 30000,
  })

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications-unread'],
    queryFn: () => api.notifications.unreadCount(),
    refetchInterval: 30000,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 dropdown-content border-white/5 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold bg-transparent border-0 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn('px-4 py-3 hover:bg-white/5 transition-colors', !n.read && 'bg-blue-500/5')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={TYPE_COLORS[n.type] ?? 'badge badge-gray'}>
                          {n.type.replace(/_/g, ' ')}
                        </span>
                        {!n.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-sm font-medium text-white truncate">{n.title}</p>
                      <p className="text-xs text-slate-400 truncate">{n.body}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(n.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {n.link && (
                        <Link href={n.link} onClick={() => setOpen(false)}>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-blue-400" />
                        </Link>
                      )}
                      {!n.read && (
                        <button onClick={() => markReadMutation.mutate(n.id)} className="bg-transparent border-0 cursor-pointer">
                          <Check className="w-3.5 h-3.5 text-slate-400 hover:text-green-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
