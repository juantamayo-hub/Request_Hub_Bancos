'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { formatDate, displayName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { TicketCommentWithAuthor } from '@/lib/database.types'

interface Props {
  comments:         TicketCommentWithAuthor[]
  currentProfileId: string
  isAdmin?:         boolean
  ticketId:         string
}

function FileIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

export function CommentThread({ comments, currentProfileId, isAdmin = false, ticketId }: Props) {
  const router = useRouter()
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editBody, setEditBody]     = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  // Optimistic overrides: body edits and hidden (deleted) ids
  // These are temporary until router.refresh() brings fresh server data
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({})
  const [hiddenIds, setHiddenIds]       = useState<Set<string>>(new Set())

  // Clear stale optimistic overrides once server data catches up
  useEffect(() => {
    setPendingEdits(prev => {
      const next = { ...prev }
      for (const c of comments) {
        if (next[c.id] !== undefined && next[c.id] === c.body) delete next[c.id]
      }
      return next
    })
    setHiddenIds(prev => {
      if (prev.size === 0) return prev
      const serverIds = new Set(comments.map(c => c.id))
      const next = new Set([...prev].filter(id => serverIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [comments])

  const visible = comments.filter(c => !hiddenIds.has(c.id))

  if (visible.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No comments yet.</p>
  }

  function startEdit(comment: TicketCommentWithAuthor) {
    setEditingId(comment.id)
    setEditBody(pendingEdits[comment.id] ?? comment.body)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
  }

  async function saveEdit(commentId: string) {
    if (!editBody.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      // Optimistically show the new body until server data arrives
      setPendingEdits(prev => ({ ...prev, [commentId]: editBody.trim() }))
      setEditingId(null)
      router.refresh()
    } catch {
      alert('Error al guardar el comentario. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(commentId: string) {
    setDeletingId(commentId)
    setSaving(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments/${commentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed')
      // Optimistically hide until server data confirms deletion
      setHiddenIds(prev => new Set([...prev, commentId]))
      router.refresh()
    } catch {
      alert('Error al eliminar el comentario. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
      setDeletingId(null)
    }
  }

  return (
    <ol className="space-y-4">
      {visible.map(comment => {
        const isMine      = comment.author_id === currentProfileId
        const isInternal  = comment.visibility === 'internal'
        const attachments = comment.attachments ?? []
        const isEditing   = editingId === comment.id
        const isDeleting  = deletingId === comment.id
        const displayBody = pendingEdits[comment.id] ?? comment.body

        return (
          <li
            key={comment.id}
            className={cn(
              'rounded-lg p-4 text-sm',
              isInternal
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-gray-50 border border-gray-100',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              {comment.profiles?.avatar_url ? (
                <Image
                  src={comment.profiles.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                  {comment.profiles
                    ? (comment.profiles.first_name?.[0] ?? comment.profiles.email[0]).toUpperCase()
                    : '?'}
                </div>
              )}

              <span className="font-medium text-gray-800">
                {comment.profiles ? displayName(comment.profiles) : 'Sistema'}
                {isMine && <span className="text-gray-400 font-normal"> (you)</span>}
              </span>

              <span className="text-gray-400">·</span>
              <time className="text-gray-400 text-xs">{formatDate(comment.created_at)}</time>
              {comment.updated_at !== comment.created_at && (
                <span className="text-gray-400 text-xs italic">(editado)</span>
              )}

              {isAdmin && isInternal && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  Internal
                </span>
              )}

              {/* Admin actions — only on own comments */}
              {isAdmin && isMine && !isEditing && (
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => startEdit(comment)}
                    title="Editar comentario"
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Eliminar este comentario? Esta acción no se puede deshacer.')) {
                        confirmDelete(comment.id)
                      }
                    }}
                    disabled={isDeleting && saving}
                    title="Eliminar comentario"
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>

            {/* Body or edit form */}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#083D20] resize-y"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(comment.id)}
                    disabled={saving || !editBody.trim()}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#083D20] text-white hover:bg-[#0a4d28] disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {displayBody}
              </p>
            )}

            {/* Attachments */}
            {!isEditing && attachments.length > 0 && (
              <ul className="mt-3 space-y-1">
                {attachments.map(att => (
                  <li key={att.id}>
                    <a
                      href={att.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={att.file_name}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <FileIcon />
                      <span>{att.file_name}</span>
                      <span className="text-gray-400">({formatBytes(att.file_size)})</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
