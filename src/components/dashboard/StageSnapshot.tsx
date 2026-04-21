interface StageCount {
  stageId:   number
  label:     string
  openCount: number
  lostCount: number
}

interface Props {
  stages: StageCount[]
}

export function StageSnapshot({ stages }: Props) {
  const totalOpen = stages.reduce((s, st) => s + st.openCount, 0)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] flex gap-3 py-6 px-5">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className="flex-1 min-w-[110px] bg-gray-50 rounded-lg px-3 py-3 text-center"
          >
            <p className="text-xs text-gray-500 font-medium truncate mb-1">{stage.label}</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{stage.openCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">en proceso</p>
            {stage.lostCount > 0 && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{stage.lostCount} perdidos</p>
            )}
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {totalOpen} deals abiertos actualmente en el pipeline · Bayteca Bank Area
        </p>
      </div>
    </div>
  )
}
