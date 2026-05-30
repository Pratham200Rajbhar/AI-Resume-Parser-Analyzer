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
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react'
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

  const { data: sessions, isLoading } = useQuery({
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
      addToast({ title: 'Session deleted' })
    },
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
    } catch {
      addToast({ title: 'Failed to create session', variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  function startEditTitle() {
    setTitleDraft(selectedSession?.title ?? '')
    setEditingTitle(true)
  }

  async function confirmEditTitle() {
    if (!selectedSessionId || !titleDraft.trim()) {
      setEditingTitle(false)
      return
    }
    try {
      await api.coaching.updateSession(selectedSessionId, titleDraft.trim())
      queryClient.invalidateQueries({ queryKey: ['coaching-sessions'] })
    } catch {
      addToast({ title: 'Failed to update title', variant: 'destructive' })
    }
    setEditingTitle(false)
    setTitleDraft('')
  }

  function cancelEditTitle() {
    setEditingTitle(false)
    setTitleDraft('')
  }

  const analyzedResumes = resumes?.items.filter((r) => r.status === 'ANALYZED') ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Coach"
        description="Get personalized career coaching powered by AI"
        action={
          <Button onClick={() => setNewSessionOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        }
      />

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Session list */}
        <div className="w-64 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sessions</p>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : !sessions || sessions.length === 0 ? (
                <div className="p-4 text-center">
                  <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No sessions yet</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === selectedSessionId}
                      onSelect={() => setSelectedSessionId(session.id)}
                      onDelete={() => deleteMutation.mutate(session.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0">
          {!selectedSessionId ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">No session selected</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Select a session or create a new one to start coaching
                </p>
                <Button onClick={() => setNewSessionOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex flex-col">
              {/* Session header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
                {editingTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEditTitle()
                        if (e.key === 'Escape') cancelEditTitle()
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={confirmEditTitle}>
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditTitle}>
                      <X className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 truncate">
                      {selectedSession?.title}
                    </h2>
                    <button
                      onClick={startEditTitle}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                      aria-label="Edit session title"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {selectedSession && selectedSession.resumeAnalysisId && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const linked = analyzedResumes.find(
                        (r) => r.analysis?.id === selectedSession.resumeAnalysisId
                      )
                      return linked ? (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md truncate max-w-[160px]" title={linked.fileName}>
                          {linked.fileName}
                        </span>
                      ) : null
                    })()}
                  </div>
                )}
              </div>

              {/* Chat */}
              <div className="flex-1 min-h-0 flex flex-col">
                <ActiveSession
                  sessionId={selectedSessionId}
                  quickActionInput={quickActionInput}
                  onQuickActionConsumed={() => setQuickActionInput('')}
                />
              </div>

              {/* Quick actions */}
              <div className="px-4 pb-2 border-t border-gray-100 pt-2">
                <QuickActions onAction={(text) => setQuickActionInput(text)} />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Coaching Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="session-title">Session Title *</Label>
              <Input
                id="session-title"
                placeholder="e.g. Resume review for SWE role"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              />
            </div>
            <div className="space-y-2">
              <Label>Link Resume (optional)</Label>
              <Select value={newResumeId} onValueChange={setNewResumeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a resume..." />
                </SelectTrigger>
                <SelectContent>
                  {analyzedResumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link Job Description (optional)</Label>
              <Select value={newJdId} onValueChange={setNewJdId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a JD..." />
                </SelectTrigger>
                <SelectContent>
                  {(jds ?? []).map((jd) => (
                    <SelectItem key={jd.id} value={jd.id}>
                      {jd.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setNewSessionOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSession} disabled={!newTitle.trim() || isCreating}>
                {isCreating ? 'Creating...' : 'Create Session'}
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
}: {
  session: CoachingSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
        isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100 text-gray-700'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <MessageSquare className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-indigo-500' : 'text-gray-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{session.title}</p>
        <p className="text-xs text-gray-400">{formatDate(session.updatedAt)}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
        aria-label="Delete session"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
