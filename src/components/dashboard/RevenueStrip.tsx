interface RevenueData {
  bayteca:   number
  md:        number
  total:     number
  dealCount: { bayteca: number; md: number }
}

interface Props {
  revenue:    RevenueData
  dateRange:  { from: string; to: string }
}

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style:    'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function RevenueStrip({ revenue, dateRange }: Props) {
  const totalDeals = revenue.dealCount.bayteca + revenue.dealCount.md

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">

      {/* Total */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Revenue Total
        </p>
        <p className="text-3xl font-bold tabular-nums text-gray-900">
          {formatEUR(revenue.total)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {totalDeals} operación{totalDeals !== 1 ? 'es' : ''} ganada{totalDeals !== 1 ? 's' : ''} · {dateRange.from} – {dateRange.to}
        </p>
      </div>

      {/* Bayteca */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Bayteca Bank Area
        </p>
        <p className="text-2xl font-bold tabular-nums text-[#083D20]">
          {formatEUR(revenue.bayteca)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {revenue.dealCount.bayteca} deal{revenue.dealCount.bayteca !== 1 ? 's' : ''} · Bank Fee
        </p>
      </div>

      {/* Mortgage Direct */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Mortgage Direct Bank Area
        </p>
        <p className="text-2xl font-bold tabular-nums text-[#1F3657]">
          {formatEUR(revenue.md)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {revenue.dealCount.md} deal{revenue.dealCount.md !== 1 ? 's' : ''} · Membership Payment
        </p>
      </div>

    </div>
  )
}
