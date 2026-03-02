import type { TicketPriority } from '@/lib/database.types'

interface PriorityCount {
  priority: TicketPriority
  count:    number
}

interface Props {
  ticketsByPriority: PriorityCount[]
  openTickets:       number
}

const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; barColor: string; textColor: string; bgColor: string }
> = {
  high:   { label: 'High',   barColor: 'bg-red-500',  textColor: 'text-red-700',  bgColor: 'bg-red-50' },
  medium: { label: 'Medium', barColor: 'bg-blue-400', textColor: 'text-blue-700', bgColor: 'bg-blue-50' },
  low:    { label: 'Low',    barColor: 'bg-gray-300', textColor: 'text-gray-600', bgColor: 'bg-gray-50' },
}

const ORDER: TicketPriority[] = ['high', 'medium', 'low']

export function PriorityDistribution({ ticketsByPriority, openTickets }: Props) {
  const total = openTickets || 1
  const sorted = ORDER.map(p => ticketsByPriority.find(t => t.priority === p) ?? { priority: p, count: 0 })

  return (
    <div>
      {/* Pill bar */}
      <div className="flex h-7 rounded-full overflow-hidden gap-px">
        {sorted.map(({ priority, count }) => {
          const pct = (count / total) * 100
          if (count === 0) return null
          return (
            <div
              key={priority}
              title={`${PRIORITY_CONFIG[priority].label}: ${count} (${Math.round(pct)}%)`}
              className={`${PRIORITY_CONFIG[priority].barColor} flex items-center justify-center transition-all`}
              style={{ width: `${pct}%`, minWidth: count > 0 ? '28px' : '0' }}
            >
              {pct >= 12 && (
                <span className="text-xs font-semibold text-white tabular-nums">{Math.round(pct)}%</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4">
        {sorted.map(({ priority, count }) => {
          const cfg = PRIORITY_CONFIG[priority]
          return (
            <div key={priority} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${cfg.barColor}`} />
              <span className="text-xs text-gray-500">{cfg.label}</span>
              <span className={`text-xs font-semibold tabular-nums ${cfg.textColor}`}>{count}</span>
            </div>
          )
        })}
        <span className="ml-auto text-xs text-gray-400 tabular-nums">of {openTickets} open</span>
      </div>
    </div>
  )
}
