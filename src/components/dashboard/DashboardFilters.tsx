'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

interface Props {
  banks:        string[]
  categories:   { id: string; name: string }[]
  defaultFrom?: string  // YYYY-MM-DD, used when no URL param present
  defaultTo?:   string  // YYYY-MM-DD, used when no URL param present
}

export function DashboardFilters({ banks, categories, defaultFrom, defaultTo }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const sp         = useSearchParams()

  const from     = sp.get('from')     ?? defaultFrom ?? ''
  const to       = sp.get('to')       ?? defaultTo   ?? ''
  const bank     = sp.get('bank')     ?? ''
  const category = sp.get('category') ?? ''

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [sp, router, pathname])

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl mb-6">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-1">Filtros</span>

      {/* From */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Desde</label>
        <input
          type="date"
          value={from}
          onChange={e => update('from', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#083D20]"
        />
      </div>

      {/* To */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500">Hasta</label>
        <input
          type="date"
          value={to}
          onChange={e => update('to', e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#083D20]"
        />
      </div>

      {/* Bank */}
      <select
        value={bank}
        onChange={e => update('bank', e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#083D20]"
      >
        <option value="">Todos los bancos</option>
        {banks.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {/* Category */}
      <select
        value={category}
        onChange={e => update('category', e.target.value)}
        className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#083D20]"
      >
        <option value="">Todas las categorías</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Clear */}
      {(from || to || bank || category) && (
        <button
          onClick={() => router.push(pathname)}
          className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
