import type { FunnelMetrics } from '@/lib/pipedrive'

interface Props {
  data:      FunnelMetrics
  dateRange: { from: string; to: string }
}

function rateColor(rate: number): string {
  if (rate >= 70) return 'text-[#083D20]'
  if (rate >= 45) return 'text-amber-600'
  return 'text-red-600'
}

function barColor(rate: number): string {
  if (rate >= 70) return 'bg-[#083D20]'
  if (rate >= 45) return 'bg-amber-500'
  return 'bg-red-500'
}

export function PipelineFunnelStrip({ data, dateRange }: Props) {
  const { totalDeals, conversions, avgDaysToSign } = data

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {conversions.map((conv) => (
          <div key={`${conv.fromLabel}-${conv.toLabel}`} className="px-5 py-4">

            {/* Stage labels */}
            <div className="flex items-center gap-1.5 mb-3 min-w-0">
              <span className="text-xs font-medium text-gray-600 truncate">{conv.fromLabel}</span>
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs font-medium text-gray-600 truncate">{conv.toLabel}</span>
            </div>

            {/* Big percentage */}
            <p className={`text-3xl font-bold tabular-nums ${rateColor(conv.rate)}`}>
              {conv.fromCount === 0 ? '—' : `${conv.rate}%`}
            </p>

            {/* Progress bar */}
            <div className="mt-2 mb-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(conv.rate)}`}
                style={{ width: conv.fromCount === 0 ? '0%' : `${conv.rate}%` }}
              />
            </div>

            {/* Deal count */}
            <p className="text-xs text-gray-400">
              {conv.fromCount === 0
                ? 'Sin deals en este periodo'
                : `${conv.toCount} de ${conv.fromCount} deal${conv.fromCount !== 1 ? 's' : ''} avanzaron`
              }
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          {totalDeals} deal{totalDeals !== 1 ? 's' : ''} con Bank Submission · {dateRange.from} – {dateRange.to}
        </p>
        {avgDaysToSign !== null && (
          <p className="text-xs text-gray-500 font-medium">
            Avg. {avgDaysToSign} días Bank Submission → Notary Signature
          </p>
        )}
      </div>
    </div>
  )
}
