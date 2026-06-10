'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/database.types'

interface Notification {
  id:         string
  type:       string
  is_read:    boolean
  created_at: string
  ticket_id:  string
  comment_id: string | null
  ticket:     { display_id: string; subject: string } | null
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)  return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}

interface Props {
  profile: Profile
}

export function NotificationBell({ profile }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen]                   = useState(false)
  const [loading, setLoading]             = useState(false)
  const dropdownRef                        = useRef<HTMLDivElement>(null)
  const router                             = useRouter()

  const isAdmin = profile.role === 'admin'

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json() as { notifications: Notification[] }
      setNotifications(json.notifications ?? [])
    } catch {
      // silent
    }
  }, [])

  // Initial fetch + poll every 120s
  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(() => { void fetchNotifications() }, 120_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function handleMarkAllRead() {
    setLoading(true)
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setLoading(false)
  }

  async function handleClickNotification(n: Notification) {
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
    const href = isAdmin
      ? `/admin/tickets/${n.ticket_id}`
      : `/tickets/${n.ticket_id}`
    setOpen(false)
    router.push(href)
  }

  async function handleDismissNotification(e: React.MouseEvent, n: Notification) {
    e.stopPropagation()
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
    }
    setNotifications(prev => prev.filter(x => x.id !== n.id))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:bg-[#E8F2EC] hover:text-[#083D20] transition-colors"
        aria-label="Notificaciones"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-[#083D20] hover:underline disabled:opacity-50"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin notificaciones</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-stretch border-b border-gray-50 ${!n.is_read ? 'bg-blue-50/60' : ''}`}
                >
                  <button
                    onClick={() => handleClickNotification(n)}
                    className="flex-1 text-left px-4 py-3 flex items-start gap-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {n.ticket?.display_id ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{n.ticket?.subject ?? ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Nuevo comentario · {timeAgo(n.created_at)}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDismissNotification(e, n)}
                    className="flex items-center justify-center w-8 shrink-0 text-gray-300 hover:text-red-400 hover:bg-gray-50 transition-colors border-l border-gray-100"
                    aria-label="Descartar notificación"
                    title="Descartar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
