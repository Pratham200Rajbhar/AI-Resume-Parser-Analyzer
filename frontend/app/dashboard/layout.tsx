'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useUIStore } from '@/stores/ui'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useUIStore()

  return (
    <div className="app-shell">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-background focus:text-foreground focus:top-0 focus:left-0">Skip to content</a>
      
      {/* Premium Glassmorphic Deep Space Ambient Glows */}
      <div className="bg-orbs">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <Sidebar />
      
      <div
        className={cn(
          'main-content',
          sidebarOpen ? 'sidebar-open' : 'sidebar-closed'
        )}
      >
        <Header />
        <main id="main" className="page-body">{children}</main>
      </div>
    </div>
  )
}
