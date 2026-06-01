'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUIStore } from '@/stores/ui'
import { formatDate, cn } from '@/lib/utils'
import { Share2, Copy, Trash2, Plus, Eye, EyeOff, Lock } from 'lucide-react'

interface ShareLink {
  id: string
  token: string
  visibleSections: string[]
  expiresAt: string | null
  viewCount: number
  createdAt: string
}

const SECTIONS = [
  { key: 'ats_score', label: 'ATS Score' },
  { key: 'ats_breakdown', label: 'Score Breakdown' },
  { key: 'entities', label: 'Extracted Info' },
  { key: 'bias_flags', label: 'Bias Flags' },
  { key: 'fraud_flags', label: 'Fraud Flags' },
]

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function SharePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { addToast } = useUIStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: links = [], isLoading, refetch } = useQuery<ShareLink[]>({
    queryKey: ['share-links', id],
    queryFn: () => api.share.list(id),
  })

  function toggleSection(key: string) {
    setSelectedSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    )
  }

  async function handleCreate() {
    setCreating(true)
    try {
      await api.share.create(id, {
        visibleSections: selectedSections,
        password: password || undefined,
        expiresAt: expiresAt || undefined,
      })
      await refetch()
      setCreateOpen(false)
      setSelectedSections([])
      setPassword('')
      setExpiresAt('')
      addToast({ title: 'Share link created', variant: 'default' })
    } catch {
      addToast({ title: 'Failed to create link', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(token: string) {
    try {
      await api.share.remove(id, token)
      await refetch()
      addToast({ title: 'Link deleted', variant: 'default' })
    } catch {
      addToast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${BASE_URL}/share/${token}`)
    addToast({ title: 'Link copied', variant: 'default' })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Share Analysis"
        description="Create read-only share links for this resume analysis"
        action={
          <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> New Link
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No share links yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[200px]">
                        {BASE_URL}/share/{link.token}
                      </code>
                      {link.expiresAt && (
                        <Badge className="text-xs bg-orange-100 text-orange-700">
                          Expires {formatDate(link.expiresAt)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{link.viewCount} views</span>
                      <span>Created {formatDate(link.createdAt)}</span>
                      {link.visibleSections.length > 0 && (
                        <span>{link.visibleSections.length} sections visible</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => copyLink(link.token)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(link.token)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Share Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Visible Sections (leave empty for all)</Label>
              <div className="space-y-2">
                {SECTIONS.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(s.key)}
                      onChange={() => toggleSection(s.key)}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Password (optional)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for no password"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Expires At (optional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {creating ? 'Creating...' : 'Create Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
