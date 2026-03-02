import type { DashboardMetrics } from '@/lib/database.types'

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 60
  const h = 24
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  const last = data[data.length - 1]
  const lastX = w
  const lastY = h - ((last - min) / range) * (h - 4) - 2

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="#d1d5db"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="#3b82f6" />
    </svg>
  )
}

function TrendArrow({
  current,
  prev,
  invertGood = false,
}: {
  current: number
  prev: number
  invertGood?: boolean
}) {
  if (prev === 0) return null
  const delta = ((current - prev) / prev) * 100
  if (Math.abs(delta) < 1) return <span className="text-xs text-gray-400">No change</span>
  const isUp = delta > 0
  const isGood = invertGood ? !isUp : isUp
  const arrow = isUp ? '↑' : '↓'
  const color = isGood ? 'text-green-600' : 'text-red-500'
  return (
    <span className={`text-xs ${color}`}>
      {arrow} {Math.abs(Math.round(delta))}% vs last week
    </span>
  )
}

interface Props {
  metrics: DashboardMetrics
}

export function CommandStrip({ metrics: m }: Props) {
  const openedSparkline = m.velocityLast7Days.map(d => d.opened)
  const thisWeekOpened = m.velocityLast7Days.reduce((s, d) => s + d.opened, 0)
  const thisWeekClosed = m.velocityLast7Days.reduce((s, d) => s + d.closed, 0)
  const netVelocity = thisWeekClosed - thisWeekOpened

  // Avg resolution WoW delta
  const resolutionDelta =
    m.prevWeekAvgResolution > 0
      ? m.prevWeekAvgResolution - m.avgResolutionDays
      : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
      {/* Open Tickets */}
      <div className="px-6 py-5 hover:bg-gray-50/60 transition-colors">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Open Tickets
        </p>
        <div className="flex items-end justify-between gap-2">
          <p
            className={`text-4xl font-bold tabular-nums leading-none ${
              m.openTickets > 50 ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {m.openTickets}
          </p>
          <div className="pb-1">
            <Sparkline data={openedSparkline} />
          </div>
        </div>
        <div className="mt-2">
          <TrendArrow current={m.openTickets} prev={m.prevWeekOpen} invertGood />
        </div>
      </div>

      {/* SLA Breaching */}
      <div className="px-6 py-5 hover:bg-gray-50/60 transition-colors">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          SLA Breaching
        </p>
        <p
          className={`text-4xl font-bold tabular-nums leading-none ${
            m.slaBreaching > 0 ? 'text-red-600' : 'text-gray-400'
          }`}
        >
          {m.slaBreaching}
        </p>
        <div className="mt-2">
          {m.slaBreaching === 0 ? (
            <span className="text-xs text-green-600">All SLAs met</span>
          ) : (
            <TrendArrow
              current={m.slaBreaching}
              prev={m.prevWeekSlaBreaching}
              invertGood
            />
          )}
        </div>
      </div>

      {/* Avg Resolution */}
      <div className="px-6 py-5 hover:bg-gray-50/60 transition-colors">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Avg Resolution
        </p>
        <p className="text-4xl font-bold tabular-nums leading-none text-gray-900">
          {m.avgResolutionDays}
          <span className="text-xl font-medium text-gray-400 ml-1">d</span>
        </p>
        <div className="mt-2">
          {resolutionDelta !== null && Math.abs(resolutionDelta) >= 0.1 ? (
            <span
              className={`text-xs ${resolutionDelta > 0 ? 'text-green-600' : 'text-red-500'}`}
            >
              {resolutionDelta > 0 ? '↓' : '↑'} {Math.abs(resolutionDelta).toFixed(1)}d vs last week
            </span>
          ) : (
            <span className="text-xs text-gray-400">No change</span>
          )}
        </div>
      </div>

      {/* Ticket Velocity */}
      <div className="px-6 py-5 hover:bg-gray-50/60 transition-colors">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          This Week
        </p>
        <p
          className={`text-4xl font-bold tabular-nums leading-none ${
            netVelocity > 0 ? 'text-green-600' : netVelocity < 0 ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {netVelocity > 0 ? '+' : ''}
          {netVelocity}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">{thisWeekOpened} opened</span>
          <span className="text-xs text-gray-300">·</span>
          <span
            className={`text-xs ${
              thisWeekClosed >= thisWeekOpened ? 'text-green-600' : 'text-gray-500'
            }`}
          >
            {thisWeekClosed} closed
          </span>
        </div>
      </div>
    </div>
  )
}
