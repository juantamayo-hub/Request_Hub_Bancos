'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/constants'
import { displayName } from '@/lib/utils'
import type { TicketWithRelations, Profile, TicketStatus, TicketPriority } from '@/lib/database.types'

interface Props {
  ticket: TicketWithRelations
  admins: Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>[]
}

export function AdminTicketActions({ ticket, admins }: Props) {
  const router  = useRouter()
  const [loading,        setLoading]        = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason,   setCancelReason]   = useState('')

  const [status,     setStatus]     = useState<TicketStatus>(ticket.status)
  const [priority,   setPriority]   = useState<TicketPriority>(ticket.priority)
  const [assigneeId, setAssigneeId] = useState<string>(ticket.assignee_id ?? '')

  const dirty =
    status     !== ticket.status       ||
    priority   !== ticket.priority     ||
    assigneeId !== (ticket.assignee_id ?? '')

  const handleSave = async () => {
    if (!dirty) return
    // If switching to "Cancelado" (resolved), show the reason modal first
    if (status === 'resolved' && ticket.status !== 'resolved') {
      setShowCancelModal(true)
      return
    }
    await submitUpdate()
  }

  const submitUpdate = async (reason?: string) => {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {}
      if (status   !== ticket.status)                          payload.status     = status
      if (priority !== ticket.priority)                        payload.priority   = priority
      if (assigneeId !== (ticket.assignee_id ?? ''))           payload.assignee_id = assigneeId || null
      if (reason)                                              payload.cancel_reason = reason

      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
        credentials: 'include',
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al actualizar la solicitud.')
        return
      }

      toast.success('Solicitud actualizada.')
      router.refresh()
    } catch {
      toast.error('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Por favor, escribe el motivo de la cancelación.')
      return
    }
    setShowCancelModal(false)
    await submitUpdate(cancelReason.trim())
    setCancelReason('')
  }

  const adminOptions = [
    { value: '', label: 'Sin asignar' },
    ...admins.map(a => ({ value: a.id, label: displayName(a) })),
  ]

  return (
    <>
      {/* ── Cancellation modal ─────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Cancelar solicitud</h3>
              <p className="text-sm text-gray-500 mt-1">
                Por favor, indica el motivo de la cancelación. El solicitante recibirá esta información por Slack.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Motivo de cancelación *
              </label>
              <Textarea
                placeholder="Ej: El banco ya procesó la solicitud directamente, no se requiere gestión adicional."
                rows={4}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleConfirmCancel}
                isLoading={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
              >
                Confirmar cancelación
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCancelModal(false)
                  setStatus(ticket.status) // revert dropdown
                  setCancelReason('')
                }}
                disabled={loading}
                className="flex-1"
              >
                Volver
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions panel ──────────────────────────────── */}
      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Acciones</h3>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Estado</label>
          <Select
            options={TICKET_STATUSES.map(s => ({ value: s.value, label: s.label }))}
            value={status}
            onChange={e => setStatus(e.target.value as TicketStatus)}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Prioridad</label>
          <Select
            options={TICKET_PRIORITIES.map(p => ({ value: p.value, label: p.label }))}
            value={priority}
            onChange={e => setPriority(e.target.value as TicketPriority)}
          />
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Asignado a</label>
          <Select
            options={adminOptions}
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
          />
        </div>

        <Button
          className={`w-full ${status !== ticket.status && status === 'resolved' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#083D20] hover:bg-[#0a4d28]'} text-white`}
          onClick={handleSave}
          isLoading={loading}
          disabled={!dirty}
        >
          {status !== ticket.status && status === 'resolved' ? 'Cancelar solicitud' : 'Guardar cambios'}
        </Button>

        {/* Metadata */}
        <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>ID</span>
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
              <span>Categoría</span>
              <span className="text-right">{ticket.categories.name}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
