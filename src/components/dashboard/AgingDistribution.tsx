interface AgeBucket {
  bucket: '1-3d' | '3-7d' | '7d+'
  count:  number
}

interface Props {
  ageDistribution: AgeBucket[]
  openTickets:     number
}

const BUCKET_CONFIG = {
  '1-3d': { label: '< 3 days',  barColor: 'bg-blue-200',  textColor: 'text-blue-700' },
  '3-7d': { label: '3–7 days',  barColor: 'bg-amber-300', textColor: 'text-amber-700' },
  '7d+':  { label: '7+ days',   barColor: 'bg-red-400',   textColor: 'text-red-700' },
} as const

export function AgingDistribution({ ageDistribution, openTickets }: Props) {
  const total = openTickets || 1

  const hasAging = ageDistribution.find(b => b.bucket === '7d+')?.count ?? 0
  const agingPct = Math.round((hasAging / total) * 100)

  return (
    <div className="space-y-2.5">
      {ageDistribution.map(({ bucket, count }) => {
        const cfg = BUCKET_CONFIG[bucket]
        const pct = Math.round((count / total) * 100)
        const barWidth = `${Math.max(pct, count > 0 ? 4 : 0)}%`

        return (
          <div key={bucket} className="flex items-center gap-3">
            <span className="w-16 text-xs text-gray-500 shrink-0">{cfg.label}</span>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${cfg.barColor}`}
                style={{ width: barWidth }}
              />
            </div>
            <span className={`w-8 text-right text-xs tabular-nums font-medium ${cfg.textColor}`}>
              {count}
            </span>
          </div>
        )
      })}

      {hasAging > 0 && agingPct > 10 && (
        <p className="text-xs text-amber-600 pt-1">
          Attention needed — {agingPct}% of open tickets are aging
        </p>
      )}
    </div>
  )
}
