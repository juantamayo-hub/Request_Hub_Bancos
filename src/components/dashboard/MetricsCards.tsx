import type { DashboardMetrics } from '@/lib/database.types'

interface CardProps {
  label:    string
  value:    string | number
  sub?:     string
  accent?:  'red' | 'yellow' | 'green' | 'blue' | 'gray'
}

function MetricCard({ label, value, sub, accent = 'gray' }: CardProps) {
  const accentClass = {
    red:    'border-red-200 bg-red-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    green:  'border-green-200 bg-green-50',
    blue:   'border-blue-200 bg-blue-50',
    gray:   'border-gray-200 bg-white',
  }[accent]

  const textClass = {
    red:    'text-red-700',
    yellow: 'text-yellow-700',
    green:  'text-green-700',
    blue:   'text-blue-700',
    gray:   'text-gray-900',
  }[accent]

  return (
    <div className={`rounded-xl border p-5 ${accentClass}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${textClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

interface Props {
  metrics: DashboardMetrics
}

export function MetricsCards({ metrics: m }: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Total tickets"   value={m.totalTickets} />
        <MetricCard label="Open"            value={m.openTickets}   accent="blue" />
        <MetricCard label="SLA breaching"   value={m.slaBreaching}  accent={m.slaBreaching > 0 ? 'red' : 'gray'} />
        <MetricCard label="Aging (>7d)"     value={m.agingTickets}  accent={m.agingTickets > 0 ? 'yellow' : 'gray'} />
      </div>

      {/* Row 2: Status breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          By Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <MetricCard label="New"                value={m.newCount}        accent="blue" />
          <MetricCard label="In Progress"        value={m.inProgressCount} accent="yellow" />
          <MetricCard label="Waiting on Employee" value={m.waitingCount}   />
          <MetricCard label="Resolved"           value={m.resolvedCount}   accent="green" />
          <MetricCard label="Closed"             value={m.closedCount}     />
        </div>
      </div>

      {/* Row 3: Performance */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Performance
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Avg. resolution time"
            value={`${m.avgResolutionDays} days`}
            sub="For resolved + closed tickets"
            accent={m.avgResolutionDays < 3 ? 'green' : m.avgResolutionDays < 7 ? 'yellow' : 'red'}
          />
          <MetricCard
            label="SLA compliance"
            value={
              m.totalTickets > 0
                ? `${Math.round(((m.totalTickets - m.slaBreaching) / m.totalTickets) * 100)}%`
                : '—'
            }
            sub={`${m.slaBreaching} ticket${m.slaBreaching !== 1 ? 's' : ''} breaching`}
            accent={m.slaBreaching === 0 ? 'green' : 'red'}
          />
        </div>
      </div>
    </div>
  )
}
