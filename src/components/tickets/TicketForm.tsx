'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Category } from '@/lib/database.types'

const BANKING_CATEGORIES = [
  'Acelerar aprobación área riesgos',
  'Acelerar emisión de FEIN',
  'Contactar con el cliente (Banco)',
  'Nuevo envío',
  'Solicitar mejoras oferta inicial',
  'Solicitar oferta',
  'Otra',
]

interface Props {
  categories: Pick<Category, 'id' | 'name'>[]
}

interface DealInfo {
  bankName:   string
  bankEmail:  string
  clientName: string | null
}

export function TicketForm({ categories }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  const [categoryId,  setCategoryId]  = useState('')
  const [dealId,      setDealId]      = useState('')
  const [dealInfo,    setDealInfo]    = useState<DealInfo | null>(null)
  const [dealLoading, setDealLoading] = useState(false)
  const [dealError,   setDealError]   = useState<string | null>(null)
  const [bankName,    setBankName]    = useState('')
  const [bankEmail,   setBankEmail]   = useState('')
  const [clientName,  setClientName]  = useState('')
  const [description, setDescription] = useState('')

  const dealDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Deal lookup ─────────────────────────────────────────────

  const lookupDeal = async (rawId: string) => {
    const id = rawId.trim()
    if (!id) {
      setDealInfo(null)
      setDealError(null)
      setBankName('')
      setBankEmail('')
      setClientName('')
      return
    }

    const parsed = parseInt(id, 10)
    if (isNaN(parsed) || parsed <= 0) {
      setDealError('Introduce un número de deal válido.')
      setDealInfo(null)
      setBankName('')
      setBankEmail('')
      setClientName('')
      return
    }

    setDealLoading(true)
    setDealError(null)
    setDealInfo(null)

    try {
      const res  = await fetch(`/api/pipedrive/deal/${parsed}`)
      const data = await res.json()

      if (!res.ok) {
        setDealError(data.error ?? 'Deal no encontrado o no válido.')
        setBankName('')
        setBankEmail('')
        setClientName('')
        return
      }

      const info: DealInfo = {
        bankName:   data.bankName   ?? '',
        bankEmail:  data.bankEmail  ?? '',
        clientName: data.clientName ?? null,
      }
      setDealInfo(info)
      setBankName(info.bankName)
      setBankEmail(info.bankEmail)
      setClientName(info.clientName ?? '')
    } catch {
      setDealError('Error de conexión al verificar el deal.')
    } finally {
      setDealLoading(false)
    }
  }

  const handleDealChange = (val: string) => {
    setDealId(val)
    if (dealDebounceRef.current) clearTimeout(dealDebounceRef.current)
    dealDebounceRef.current = setTimeout(() => lookupDeal(val), 600)
  }

  // ─── Submit ───────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dealId.trim()) {
      toast.error('El Deal bancario es obligatorio.')
      return
    }
    if (dealError) {
      toast.error('Corrige el error en el Deal bancario antes de continuar.')
      return
    }
    if (!dealInfo) {
      toast.error('Espera a que se verifique el Deal bancario.')
      return
    }
    if (!categoryId) {
      toast.error('Por favor, selecciona una categoría.')
      return
    }
    if (!bankName) {
      toast.error('El nombre del banco no se pudo obtener del deal.')
      return
    }
    if (!description.trim()) {
      toast.error('Por favor, escribe una descripción.')
      return
    }

    const cat = categories.find(c => c.id === categoryId)
    if (!cat) {
      toast.error('Categoría no encontrada. Por favor, recarga la página.')
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 25_000)

    try {
      const res = await fetch('/api/tickets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          category_id:       categoryId,
          subject:           `${cat.name} — ${bankName}`,
          description:       description.trim(),
          bank_name:         bankName,
          bank_email:        bankEmail.trim() || undefined,
          client_name:       clientName.trim() || undefined,
          pipedrive_deal_id: parseInt(dealId.trim(), 10),
        }),
        credentials: 'include',
        signal:      controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al crear la solicitud.')
        return
      }

      toast.success(`Solicitud ${data.ticket.display_id} creada correctamente.`)
      router.push(`/tickets/${data.ticket.id}`)
      router.refresh()
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('La solicitud tardó demasiado. Comprueba tu conexión.')
      } else {
        toast.error('Error de conexión. Comprueba tu red.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">

      {/* Deal bancario */}
      <div>
        <Label htmlFor="dealId">Deal bancario *</Label>
        <div className="relative mt-1">
          <Input
            id="dealId"
            type="text"
            inputMode="numeric"
            placeholder="Ej: 275056"
            value={dealId}
            onChange={e => handleDealChange(e.target.value)}
            className="focus:ring-[#083D20] focus:border-[#083D20] pr-8"
            required
          />
          {dealLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">
              ···
            </span>
          )}
        </div>
        {dealError && (
          <p className="mt-1 text-xs text-red-600">{dealError}</p>
        )}
        {dealInfo && !dealError && (
          <p className="mt-1 text-xs text-green-700">
            ✓ Deal verificado — {dealInfo.bankName || 'banco no especificado en Pipedrive'}
            {dealInfo.clientName ? ` · ${dealInfo.clientName}` : ''}
          </p>
        )}
      </div>

      {/* Nombre del cliente (auto-rellenado desde Pipedrive) */}
      {dealInfo && (
        <div>
          <Label htmlFor="clientName">
            Nombre del cliente{' '}
            <span className="text-gray-400 font-normal text-xs">(obtenido del deal)</span>
          </Label>
          <Input
            id="clientName"
            type="text"
            placeholder="Sin contacto asignado en Pipedrive"
            value={clientName}
            readOnly
            className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed focus:ring-[#083D20] focus:border-[#083D20]"
          />
        </div>
      )}

      {/* Categoría */}
      <div>
        <Label htmlFor="category">Categoría *</Label>
        <select
          id="category"
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#083D20] focus:border-[#083D20]"
          required
        >
          <option value="">Selecciona una categoría…</option>
          {BANKING_CATEGORIES.map(name => {
            const cat = categories.find(c => c.name === name)
            if (!cat) return null
            return (
              <option key={cat.id} value={cat.id}>{name}</option>
            )
          })}
        </select>
      </div>

      {/* Nombre del banco (auto-rellenado desde Pipedrive, read-only) */}
      <div>
        <Label htmlFor="bankName">
          Nombre del banco *{' '}
          {dealInfo && <span className="text-gray-400 font-normal text-xs">(obtenido del deal)</span>}
        </Label>
        <Input
          id="bankName"
          type="text"
          placeholder="Se rellena automáticamente al introducir el deal"
          value={bankName}
          readOnly={!!dealInfo}
          onChange={e => !dealInfo && setBankName(e.target.value)}
          className={`mt-1 focus:ring-[#083D20] focus:border-[#083D20] ${dealInfo ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          required
        />
      </div>

      {/* Email bancario (auto-rellenado desde Pipedrive) */}
      <div>
        <Label htmlFor="bankEmail">
          Email bancario{' '}
          {dealInfo
            ? <span className="text-gray-400 font-normal text-xs">(obtenido del deal)</span>
            : <span className="text-gray-400 font-normal">(opcional)</span>
          }
        </Label>
        <Input
          id="bankEmail"
          type="email"
          placeholder="gestor@banco.es"
          value={bankEmail}
          readOnly={!!dealInfo && !!bankEmail}
          onChange={e => !(dealInfo && bankEmail) && setBankEmail(e.target.value)}
          className={`mt-1 focus:ring-[#083D20] focus:border-[#083D20] ${dealInfo && bankEmail ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Descripción */}
      <div>
        <Label htmlFor="description">Descripción *</Label>
        <Textarea
          id="description"
          placeholder="Describe la gestión que necesitas realizar…"
          rows={5}
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          className="mt-1 focus:ring-[#083D20] focus:border-[#083D20]"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <Button
          type="submit"
          isLoading={loading}
          className="bg-[#083D20] hover:bg-[#0a4d28] text-white focus:ring-[#083D20]"
        >
          Crear Solicitud
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
