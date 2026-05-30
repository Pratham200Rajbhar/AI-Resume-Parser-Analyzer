'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/stores/ui'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Layers,
  MessageSquare,
  KanbanSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/resumes', label: 'Resumes', icon: FileText },
  { href: '/dashboard/jds', label: 'Job Descriptions', icon: Briefcase },
  { href: '/dashboard/batch', label: 'Batch Ranking', icon: Layers },
  { href: '/dashboard/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/dashboard/workspace', label: 'Workspace', icon: KanbanSquare },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar, activeJobIds } = useUIStore()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16',
          // On mobile, hide when closed
          !sidebarOpen && 'max-md:hidden'
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-gray-900 truncate">ResumeAI</span>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" role="navigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
                aria-current={active ? 'page' : undefined}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0',
                    active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
                  )}
                />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Active jobs indicator */}
        {activeJobIds.length > 0 && sidebarOpen && (
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{activeJobIds.length} job{activeJobIds.length > 1 ? 's' : ''} processing</span>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="p-2 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
