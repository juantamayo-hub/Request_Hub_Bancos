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
  }
  categories: CategoryOption[]
}

export function TicketFilters({ current, categories }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()
  const [, startTransition] = useTransition()

  const [catOpen, setCatOpen] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedCatIds = (current.category_ids ?? '').split(',').filter(Boolean)

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

  const toggleCategory = useCallback(
    (id: string) => {
      const next = selectedCatIds.includes(id)
        ? selectedCatIds.filter(x => x !== id)
        : [...selectedCatIds, id]
      const nextStr = next.join(',')
      const nextParams = new URLSearchParams(params.toString())
      if (nextStr) nextParams.set('category_ids', nextStr)
      else nextParams.delete('category_ids')
      startTransition(() => router.push(`${pathname}?${nextParams.toString()}`))
    },
    [selectedCatIds, params, pathname, router],
  )

  const clear = () => startTransition(() => router.push(pathname))

  const hasFilters = !!(current.category_ids || current.from || current.to)

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {categories.length > 0 && (
        <div className="relative" ref={catRef}>
          <button
            type="button"
            onClick={() => setCatOpen(o => !o)}
            className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083D20] bg-white flex items-center gap-1.5 whitespace-nowrap"
          >
            {selectedCatIds.length === 0
              ? 'Todas las categorías'
              : `${selectedCatIds.length} categoría${selectedCatIds.length !== 1 ? 's' : ''}`}
            <span className="text-gray-400 text-xs">▾</span>
          </button>
          {catOpen && (
            <div className="absolute top-9 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[220px] max-h-64 overflow-y-auto">
              {categories.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedCatIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
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

      {hasFilters && (
        <button
          onClick={clear}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
