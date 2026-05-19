'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

interface CategoryOption {
  id:   string
  name: string
}

interface Props {
  current: {
    category_ids?: string  // comma-separated category IDs
    from?:         string
    to?:           string
    deal_id?:      string  // Pipedrive deal ID (exact match)
    client_name?:  string  // partial text search
  }
  categories: CategoryOption[]
}

export function TicketFilters({ current, categories }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const [, startTransition] = useTransition()

  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  // Pending selections — applied on dropdown close
  const urlCatIds = (current.category_ids ?? '').split(',').filter(Boolean)
  const [pendingCatIds, setPendingCatIds] = useState<string[]>(urlCatIds)

  // Text filter state with debounce timers
  const [clientNameValue, setClientNameValue] = useState(current.client_name ?? '')
  const [dealIdValue,     setDealIdValue]     = useState(current.deal_id     ?? '')
  const clientNameTimer = useRef<ReturnType<typeof setTimeout>>()
  const dealIdTimer     = useRef<ReturnType<typeof setTimeout>>()

  // Sync when URL changes (e.g. "Clear filters")
  useEffect(() => {
    setPendingCatIds((current.category_ids ?? '').split(',').filter(Boolean))
  }, [current.category_ids])
  useEffect(() => { setClientNameValue(current.client_name ?? '') }, [current.client_name])
  useEffect(() => { setDealIdValue(current.deal_id ?? '')         }, [current.deal_id])

  const applyCategories = useCallback((ids: string[]) => {
    const nextStr = ids.join(',')
    const next = new URLSearchParams(params.toString())
    if (nextStr) next.set('category_ids', nextStr)
    else next.delete('category_ids')
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname])

  // Close on outside click — apply pending selection
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node) && catOpen) {
        applyCategories(pendingCatIds)
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catOpen, pendingCatIds])

  function toggleDropdown() {
    if (catOpen) applyCategories(pendingCatIds)
    setCatOpen(o => !o)
  }

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => router.replace(`${pathname}?${next.toString()}`))
  }, [params, pathname, router])

  const handleClientName = (value: string) => {
    setClientNameValue(value)
    clearTimeout(clientNameTimer.current)
    clientNameTimer.current = setTimeout(() => update('client_name', value), 300)
  }

  const handleDealId = (value: string) => {
    setDealIdValue(value)
    clearTimeout(dealIdTimer.current)
    dealIdTimer.current = setTimeout(() => update('deal_id', value), 400)
  }

  const clear = () => startTransition(() => router.replace(pathname))

  const hasFilters = !!(current.category_ids || current.from || current.to || current.deal_id || current.client_name)

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {categories.length > 0 && (
        <div className="relative" ref={catRef}>
          <button
            type="button"
            onClick={toggleDropdown}
            className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083D20] bg-white flex items-center gap-1.5 whitespace-nowrap"
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

      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Desde</label>
        <input
          type="date"
          value={current.from ?? ''}
          onChange={e => update('from', e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083D20]"
        />
      </div>

      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Hasta</label>
        <input
          type="date"
          value={current.to ?? ''}
          onChange={e => update('to', e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083D20]"
        />
      </div>

      {/* Deal ID filter */}
      <input
        type="text"
        inputMode="numeric"
        placeholder="Deal ID"
        value={dealIdValue}
        onChange={e => handleDealId(e.target.value)}
        className="h-8 px-3 text-sm border border-gray-300 rounded-lg w-28 focus:outline-none focus:ring-2 focus:ring-[#083D20]"
      />

      {/* Client name filter */}
      <input
        type="search"
        placeholder="Nombre cliente"
        value={clientNameValue}
        onChange={e => handleClientName(e.target.value)}
        className="h-8 px-3 text-sm border border-gray-300 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-[#083D20]"
      />

      {hasFilters && (
        <button onClick={clear} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
