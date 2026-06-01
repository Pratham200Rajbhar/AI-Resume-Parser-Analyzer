'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ChatInterface } from '@/components/coach/ChatInterface'
import { QuickActions } from '@/components/coach/QuickActions'
import { useCoachSession } from '@/hooks/useCoachSession'
import { useUIStore } from '@/stores/ui'
import { formatDate, cn } from '@/lib/utils'
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Sparkles, Link, AlertCircle, Loader2 } from 'lucide-react'
import type { CoachingSession } from '@/types'

export default function CoachPage() {
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [newSessionOpen, setNewSessionOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newResumeId, setNewResumeId] = useState('')
  const [newJdId, setNewJdId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [quickActionInput, setQuickActionInput] = useState('')

  const { data: sessions, isLoading, isError, refetch } = useQuery({
    queryKey: ['coaching-sessions'],
    queryFn: () => api.coaching.listSessions(),
  })

  const { data: jds } = useQuery({
    queryKey: ['jds'],
    queryFn: () => api.jds.list(),
  })

  const { data: resumes } = useQuery({
    queryKey: ['resumes', 1, 100],
    queryFn: () => api.resumes.list(1, 100),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.coaching.deleteSession(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] })
      if (selectedSessionId === id) setSelectedSessionId('')
      addToast({ title: 'Session deleted successfully' })
    },
    onError: () => addToast({ title: 'Failed to delete session', variant: 'destructive' }),
  })

  const selectedSession = sessions?.find((s) => s.id === selectedSessionId)

  async function handleCreateSession() {
    if (!newTitle.trim()) return
    setIsCreating(true)
    try {
      const session = await api.coaching.createSession(
        newTitle,
        newResumeId || undefined,
        newJdId || undefined
      )
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] })
      setSelectedSessionId(session.id)
      setNewSessionOpen(false)
      setNewTitle('')
      setNewResumeId('')
      setNewJdId('')
      addToast({ title: 'Coaching session created' })
    } catch {
      addToast({ title: 'Failed to create session', variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  async function confirmEditTitle() {
    if (!selectedSessionId || !titleDraft.trim()) {
      setEditingTitle(false)
      return
    }
    try {
      await api.coaching.updateSession(selectedSessionId, titleDraft.trim())
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] })
      addToast({ title: 'Title updated' })
    } catch {
      addToast({ title: 'Failed to update title', variant: 'destructive' })
    }
    setEditingTitle(false)
    setTitleDraft('')
  }

  function startEditTitle() {
    setTitleDraft(selectedSession?.title ?? '')
    setEditingTitle(true)
  }

  function cancelEditTitle() {
    setEditingTitle(false)
    setTitleDraft('')
  }

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title="AI Career Coach"
        description="Engage in customized interactive reviews, behavioral prep sessions, and skill gaps analysis"
        action={
          <Button onClick={() => setNewSessionOpen(true)} className="btn btn-primary rounded-full px-5">
            <Plus className="w-4 h-4 mr-2" />
            New Coach Session
          </Button>
        }
      />

      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800 font-medium">Failed to retrieve career coach history.</p>
          </div>
          <Button onClick={() => refetch()} variant="ghost" size="sm" className="text-red-700 hover:bg-red-100 rounded-full font-bold">
            Retry
          </Button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-210px)] min-h-[500px] items-stretch">
        {/* Session history left sidebar drawer */}
        <div className="w-full lg:w-72 flex-shrink-0 flex flex-col">
          <div className="glass-card h-full flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 bg-white/2 flex-shrink-0">
              <p className="font-display text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Conversations</p>
            </div>
            <ScrollArea className="flex-1 p-2">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-50/50 dark:bg-slate-800/40 rounded-xl animate-pulse border border-gray-100/50 dark:border-slate-800/30" />
                  ))}
                </div>
              ) : !sessions || sessions.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <MessageSquare className="w-9 h-9 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-sans">No sessions yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5 px-1 py-2 font-sans">
                  {sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === selectedSessionId}
                      onSelect={() => setSelectedSessionId(session.id)}
                      onDelete={() => deleteMutation.mutate(session.id)}
                      isDeleting={deleteMutation.isPending && deleteMutation.variables === session.id}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Chat Area Right panel */}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          {!selectedSessionId ? (
            <div className="glass-card h-full flex flex-col items-center justify-center p-8">
              <div className="text-center max-w-[320px]">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 mx-auto border border-blue-500/20 text-blue-400">
                  <Sparkles className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="font-display text-sm font-semibold text-white">Unlock AI Coaching</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5 font-sans leading-relaxed">
                  Start a structured career counseling session. Our agent reviews your parsed skills to guide your application pitches.
                </p>
                <Button onClick={() => setNewSessionOpen(true)} className="btn btn-primary rounded-full px-5">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Coach Session
                </Button>
              </div>
            </div>
          ) : (
            <div className="glass-card h-full flex flex-col overflow-hidden">
              {/* Session dynamic header */}
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-4 bg-white/2 flex-shrink-0">
                {editingTitle ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="glass-input h-9 text-xs focus-visible:ring-blue-500 font-sans"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEditTitle()
                        if (e.key === 'Escape') cancelEditTitle()
                      }}
                    />
                    <Button size="icon" variant="ghost" onClick={confirmEditTitle} className="h-8 w-8 rounded-full hover:bg-green-500/10 text-green-400 flex-shrink-0">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEditTitle} className="h-8 w-8 rounded-full hover:bg-red-500/10 text-slate-400 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h2 className="font-display text-sm font-semibold text-white truncate">
                      {selectedSession?.title}
                    </h2>
                    <button
                      onClick={startEditTitle}
                      className="text-slate-400 hover:text-blue-400 transition-colors p-1 hover:bg-white/5 rounded-full flex-shrink-0"
                      aria-label="Edit session title"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {selectedSession?.resumeAnalysisId && (
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 text-[10px] bg-blue-500/10 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/20 font-sans font-semibold">
                    <Link className="w-3.5 h-3.5 text-blue-400" />
                    {(() => {
                      const linked = analyzedResumes.find(
                        (r) => r.analysis?.id === selectedSession.resumeAnalysisId
                      )
                      return linked ? (
                        <span className="truncate max-w-[130px]" title={linked.fileName}>
                          {linked.fileName}
                        </span>
                      ) : (
                        <span>Linked Resume</span>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Chat Viewport */}
              <div className="flex-1 min-h-0 flex flex-col bg-transparent">
                <ActiveSession
                  sessionId={selectedSessionId}
                  quickActionInput={quickActionInput}
                  onQuickActionConsumed={() => setQuickActionInput('')}
                />
              </div>

              {/* Prompt Suggestions */}
              <div className="px-5 pb-3 border-t border-white/5 pt-2 flex-shrink-0 bg-transparent">
                <QuickActions onAction={(text) => setQuickActionInput(text)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Session Dialog Box */}
      <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-white/5 bg-slate-950/95 backdrop-blur-md p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base font-semibold text-white">New Coaching Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-title" className="text-xs font-semibold text-slate-400">Session Description Title *</Label>
              <Input
                id="session-title"
                placeholder="e.g. Mock interview for Staff Frontend role"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                className="glass-input h-10 text-xs focus-visible:ring-blue-500 font-sans"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-400">Link Candidate Profile (optional)</Label>
              <Select value={newResumeId} onValueChange={setNewResumeId}>
                <SelectTrigger className="glass-input h-10 text-xs text-white focus:ring-blue-500">
                  <SelectValue placeholder="Link with an analyzed resume..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  {analyzedResumes.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs rounded-lg dark:text-gray-200">
                      {r.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-400">Link Target Job (optional)</Label>
              <Select value={newJdId} onValueChange={setNewJdId}>
                <SelectTrigger className="glass-input h-10 text-xs text-white focus:ring-blue-500">
                  <SelectValue placeholder="Match custom requirements..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                  {(jds ?? []).map((jd) => (
                    <SelectItem key={jd.id} value={jd.id} className="text-xs rounded-lg dark:text-gray-200">
                      {jd.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="ghost" onClick={() => setNewSessionOpen(false)} className="btn btn-secondary rounded-full px-4">
                Cancel
              </Button>
              <Button onClick={handleCreateSession} disabled={!newTitle.trim() || isCreating} className="btn btn-primary rounded-full px-5">
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  'Begin Coaching'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActiveSession({
  sessionId,
  quickActionInput,
  onQuickActionConsumed,
}: {
  sessionId: string
  quickActionInput: string
  onQuickActionConsumed: () => void
}) {
  const { messages, sendMessage, isLoading } = useCoachSession(sessionId)

  return (
    <ChatInterface
      messages={messages}
      onSend={sendMessage}
      isLoading={isLoading}
      quickActionInput={quickActionInput}
      onQuickActionConsumed={onQuickActionConsumed}
    />
  )
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  isDeleting,
}: {
  session: CoachingSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border relative font-sans',
        isActive
          ? 'bg-blue-500/10 border-blue-500/20 text-blue-300 shadow-none'
          : 'hover:bg-white/5 border-transparent text-slate-300'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <MessageSquare className={cn('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate leading-tight">{session.title}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 select-none font-sans">{formatDate(session.updatedAt)}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-50/50 dark:hover:bg-red-950/20 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-all flex-shrink-0"
        aria-label="Delete session"
        disabled={isDeleting}
      >
        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500 dark:text-red-400" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
