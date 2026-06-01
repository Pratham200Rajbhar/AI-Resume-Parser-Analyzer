'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, type SearchResult, type SearchResults } from '@/lib/api'
import { Search, FileText, Briefcase, MessageSquare, LayoutList, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, React.ElementType> = {
  resume: FileText,
  jd: Briefcase,
  coaching: MessageSquare,
  application: LayoutList,
}

const TYPE_LABELS: Record<string, string> = {
  resumes: 'Resumes',
  jds: 'Job Descriptions',
  coaching: 'Coaching',
  applications: 'Applications',
}

const RECENT_KEY = 'search_recent'

function getRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function addRecent(q: string) {
  if (typeof window === 'undefined') return
  const prev = getRecent().filter((r) => r !== q)
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, 5)))
}

export function GlobalSearch({
  isOpen,
  onClose,
  onOpen,
}: {
  isOpen: boolean
  onClose: () => void
  onOpen: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({})
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allResults = Object.values(results).flat() as SearchResult[]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpen()
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      setRecent(getRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults({})
      setActiveIndex(0)
    }
  }, [isOpen])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({}); return }
    setLoading(true)
    try {
      const data = await api.search.query(q)
      setResults(data)
      setActiveIndex(0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  function navigate(href: string, q?: string) {
    if (q) addRecent(q)
    onClose()
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && allResults[activeIndex]) {
      navigate(allResults[activeIndex].href, query)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl glass-card overflow-hidden" style={{ background: 'rgba(13,18,32,0.85)' }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search resumes, jobs, sessions..."
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-500 text-white"
          />
          {loading && <div className="spinner spinner-sm" />}
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!query && recent.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-2">Recent</p>
              {recent.map((r) => (
                <button
                  key={r}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
                  onClick={() => setQuery(r)}
                >
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  {r}
                </button>
              ))}
            </div>
          )}

          {query && Object.keys(results).length === 0 && !loading && (
            <div className="p-8 text-center text-sm text-slate-400">No results for &quot;{query}&quot;</div>
          )}

          {Object.entries(results).map(([type, items]) => {
            if (!items || items.length === 0) return null
            return (
              <div key={type} className="p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 mb-1">
                  {TYPE_LABELS[type] ?? type}
                </p>
                {(items as SearchResult[]).map((item, i) => {
                  const Icon = TYPE_ICONS[item.type] ?? FileText
                  const globalIdx = allResults.findIndex((r) => r.id === item.id && r.type === item.type)
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors',
                        globalIdx === activeIndex ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-slate-300'
                      )}
                      onClick={() => navigate(item.href, query)}
                    >
                      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-xs text-slate-500 bg-white/2">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
