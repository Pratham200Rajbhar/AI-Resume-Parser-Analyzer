'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { Eye, EyeOff, Trash2, Plus, Copy } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Preferences {
  defaultLlmProvider: string
  defaultExportFormat: string
  emailAnalysisComplete: boolean
  emailBatchDone: boolean
  emailDeadlineReminder: boolean
}

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

export default function SettingsPage() {
  const { addToast } = useUIStore()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [profileForm, setProfileForm] = useState({ fullName: user?.fullName ?? '', avatarUrl: '' })
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)

  // Sync form when user data loads asynchronously from the auth store
  useEffect(() => {
    if (user?.fullName) {
      setProfileForm((f) => ({ ...f, fullName: user.fullName ?? '' }))
    }
  }, [user?.fullName])

  const { data: prefs, isLoading: prefsLoading } = useQuery<Preferences>({
    queryKey: ['preferences'],
    queryFn: () => api.settings.getPreferences(),
  })

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.settings.listApiKeys(),
  })

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      api.settings.updateProfile({
        fullName: profileForm.fullName,
        avatarUrl: profileForm.avatarUrl || undefined,
      }),
    onSuccess: () => addToast({ title: 'Profile updated', variant: 'default' }),
    onError: () => addToast({ title: 'Update failed', variant: 'destructive' }),
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => api.settings.changePassword(passwordForm.current, passwordForm.next),
    onSuccess: () => {
      setPasswordForm({ current: '', next: '' })
      addToast({ title: 'Password changed', variant: 'default' })
    },
    onError: () => addToast({ title: 'Password change failed', variant: 'destructive' }),
  })

  const updatePrefsMutation = useMutation({
    mutationFn: (data: Partial<Preferences>) => api.settings.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      addToast({ title: 'Preferences saved', variant: 'default' })
    },
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.settings.createApiKey(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKeyValue(data.key)
      setNewKeyName('')
      addToast({ title: 'API key created — copy it now, it won\'t be shown again', variant: 'default' })
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => api.settings.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      addToast({ title: 'API key revoked', variant: 'default' })
    },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2"><CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Profile Information</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-4 font-sans">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Email</Label>
                <Input value={user?.email ?? ''} disabled className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Full Name</Label>
                <Input
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  placeholder="Your name"
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                />
              </div>
              <Button
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
                className="rounded-full shadow-sm hover:shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10"
              >
                Save Profile
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2"><CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Change Password</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-4 font-sans">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                />
              </div>
              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={!passwordForm.current || !passwordForm.next || changePasswordMutation.isPending}
                variant="outline"
                className="rounded-full bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-semibold px-5 h-9 text-xs"
              >
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4">
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2"><CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Email Notifications</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-5 font-sans">
              {prefsLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100/50 dark:bg-slate-800/40 rounded-xl animate-pulse" />)}</div>
              ) : (
                <>
                  {[
                    { key: 'emailAnalysisComplete' as const, label: 'Analysis complete', desc: 'When a resume finishes analyzing' },
                    { key: 'emailBatchDone' as const, label: 'Batch complete', desc: 'When a batch ranking job finishes' },
                    { key: 'emailDeadlineReminder' as const, label: 'Deadline reminder', desc: '24h before application deadlines' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-sm font-semibold text-gray-950 dark:text-white">{label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <Switch
                        checked={prefs?.[key] ?? false}
                        onCheckedChange={(checked) => updatePrefsMutation.mutate({ ...prefs, [key]: checked })}
                      />
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4 mt-4">
          {newKeyValue && (
            <Card className="border-green-200/50 dark:border-green-900/30 bg-green-50/70 dark:bg-green-950/20 rounded-2xl overflow-hidden shadow-sm">
              <CardContent className="p-5 font-sans">
                <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">Your new API key (copy it now):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white dark:bg-slate-900 border border-green-200 dark:border-green-900/40 rounded-xl px-3.5 py-2 font-mono break-all dark:text-gray-200">
                    {newKeyValue}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-9 px-3 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300"
                    onClick={() => { navigator.clipboard.writeText(newKeyValue); addToast({ title: 'Copied', variant: 'default' }) }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="mt-2.5 text-xs text-green-700 dark:text-green-400 hover:bg-green-100/50 dark:hover:bg-green-950/20 rounded-lg px-2.5 h-8 font-semibold" onClick={() => setNewKeyValue(null)}>
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2"><CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Create API Key</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 font-sans">
              <div className="flex gap-2">
                <Input
                  placeholder="Key name (e.g. My App)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white"
                />
                <Button
                  onClick={() => createKeyMutation.mutate(newKeyName)}
                  disabled={!newKeyName || createKeyMutation.isPending}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 h-10 shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-1" /> Create
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2"><CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">Active Keys</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 font-sans">
              {keysLoading ? (
                <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-100/50 dark:bg-slate-800/40 rounded-xl animate-pulse" />)}</div>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No API keys yet.</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800/60 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-950 dark:text-white">{k.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{k.keyPrefix}••••••••</p>
                        {k.lastUsedAt && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last used: {formatDate(k.lastUsedAt)}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 px-3 h-9"
                        onClick={() => deleteKeyMutation.mutate(k.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="mt-4">
          <Card className="glass-card border border-[#e0e0e0]/40 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="px-5 pt-5 pb-2"><CardTitle className="text-sm font-semibold text-gray-950 dark:text-white">App Preferences</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-4 font-sans">
              {prefsLoading ? (
                <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-10 bg-gray-100/50 dark:bg-slate-800/40 rounded-xl animate-pulse" />)}</div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Default LLM Provider</Label>
                    <Select
                      value={prefs?.defaultLlmProvider ?? 'openai'}
                      onValueChange={(v) => updatePrefsMutation.mutate({ ...prefs, defaultLlmProvider: v })}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                        <SelectItem value="openai" className="text-xs dark:text-gray-200">OpenAI</SelectItem>
                        <SelectItem value="anthropic" className="text-xs dark:text-gray-200">Anthropic</SelectItem>
                        <SelectItem value="ollama" className="text-xs dark:text-gray-200">Ollama (local)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Default Export Format</Label>
                    <Select
                      value={prefs?.defaultExportFormat ?? 'pdf'}
                      onValueChange={(v) => updatePrefsMutation.mutate({ ...prefs, defaultExportFormat: v })}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl border-gray-200 dark:border-slate-800 bg-transparent dark:text-white focus:ring-blue-500"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 dark:bg-slate-900">
                        <SelectItem value="pdf" className="text-xs dark:text-gray-200">PDF</SelectItem>
                        <SelectItem value="docx" className="text-xs dark:text-gray-200">DOCX</SelectItem>
                        <SelectItem value="json" className="text-xs dark:text-gray-200">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
