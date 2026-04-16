'use client'

import { useRouter } from 'next/navigation'

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  month:      number   // 1–12
  onRefresh?: () => void
  isLoading?: boolean
  cachedAt?:  string | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function NegocioFilters({ month, onRefresh, isLoading, cachedAt }: Props) {
  const router   = useRouter()
  const maxMonth = new Date().getMonth() + 1

  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <label className="text-sm text-gray-500 font-medium whitespace-nowrap">
        Acumulado hasta:
      </label>
      <select
        value={month}
        onChange={e => router.push(`?tab=negocio&month=${e.target.value}`)}
        className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-[#083D20] focus:outline-none"
      >
        {MONTH_LABELS.slice(0, maxMonth).map((label, i) => (
          <option key={i + 1} value={i + 1}>
            {label}
          </option>
        ))}
      </select>

      {onRefresh && (
        <div className="flex items-center gap-2 ml-auto">
          {cachedAt && !isLoading && (
            <span className="text-xs text-gray-400">
              Actualizado a las {formatTime(cachedAt)}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#083D20] border border-gray-200 rounded-md px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      )}
    </div>
  )
}
