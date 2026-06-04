'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUIStore } from '@/stores/ui'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Users, Plus, Trash2, Shield, Search, UserPlus, Loader2 } from 'lucide-react'

interface Team {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

interface Member {
  id: string
  userId: string
  teamId: string
  role: string
  createdAt: string
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  REVIEWER: 'bg-green-100 text-green-700',
  VIEWER: 'bg-gray-100 text-gray-700',
}

export default function TeamSettingsPage() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('VIEWER')
  const [searchResults, setSearchResults] = useState<{ id: string; email: string; fullName: string | null }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.teams.list(),
  })

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['team-members', selectedTeam?.id],
    queryFn: () => api.teams.listMembers(selectedTeam!.id),
    enabled: !!selectedTeam,
  })

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => api.teams.create(name),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setCreateOpen(false)
      setTeamName('')
      setSelectedTeam(team)
      addToast({ title: 'Team created', variant: 'default' })
    },
  })

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => api.teams.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setSelectedTeam(null)
      addToast({ title: 'Team deleted', variant: 'default' })
    },
  })

  const inviteMutation = useMutation({
    mutationFn: ({ teamId, email, role }: { teamId: string; email: string; role: string }) =>
      api.teams.inviteByEmail(teamId, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] })
      setInviteEmail('')
      setSearchResults([])
      addToast({ title: 'Member invited', variant: 'default' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      addToast({ title: msg ?? 'Failed to invite member', variant: 'destructive' })
    },
  })

  function handleEmailSearch(q: string) {
    setInviteEmail(q)
    if (searchTimeout) clearTimeout(searchTimeout)
    if (q.length < 2) { setSearchResults([]); return }
    setIsSearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await api.users.search(q)
        setSearchResults(results)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    setSearchTimeout(t)
  }

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
      api.teams.removeMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] })
      addToast({ title: 'Member removed', variant: 'default' })
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ teamId, memberId, role }: { teamId: string; memberId: string; role: string }) =>
      api.teams.updateMember(teamId, memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] }),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Team Settings"
        description="Manage your teams and member access"
        action={
          <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> New Team
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Teams</p>
          {isLoading ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No teams yet</p>
              </CardContent>
            </Card>
          ) : (
            teams.map((t) => (
              <button
                key={t.id}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedTeam?.id === t.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedTeam(t)}
              >
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
              </button>
            ))
          )}
        </div>

        {/* Team detail */}
        <div className="md:col-span-2">
          {selectedTeam ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">{selectedTeam.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => deleteTeamMutation.mutate(selectedTeam.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Invite */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Invite Member by Email</Label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <Input
                          placeholder="Search by email address..."
                          value={inviteEmail}
                          onChange={(e) => handleEmailSearch(e.target.value)}
                          className="pl-9 h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
                        )}
                      </div>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="w-28 h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                          {['VIEWER', 'REVIEWER', 'ADMIN'].map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => inviteMutation.mutate({ teamId: selectedTeam.id, email: inviteEmail, role: inviteRole })}
                        disabled={!inviteEmail.includes('@') || inviteMutation.isPending}
                        className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 shadow-sm"
                      >
                        {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      </Button>
                    </div>
                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                        {searchResults.map((u) => (
                          <button
                            key={u.id}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => { setInviteEmail(u.email); setSearchResults([]) }}
                          >
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">{u.email}</p>
                            {u.fullName && <p className="text-[10px] text-gray-400 dark:text-gray-500">{u.fullName}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Members ({members.length})</p>
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-slate-800/60 hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{m.userId.slice(0, 8)}…</span>
                        <Badge className={`text-xs shadow-none ${ROLE_COLORS[m.role] ?? 'bg-gray-100 text-gray-700'}`}>
                          {m.role}
                        </Badge>
                      </div>
                      {m.role !== 'OWNER' && (
                        <div className="flex gap-1">
                          <Select
                            value={m.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ teamId: selectedTeam.id, memberId: m.id, role })}
                          >
                            <SelectTrigger className="h-6 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['VIEWER', 'REVIEWER', 'ADMIN'].map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                            onClick={() => removeMemberMutation.mutate({ teamId: selectedTeam.id, memberId: m.id })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Select a team to manage members</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Team Name</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="My Team" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createTeamMutation.mutate(teamName)}
                disabled={!teamName || createTeamMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
