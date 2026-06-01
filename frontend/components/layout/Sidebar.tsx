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
  BarChart2,
  ClipboardList,
  Mail,
  HelpCircle,
  Settings,
  Wand2,
  GraduationCap,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/dashboard/resumes', label: 'Resumes', icon: FileText },
  { href: '/dashboard/jds', label: 'Job Descriptions', icon: Briefcase },
  { href: '/dashboard/tailoring', label: 'Tailoring Studio', icon: Wand2 },
  { href: '/dashboard/batch', label: 'Batch Ranking', icon: Layers },
  { href: '/dashboard/workspace', label: 'Workspace', icon: KanbanSquare },
  { href: '/dashboard/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/dashboard/learning-plan', label: 'Learning Plan', icon: GraduationCap },
  { href: '/dashboard/applications', label: 'Applications', icon: ClipboardList },
  { href: '/dashboard/cover-letters', label: 'Cover Letters', icon: Mail },
  { href: '/dashboard/interview-prep', label: 'Interview Prep', icon: HelpCircle },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
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
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/10 backdrop-blur-sm md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'sidebar glass-sidebar',
          sidebarOpen ? 'open' : 'closed',
          !sidebarOpen && 'max-md:hidden'
        )}
        aria-label="Main navigation"
      >
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <FileText className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="sidebar-logo-text">
              Resume<span className="gradient-text font-bold">AI</span>
            </span>
          )}
        </div>

        <nav className="sidebar-nav" role="navigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('nav-item', active && 'active')}
                aria-current={active ? 'page' : undefined}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="nav-item-icon" />
                {sidebarOpen && <span className="nav-item-label">{item.label}</span>}
                {!sidebarOpen && (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {activeJobIds.length > 0 && sidebarOpen && (
          <div className="sidebar-badge">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>{activeJobIds.length} job{activeJobIds.length > 1 ? 's' : ''} processing</span>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="sidebar-toggle-btn"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </aside>
    </>
  )
}
