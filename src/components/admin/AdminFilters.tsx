'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/constants'
import type { TicketPriority } from '@/lib/database.types'

interface AdminOption {
  id:         string
  email:      string
  first_name: string | null
  last_name:  string | null
}

interface CategoryOption {
  id:   string
  name: string
}

interface Props {
  current: {
    statuses?:      string  // comma-separated TicketStatus values
    priority?:      TicketPriority
    q?:             string
    assignee?:      string
    category_ids?:  string  // comma-separated category IDs
    from?:          string
    to?:            string
  }
  admins:      AdminOption[]
  categories?: CategoryOption[]
}

export function AdminFilters({ current, admins, categories = [] }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const [, startTransition] = useTransition()

  // ─── Dropdown open state ──────────────────────────────────────
  const [catOpen, setCatOpen]       = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const catRef    = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  // ─── Pending (local) selections — applied on dropdown close ──
  const urlCatIds   = (current.category_ids ?? '').split(',').filter(Boolean)
  const urlStatuses = (current.statuses ?? '').split(',').filter(Boolean)

  const [pendingCatIds,   setPendingCatIds]   = useState<string[]>(urlCatIds)
  const [pendingStatuses, setPendingStatuses] = useState<string[]>(urlStatuses)

  // Sync local state when URL changes (e.g. "Clear filters")
  useEffect(() => { setPendingCatIds((current.category_ids ?? '').split(',').filter(Boolean)) }, [current.category_ids])
  useEffect(() => { setPendingStatuses((current.statuses ?? '').split(',').filter(Boolean)) }, [current.statuses])

  // ─── Search debounce ──────────────────────────────────────────
  const [searchValue, setSearchValue] = useState(current.q ?? '')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  // Sync search when URL changes externally
  useEffect(() => { setSearchValue(current.q ?? '') }, [current.q])

  // ─── Close dropdowns on outside click ────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node) && catOpen) {
        applyCategories(pendingCatIds)
        setCatOpen(false)
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node) && statusOpen) {
        applyStatuses(pendingStatuses)
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catOpen, statusOpen, pendingCatIds, pendingStatuses])

  // ─── Apply helpers ────────────────────────────────────────────
  const applyCategories = useCallback((ids: string[]) => {
    const nextStr = ids.join(',')
    const next = new URLSearchParams(params.toString())
    if (nextStr) next.set('category_ids', nextStr)
    else next.delete('category_ids')
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname])

  const applyStatuses = useCallback((vals: string[]) => {
    const nextStr = vals.join(',')
    const next = new URLSearchParams(params.toString())
    if (nextStr) next.set('statuses', nextStr)
    else next.delete('statuses')
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname])

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  }, [params, pathname, router])

  // ─── Search with debounce ─────────────────────────────────────
  const handleSearch = (value: string) => {
    setSearchValue(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => update('q', value), 300)
  }

  // ─── Dropdown toggle helpers ──────────────────────────────────
  function toggleCatDropdown() {
    if (catOpen) {
      applyCategories(pendingCatIds)
    }
    setCatOpen(o => !o)
  }

  function toggleStatusDropdown() {
    if (statusOpen) {
      applyStatuses(pendingStatuses)
    }
    setStatusOpen(o => !o)
  }

  const clear = () => startTransition(() => router.replace(pathname))

  const hasFilters = !!(current.statuses || current.priority || current.q || current.assignee || current.category_ids || current.from || current.to)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search with debounce */}
      <input
        type="search"
        placeholder="Search tickets…"
        value={searchValue}
        onChange={e => handleSearch(e.target.value)}
        className="h-8 px-3 text-sm border border-gray-300 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {/* Status multiselect — applied on close */}
      <div className="relative" ref={statusRef}>
        <button
          type="button"
          onClick={toggleStatusDropdown}
          className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white flex items-center gap-1.5 whitespace-nowrap"
        >
          {pendingStatuses.length === 0
            ? 'All statuses'
            : `${pendingStatuses.length} estado${pendingStatuses.length !== 1 ? 's' : ''}`}
          <span className="text-gray-400 text-xs">▾</span>
        </button>
        {statusOpen && (
          <div className="absolute top-9 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
            {TICKET_STATUSES.map(s => (
              <label key={s.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={pendingStatuses.includes(s.value)}
                  onChange={() =>
                    setPendingStatuses(prev =>
                      prev.includes(s.value) ? prev.filter(x => x !== s.value) : [...prev, s.value],
                    )
                  }
                  className="rounded border-gray-300"
                />
                {s.label}
              </label>
            ))}
          </div>
        )}
      </div>

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

      {/* Category multiselect — applied on close */}
      {categories.length > 0 && (
        <div className="relative" ref={catRef}>
          <button
            type="button"
            onClick={toggleCatDropdown}
            className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white flex items-center gap-1.5 whitespace-nowrap"
          >
            {pendingCatIds.length === 0
              ? 'Todas las categorías'
              : `${pendingCatIds.length} categoría${pendingCatIds.length !== 1 ? 's' : ''}`}
            <span className="text-gray-400 text-xs">▾</span>
          </button>
          {catOpen && (
            <div className="absolute top-9 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[220px] max-h-64 overflow-y-auto">
              {categories.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={pendingCatIds.includes(c.id)}
                    onChange={() =>
                      setPendingCatIds(prev =>
                        prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id],
                      )
                    }
                    className="rounded border-gray-300"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Desde</label>
        <input
          type="date"
          value={current.from ?? ''}
          onChange={e => update('from', e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Hasta</label>
        <input
          type="date"
          value={current.to ?? ''}
          onChange={e => update('to', e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

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
        <button onClick={clear} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          Clear filters
        </button>
      )}
    </div>
  )
}
