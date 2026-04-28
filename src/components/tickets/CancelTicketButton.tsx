'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  ticketId: string
}

export function CancelTicketButton({ ticketId }: Props) {
  const router = useRouter()
  const [open,         setOpen]         = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [loading,      setLoading]      = useState(false)

  const handleConfirm = async () => {
    if (cancelReason.trim().length < 5) {
      toast.error('La razón debe tener al menos 5 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/cancel`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ cancel_reason: cancelReason.trim() }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al cancelar')
        return
      }
      toast.success('Solicitud cancelada.')
      setOpen(false)
      router.push('/tickets')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:text-red-700 transition-colors"
      >
        Cancelar solicitud
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 mb-1">Cancelar solicitud</h3>
            <p className="text-sm text-gray-500 mb-4">
              Explica brevemente por qué deseas cancelar esta solicitud.
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Razón de la cancelación…"
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || cancelReason.trim().length < 5}
                className="flex-1 text-sm bg-red-600 text-white rounded-lg px-3 py-2 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Cancelando…' : 'Confirmar cancelación'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setCancelReason('') }}
                disabled={loading}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
