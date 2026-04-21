interface FunnelKPI {
  fromLabel: string
  toLabel:   string
  cohort:    number
  count:     number
  rate:      number
}

interface Props {
  kpis:     FunnelKPI[]
  ytdKpis?: FunnelKPI[]   // YTD averages for comparison
  bsTotal:  number
  period:   string
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

export function FunnelKPIStrip({ kpis, ytdKpis, bsTotal, period }: Props) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
        {kpis.map((kpi, i) => {
          const ytd      = ytdKpis?.[i]
          const hasDelta = ytd && kpi.cohort > 0 && ytd.cohort > 0
          const delta    = hasDelta ? kpi.rate - ytd.rate : 0
          const isAbove  = delta > 0
          const isBelow  = delta < 0

          return (
            <div key={`${kpi.fromLabel}-${kpi.toLabel}`} className="px-5 py-4">

              {/* Stage labels */}
              <div className="flex items-center gap-1.5 mb-3 min-w-0">
                <span className="text-xs font-medium text-gray-600 truncate">{kpi.fromLabel}</span>
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-medium text-gray-600 truncate">{kpi.toLabel}</span>
              </div>

              {/* Big percentage */}
              <p className={`text-3xl font-bold tabular-nums ${rateColor(kpi.rate)}`}>
                {kpi.cohort === 0 ? '—' : `${kpi.rate}%`}
              </p>

              {/* YTD comparison badge */}
              {hasDelta && delta !== 0 && (
                <p className={`text-xs font-medium mt-1 ${isAbove ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isAbove ? '▲' : '▼'} {Math.abs(delta)}pp vs YTD ({ytd.rate}%)
                </p>
              )}
              {hasDelta && delta === 0 && (
                <p className="text-xs text-gray-400 mt-1">= YTD ({ytd.rate}%)</p>
              )}

              {/* Progress bar */}
              <div className="mt-2 mb-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(kpi.rate)}`}
                  style={{ width: kpi.cohort === 0 ? '0%' : `${kpi.rate}%` }}
                />
              </div>

              {/* Deal count */}
              <p className="text-xs text-gray-400">
                {kpi.cohort === 0
                  ? 'Sin deals en este periodo'
                  : `${kpi.count} de ${kpi.cohort} deal${kpi.cohort !== 1 ? 's' : ''} avanzaron`
                }
              </p>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {bsTotal} deal{bsTotal !== 1 ? 's' : ''} con Bank Submission · {period}
        </p>
      </div>
    </div>
  )
}
