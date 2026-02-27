'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/constants'
import { displayName } from '@/lib/utils'
import type { TicketWithRelations, Profile, TicketStatus, TicketPriority } from '@/lib/database.types'

interface Props {
  ticket: TicketWithRelations
  admins: Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>[]
}

export function AdminTicketActions({ ticket, admins }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  const [status,     setStatus]     = useState<TicketStatus>(ticket.status)
  const [priority,   setPriority]   = useState<TicketPriority>(ticket.priority)
  const [assigneeId, setAssigneeId] = useState<string>(ticket.assignee_id ?? '')

  const dirty =
    status     !== ticket.status       ||
    priority   !== ticket.priority     ||
    assigneeId !== (ticket.assignee_id ?? '')

  const handleSave = async () => {
    if (!dirty) return
    setLoading(true)

    try {
      const payload: Record<string, unknown> = {}
      if (status   !== ticket.status)          payload.status     = status
      if (priority !== ticket.priority)         payload.priority   = priority
      if (assigneeId !== (ticket.assignee_id ?? ''))
        payload.assignee_id = assigneeId || null

      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
        credentials: 'include',
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update ticket.')
        return
      }

      toast.success('Ticket updated.')
      router.refresh()
    } catch {
      toast.error('Connection error. Check your network and try again.')
    } finally {
      setLoading(false)
    }
  }

  const adminOptions = [
    { value: '', label: 'Unassigned' },
    ...admins.map(a => ({ value: a.id, label: displayName(a) })),
  ]

  return (
    <div className="card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Actions</h3>

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
        <Select
          options={TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))}
          value={status}
          onChange={e => setStatus(e.target.value as TicketStatus)}
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Priority</label>
        <Select
          options={TICKET_PRIORITIES.map(p => ({ value: p.value, label: p.label }))}
          value={priority}
          onChange={e => setPriority(e.target.value as TicketPriority)}
        />
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Assignee</label>
        <Select
          options={adminOptions}
          value={assigneeId}
          onChange={e => setAssigneeId(e.target.value)}
        />
      </div>

      <Button
        className="w-full"
        onClick={handleSave}
        isLoading={loading}
        disabled={!dirty}
      >
        Save changes
      </Button>

      {/* Metadata */}
      <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Ticket ID</span>
          <span className="font-mono text-gray-700">{ticket.display_id}</span>
        </div>
        {ticket.sla_hours && (
          <div className="flex justify-between">
            <span>SLA</span>
            <span>{ticket.sla_hours}h</span>
          </div>
        )}
        {ticket.categories && (
          <div className="flex justify-between">
            <span>Category</span>
            <span>{ticket.categories.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}
