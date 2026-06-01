'use client'

import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Menu, LogOut, User, Search, Loader2 } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { GlobalSearch } from './GlobalSearch'
import { useState } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/resumes': 'Resumes',
  '/dashboard/jds': 'Job Descriptions',
  '/dashboard/tailoring': 'Tailoring Studio',
  '/dashboard/batch': 'Batch Ranking',
  '/dashboard/coach': 'AI Coach',
  '/dashboard/workspace': 'Workspace',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/applications': 'Applications',
  '/dashboard/cover-letters': 'Cover Letters',
  '/dashboard/interview-prep': 'Interview Prep',
  '/dashboard/learning-plan': 'Learning Plan',
  '/dashboard/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key + '/')) return title
  }
  return 'Dashboard'
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { toggleSidebar, activeJobIds } = useUIStore()
  const [searchOpen, setSearchOpen] = useState(false)

  const title = getPageTitle(pathname)

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} onOpen={() => setSearchOpen(true)} />
      <header className="app-header glass-header">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden rounded-full hover:bg-white/5 hover:text-white"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </Button>

        <h1 className="font-display text-xl font-semibold text-foreground flex-1">{title}</h1>

        {activeJobIds.length > 0 && (
          <div className="header-pill">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>{activeJobIds.length} processing</span>
          </div>
        )}

        {/* Search trigger */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="rounded-full hover:bg-white/5 hover:text-white"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="w-5 h-5 text-muted-foreground" />
        </Button>

        <NotificationBell />


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full transition-shadow duration-150"
              aria-label="User menu"
            >
              <Avatar className="w-8.5 h-8.5 cursor-pointer ring-1 ring-border hover:ring-ring transition-all">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 shadow-lg border-border bg-popover text-popover-foreground">
            <DropdownMenuLabel className="px-3 py-2.5">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">{user?.fullName ?? 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground font-normal mt-0.5">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuItem className="cursor-pointer rounded-lg px-3 py-2 hover:bg-accent hover:text-accent-foreground font-sans" onClick={() => router.push('/dashboard/settings')}>
              <User className="mr-2.5 h-4.5 w-4.5 text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuItem
              className="cursor-pointer rounded-lg px-3 py-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-sans focus:text-destructive focus:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2.5 h-4.5 w-4.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </>
  )
}
