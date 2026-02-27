'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  ticketId: string
  isAdmin?: boolean
}

export function AddCommentForm({ ticketId, isAdmin = false }: Props) {
  const router   = useRouter()
  const [body,       setBody]       = useState('')
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public')
  const [loading,    setLoading]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) { toast.error('Comment cannot be empty.'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body: body.trim(), visibility }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to post comment.')
        return
      }

      toast.success('Comment posted.')
      setBody('')
      router.refresh()
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder={
          isAdmin
            ? 'Add a comment… Use "Internal" for notes only visible to the team.'
            : 'Add a reply…'
        }
        rows={3}
        value={body}
        onChange={e => setBody(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" isLoading={loading}>
          Post comment
        </Button>

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500 font-medium">Visibility</label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as 'public' | 'internal')}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="public">Public (visible to requester)</option>
              <option value="internal">Internal (team only)</option>
            </select>
          </div>
        )}
      </div>
    </form>
  )
}
