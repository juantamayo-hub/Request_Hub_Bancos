'use client'

import { useRouter } from 'next/navigation'

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  month: number  // 1–12
}

export function NegocioFilters({ month }: Props) {
  const router   = useRouter()
  const maxMonth = new Date().getMonth() + 1

  return (
    <div className="flex items-center gap-3 mb-6">
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
    </div>
  )
}
