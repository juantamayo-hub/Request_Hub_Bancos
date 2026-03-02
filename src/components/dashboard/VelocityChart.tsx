import type { VelocityDay } from '@/lib/database.types'

interface Props {
  velocityLast7Days: VelocityDay[]
}

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function VelocityChart({ velocityLast7Days }: Props) {
  if (velocityLast7Days.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data</div>
  }

  const W = 700
  const H = 160
  const topPad = 20
  const botPad = 28
  const leftPad = 8
  const rightPad = 8
  const chartW = W - leftPad - rightPad
  const chartH = H - topPad - botPad
  const n = velocityLast7Days.length

  const maxVal = Math.max(...velocityLast7Days.flatMap(d => [d.opened, d.closed]), 1)

  const xOf = (i: number) => leftPad + (i / Math.max(n - 1, 1)) * chartW
  const yOf = (v: number) => topPad + (1 - v / maxVal) * chartH

  const openedPoints = velocityLast7Days.map((d, i) => `${xOf(i)},${yOf(d.opened)}`).join(' ')
  const closedPoints = velocityLast7Days.map((d, i) => `${xOf(i)},${yOf(d.closed)}`).join(' ')

  // Closed area fill path
  const baselineY = topPad + chartH
  const closedPath = [
    `M ${xOf(0)} ${yOf(velocityLast7Days[0].closed)}`,
    ...velocityLast7Days.map((d, i) => `L ${xOf(i)} ${yOf(d.closed)}`),
    `L ${xOf(n - 1)} ${baselineY}`,
    `L ${xOf(0)} ${baselineY}`,
    'Z',
  ].join(' ')

  const dayLabels = velocityLast7Days.map(d => {
    const date = new Date(d.date + 'T12:00:00')
    return DAY_ABBR[date.getDay()]
  })

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-label="Ticket velocity last 7 days"
        style={{ overflow: 'visible' }}
      >
        {/* Baseline */}
        <line
          x1={leftPad}
          x2={W - rightPad}
          y1={baselineY}
          y2={baselineY}
          stroke="#f3f4f6"
          strokeWidth="1"
        />

        {/* Closed area fill */}
        <path d={closedPath} fill="rgba(34,197,94,0.06)" />

        {/* Opened line (gray, thin) */}
        <polyline
          points={openedPoints}
          fill="none"
          stroke="#d1d5db"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Closed line (green, thicker) */}
        <polyline
          points={closedPoints}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Opened dots */}
        {velocityLast7Days.map((d, i) => (
          <circle
            key={`o${i}`}
            cx={xOf(i)}
            cy={yOf(d.opened)}
            r="3"
            fill="white"
            stroke="#d1d5db"
            strokeWidth="1.5"
          />
        ))}

        {/* Closed dots */}
        {velocityLast7Days.map((d, i) => (
          <circle key={`c${i}`} cx={xOf(i)} cy={yOf(d.closed)} r="3.5" fill="#22c55e" />
        ))}

        {/* Day labels */}
        {velocityLast7Days.map((_, i) => (
          <text
            key={`l${i}`}
            x={xOf(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="11"
            fill="#9ca3af"
            fontFamily="system-ui, sans-serif"
          >
            {dayLabels[i]}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <svg width="16" height="2" aria-hidden="true">
            <line x1="0" y1="1" x2="16" y2="1" stroke="#d1d5db" strokeWidth="1.5" />
          </svg>
          <span className="text-xs text-gray-400">Opened</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="3" aria-hidden="true">
            <line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#22c55e" strokeWidth="2.5" />
          </svg>
          <span className="text-xs text-gray-400">Closed</span>
        </div>
      </div>
    </div>
  )
}
