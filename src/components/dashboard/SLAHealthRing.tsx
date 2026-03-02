interface Props {
  openTickets:  number
  slaBreaching: number
}

export function SLAHealthRing({ openTickets, slaBreaching }: Props) {
  const compliance =
    openTickets > 0
      ? Math.round(((openTickets - slaBreaching) / openTickets) * 100)
      : 100

  const radius = 44
  const cx = 60
  const cy = 60
  const circumference = 2 * Math.PI * radius
  const compliantArc = (compliance / 100) * circumference

  const ringColor =
    compliance >= 95 ? '#22c55e' : compliance >= 80 ? '#f59e0b' : '#ef4444'

  const isHealthy = compliance >= 95

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg
          width={120}
          height={120}
          viewBox="0 0 120 120"
          aria-label={`SLA Compliance: ${compliance}%`}
        >
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="11"
          />
          {/* Compliance arc — starts at top (rotated -90°) */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="11"
            strokeDasharray={`${compliantArc} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {/* Percentage */}
          <text
            x={cx}
            y={cy - 5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="20"
            fontWeight="700"
            fill="#111827"
            fontFamily="system-ui, sans-serif"
          >
            {compliance}%
          </text>
          {/* Label */}
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontSize="8.5"
            fill="#9ca3af"
            fontFamily="system-ui, sans-serif"
          >
            SLA Compliance
          </text>
        </svg>

        {/* Pulse ring on breach */}
        {slaBreaching > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[90px] h-[90px] rounded-full border-2 border-red-400 animate-ping opacity-20" />
          </div>
        )}
      </div>

      {slaBreaching > 0 ? (
        <div className="mt-2 px-2.5 py-0.5 bg-amber-50 border border-amber-200 rounded-full">
          <span className="text-xs font-medium text-amber-700">
            {slaBreaching} ticket{slaBreaching !== 1 ? 's' : ''} at risk
          </span>
        </div>
      ) : (
        <p className={`mt-2 text-xs font-medium ${isHealthy ? 'text-green-600' : 'text-amber-600'}`}>
          {isHealthy ? 'On track' : 'Needs attention'}
        </p>
      )}
    </div>
  )
}
