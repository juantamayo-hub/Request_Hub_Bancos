'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

interface CategoryOption {
  id:   string
  name: string
}

interface Props {
  current: {
    category_id?: string
    from?:        string
    to?:          string
  }
  categories: CategoryOption[]
}

export function TicketFilters({ current, categories }: Props) {
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

  const clear = () => startTransition(() => router.push(pathname))

  const hasFilters = !!(current.category_id || current.from || current.to)

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {categories.length > 0 && (
        <select
          value={current.category_id ?? ''}
          onChange={e => update('category_id', e.target.value)}
          className="h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#083D20]"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
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
