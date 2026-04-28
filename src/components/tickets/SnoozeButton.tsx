'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { TicketStatus } from '@/lib/database.types'

interface Props {
  ticketId:      string
  currentStatus: TicketStatus
}

export function SnoozeButton({ ticketId, currentStatus }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [date,    setDate]    = useState('')
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  if (currentStatus === 'closed' || currentStatus === 'resolved') return null

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 10)

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 20)
  const maxDateStr = maxDate.toISOString().slice(0, 10)

  const handleConfirm = async () => {
    if (!date) { toast.error('Selecciona una fecha'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/snooze`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ snooze_until: date }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al posponer')
        return
      }
      toast.success('Ticket pospuesto.')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Posponer
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56">
          <p className="text-xs font-medium text-gray-700 mb-2">Posponer hasta…</p>
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDateStr}
            onChange={e => setDate(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#083D20] mb-2"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !date}
              className="flex-1 text-xs bg-[#083D20] text-white rounded px-2 py-1.5 hover:bg-[#0a4d28] disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
