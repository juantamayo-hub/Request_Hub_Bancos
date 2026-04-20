'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/constants'
import type { TicketStatus, TicketPriority } from '@/lib/database.types'

interface AdminOption {
  id:         string
  email:      string
  first_name: string | null
  last_name:  string | null
}

interface Props {
  current: {
    status?:   TicketStatus
    priority?: TicketPriority
    q?:        string
    assignee?: string
  }
  admins: AdminOption[]
}

export function AdminFilters({ current, admins }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()
  const [, startTransition] = useTransition()

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`)
      })
    },
    [params, pathname, router],
  )

  const clear = () => {
    startTransition(() => router.push(pathname))
  }

  const hasFilters = !!(current.status || current.priority || current.q || current.assignee)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <input
        type="search"
        placeholder="Search tickets…"
        defaultValue={current.q ?? ''}
        onChange={e => update('q', e.target.value)}
        className="h-8 px-3 text-sm border border-gray-300 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {/* Status filter */}
      <select
        value={current.status ?? ''}
        onChange={e => update('status', e.target.value)}
        className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        <option value="">All statuses</option>
        {TICKET_STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={current.priority ?? ''}
        onChange={e => update('priority', e.target.value)}
        className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        <option value="">All priorities</option>
        {TICKET_PRIORITIES.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      {/* Assignee filter */}
      {admins.length > 0 && (
        <select
          value={current.assignee ?? ''}
          onChange={e => update('assignee', e.target.value)}
          className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Todos los asignados</option>
          {admins.map(a => (
            <option key={a.id} value={a.id}>
              {a.first_name ? `${a.first_name} ${a.last_name ?? ''}`.trim() : a.email}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button
          onClick={clear}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
