import type { DashboardMetrics } from '@/lib/database.types'

const SEGMENTS = [
  { key: 'newCount',        label: 'New',        color: 'bg-blue-400' },
  { key: 'inProgressCount', label: 'In Progress', color: 'bg-yellow-400' },
  { key: 'waitingCount',    label: 'Waiting',     color: 'bg-orange-400' },
  { key: 'resolvedCount',   label: 'Resolved',    color: 'bg-green-400' },
  { key: 'closedCount',     label: 'Closed',      color: 'bg-gray-300' },
] as const

type MetricsKey = (typeof SEGMENTS)[number]['key']

interface Props {
  metrics: Pick<
    DashboardMetrics,
    | 'totalTickets'
    | 'newCount'
    | 'inProgressCount'
    | 'waitingCount'
    | 'resolvedCount'
    | 'closedCount'
  >
}

export function StatusPipeline({ metrics: m }: Props) {
  const total = m.totalTickets || 1

  return (
    <div>
      {/* Bar */}
      <div className="flex h-6 rounded-full overflow-hidden gap-px">
        {SEGMENTS.map(seg => {
          const count = m[seg.key as MetricsKey]
          const pct = (count / total) * 100
          if (count === 0) return null
          return (
            <div
              key={seg.key}
              title={`${seg.label}: ${count} (${Math.round(pct)}%)`}
              className={`${seg.color} transition-all`}
              style={{ width: `${pct}%` }}
            />
          )
        })}
      </div>

      {/* Labels */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {SEGMENTS.map(seg => {
          const count = m[seg.key as MetricsKey]
          const pct = Math.round((count / total) * 100)
          return (
            <div key={seg.key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${seg.color}`} />
              <span className="text-xs text-gray-500">{seg.label}</span>
              <span className="text-xs font-semibold tabular-nums text-gray-700">{count}</span>
              <span className="text-xs text-gray-400">({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
