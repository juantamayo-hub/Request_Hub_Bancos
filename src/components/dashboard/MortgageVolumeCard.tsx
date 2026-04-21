'use client'

import { useState } from 'react'

interface MortgageVolumeByBank {
  bankName: string
  amount:   number
  count:    number
}

interface Props {
  data: {
    total:  number
    count:  number
    byBank: MortgageVolumeByBank[]
  }
  period: string
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style:    'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function MortgageVolumeCard({ data, period }: Props) {
  const [bankFilter, setBankFilter] = useState('')

  const filtered    = bankFilter ? data.byBank.filter(b => b.bankName === bankFilter) : data.byBank
  const maxAmount   = Math.max(...data.byBank.map(b => b.amount), 1)
  const totalShown  = filtered.reduce((s, b) => s + b.amount, 0)
  const countShown  = filtered.reduce((s, b) => s + b.count,  0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-50">
        <div>
          <p className="text-2xl font-bold tabular-nums text-gray-900">{formatEUR(totalShown)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {countShown} operaciones (won + notary) · {period}
          </p>
        </div>
        <select
          value={bankFilter}
          onChange={e => setBankFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#083D20] flex-shrink-0"
        >
          <option value="">Todos los bancos</option>
          {data.byBank.map(b => (
            <option key={b.bankName} value={b.bankName}>{b.bankName}</option>
          ))}
        </select>
      </div>

      {/* Bank breakdown bars */}
      <div className="px-5 py-4 space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Sin datos para el período seleccionado</p>
        )}
        {filtered.map(bank => (
          <div key={bank.bankName}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]">
                {bank.bankName}
              </span>
              <span className="text-xs text-gray-500 tabular-nums ml-2 whitespace-nowrap">
                {formatEUR(bank.amount)} · {bank.count} op.
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#083D20] rounded-full transition-all duration-300"
                style={{ width: `${Math.round((bank.amount / maxAmount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
