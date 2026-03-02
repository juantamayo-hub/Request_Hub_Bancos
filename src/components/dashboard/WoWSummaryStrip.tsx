import type { VelocityDay } from '@/lib/database.types'

interface Props {
  velocityLast7Days:     VelocityDay[]
  avgResolutionDays:     number
  prevWeekAvgResolution: number
}

export function WoWSummaryStrip({ velocityLast7Days, avgResolutionDays, prevWeekAvgResolution }: Props) {
  const opened = velocityLast7Days.reduce((s, d) => s + d.opened, 0)
  const closed  = velocityLast7Days.reduce((s, d) => s + d.closed, 0)
  const net     = closed - opened

  const resolutionDelta =
    prevWeekAvgResolution > 0 ? prevWeekAvgResolution - avgResolutionDays : null

  const netStr  = net > 0 ? `net +${net} resolved` : net < 0 ? `net ${net} backlog` : 'net 0 change'
  const avgStr  = avgResolutionDays > 0 ? `avg ${avgResolutionDays}d resolution` : null
  const deltaStr =
    resolutionDelta !== null && Math.abs(resolutionDelta) >= 0.1
      ? `(${resolutionDelta > 0 ? '↓' : '↑'}${Math.abs(resolutionDelta).toFixed(1)}d vs last week)`
      : null

  const parts = [
    `${opened} opened`,
    `${closed} closed`,
    netStr,
    avgStr && deltaStr ? `${avgStr} ${deltaStr}` : avgStr,
  ].filter(Boolean)

  return (
    <p className="text-sm text-gray-400">
      <span className="font-medium text-gray-500">This week — </span>
      {parts.join(' · ')}
    </p>
  )
}
