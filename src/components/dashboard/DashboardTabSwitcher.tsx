'use client'

import { useRouter } from 'next/navigation'

interface Props {
  active: 'operaciones' | 'negocio'
}

export function DashboardTabSwitcher({ active }: Props) {
  const router = useRouter()

  return (
    <div className="flex gap-6 border-b border-gray-100 mb-6">
      <button
        onClick={() => router.push('?tab=operaciones')}
        className={`pb-3 text-sm font-medium transition-colors ${
          active === 'operaciones'
            ? 'border-b-2 border-[#083D20] text-[#083D20]'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        Operaciones
      </button>
      <button
        onClick={() => router.push('?tab=negocio')}
        className={`pb-3 text-sm font-medium transition-colors ${
          active === 'negocio'
            ? 'border-b-2 border-[#083D20] text-[#083D20]'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        Negocio
      </button>
    </div>
  )
}
