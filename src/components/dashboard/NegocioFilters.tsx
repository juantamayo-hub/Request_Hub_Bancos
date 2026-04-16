'use client'

import { useRouter } from 'next/navigation'

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

interface Props {
  selectedMonths: number[]   // 1-based, sorted
  onRefresh?:     () => void
  isLoading?:     boolean
  cachedAt?:      string | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function NegocioFilters({ selectedMonths, onRefresh, isLoading, cachedAt }: Props) {
  const router   = useRouter()
  const maxMonth = new Date().getMonth() + 1  // can't select future months

  function toggle(m: number) {
    const next = new Set(selectedMonths)
    if (next.has(m)) {
      if (next.size === 1) return  // keep at least one month selected
      next.delete(m)
    } else {
      next.add(m)
    }
    const sorted = Array.from(next).sort((a, b) => a - b)
    router.push(`?tab=negocio&months=${sorted.join(',')}`)
  }

  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Meses:</span>

      <div className="flex gap-1.5 flex-wrap">
        {MONTH_LABELS.slice(0, maxMonth).map((label, i) => {
          const m        = i + 1
          const selected = selectedMonths.includes(m)
          return (
            <button
              key={m}
              onClick={() => toggle(m)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                selected
                  ? 'bg-[#083D20] text-white border-[#083D20]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-[#083D20] hover:text-[#083D20]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

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
