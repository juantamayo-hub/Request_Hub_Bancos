interface WaterfallStage {
  label:        string
  count:        number
  rateFromBS:   number
  rateFromPrev: number
}

interface Props {
  stages: WaterfallStage[]
}

export function FunnelWaterfall({ stages }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] flex items-center py-6 px-5">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center flex-1 min-w-0">

            {/* Stage box */}
            <div
              className={`flex-1 min-w-[100px] text-center px-3 py-3 rounded-lg ${
                i === 0 || i === stages.length - 1 ? 'bg-gray-50' : ''
              }`}
            >
              <p className="text-xs text-gray-500 font-medium truncate mb-1">{stage.label}</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900">{stage.count}</p>
              <p className="text-xs text-gray-400 mt-1">{stage.rateFromBS}% BS</p>
            </div>

            {/* Connector (not after last stage) */}
            {i < stages.length - 1 && (
              <div className="flex flex-col items-center px-1 text-center min-w-[44px] flex-shrink-0">
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {stages[i + 1].rateFromPrev}%
                </span>
                <span className="text-gray-300">→</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
