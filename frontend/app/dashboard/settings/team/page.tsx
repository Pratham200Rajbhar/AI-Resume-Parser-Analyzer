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
import { Users, Plus, Trash2, Shield } from 'lucide-react'

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
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState('VIEWER')

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

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) =>
      api.teams.addMember(teamId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', selectedTeam?.id] })
      setInviteUserId('')
      addToast({ title: 'Member added', variant: 'default' })
    },
    onError: () => addToast({ title: 'Failed to add member', variant: 'destructive' }),
  })

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
                  <Label className="text-xs">Invite Member (by User ID)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="User ID"
                      value={inviteUserId}
                      onChange={(e) => setInviteUserId(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['VIEWER', 'REVIEWER', 'ADMIN'].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => addMemberMutation.mutate({ teamId: selectedTeam.id, userId: inviteUserId, role: inviteRole })}
                      disabled={!inviteUserId || addMemberMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Members */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Members ({members.length})</p>
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-mono text-gray-600">{m.userId.slice(0, 12)}...</span>
                        <Badge className={`text-xs ${ROLE_COLORS[m.role] ?? 'bg-gray-100 text-gray-700'}`}>
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
