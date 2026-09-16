'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  ticketId:          string
  isAdmin?:          boolean
  pipedriveDealId?:  number
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AddCommentForm({ ticketId, isAdmin = false, pipedriveDealId }: Props) {
  const router      = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [body,         setBody]         = useState('')
  const [visibility,   setVisibility]   = useState<'public' | 'internal'>('public')
  const [files,        setFiles]        = useState<File[]>([])
  const [loading,      setLoading]      = useState(false)
  const [claimChannel, setClaimChannel] = useState('N/A')

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...selected.filter(f => !names.has(f.name))]
    })
    // reset input so the same file can be re-selected after removal
    e.target.value = ''
  }

  const removeFile = (name: string) =>
    setFiles(prev => prev.filter(f => f.name !== name))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) { toast.error('El comentario no puede estar vacío.'); return }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('body', body.trim())
      fd.append('visibility', visibility)
      files.forEach(f => fd.append('files', f))
      if (pipedriveDealId) fd.append('claim_channel', claimChannel)

      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method:      'POST',
        body:        fd,
        credentials: 'include',
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al publicar el comentario.')
        return
      }

      toast.success('Comentario publicado.')
      setBody('')
      setFiles([])
      setClaimChannel('N/A')
      router.refresh()
    } catch {
      toast.error('Error de conexión. Revisa tu red e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder={
          isAdmin
            ? 'Escribe un comentario… Usa "Interno" para notas solo visibles para el equipo.'
            : 'Escribe una respuesta…'
        }
        rows={3}
        value={body}
        onChange={e => setBody(e.target.value)}
      />

      {/* File list preview */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.name} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-gray-400 shrink-0">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(f.name)}
                className="text-gray-400 hover:text-red-500 shrink-0"
                aria-label="Remove file"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {pipedriveDealId && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium shrink-0">Vía de reclamación</label>
          <select
            value={claimChannel}
            onChange={e => setClaimChannel(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#083D20]"
          >
            <option value="N/A">N/A</option>
            <option value="Phone">Teléfono</option>
            <option value="Email">Email</option>
            <option value="WhatsApp">WhatsApp</option>
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" isLoading={loading}>
          Publicar
        </Button>

        {/* Attach file button — admin only */}
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Adjuntar archivos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFiles}
            />
          </>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500 font-medium">Visibilidad</label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as 'public' | 'internal')}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#083D20]"
            >
              <option value="public">Público (visible para el solicitante)</option>
              <option value="internal">Interno (solo equipo)</option>
            </select>
          </div>
        )}
      </div>
    </form>
  )
}
