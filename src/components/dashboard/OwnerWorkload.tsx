export interface OwnerEntry {
  name:            string
  new:             number
  in_progress:     number
  waiting:         number
  resolved_closed: number
}

export function OwnerWorkload({ rows, emptyMsg = 'Sin datos' }: { rows: OwnerEntry[]; emptyMsg?: string }) {
  const sorted = [...rows]
    .map(r => ({ ...r, total: r.new + r.in_progress + r.waiting + r.resolved_closed }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  if (sorted.length === 0) return <p className="text-sm text-gray-400">{emptyMsg}</p>

  const maxTotal = Math.max(...sorted.map(r => r.total))

  return (
    <div className="space-y-4">
      {sorted.map(row => {
        const active = row.new + row.in_progress + row.waiting
        return (
          <div key={row.name}>
            {/* Header */}
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[55%]">{row.name}</span>
              <div className="flex items-center gap-3 text-xs shrink-0 ml-2">
                {active > 0 && (
                  <span className="text-amber-600 tabular-nums">{active} activo{active !== 1 ? 's' : ''}</span>
                )}
                {row.resolved_closed > 0 && (
                  <span className="text-green-700 tabular-nums">{row.resolved_closed} cerrado{row.resolved_closed !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            {/* Stacked bar */}
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex gap-px">
              {row.new > 0 && (
                <div
                  className="h-full bg-blue-400 transition-all"
                  style={{ width: `${Math.max((row.new / maxTotal) * 100, 2)}%` }}
                />
              )}
              {row.in_progress > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${Math.max((row.in_progress / maxTotal) * 100, 2)}%` }}
                />
              )}
              {row.waiting > 0 && (
                <div
                  className="h-full bg-purple-300 transition-all"
                  style={{ width: `${Math.max((row.waiting / maxTotal) * 100, 2)}%` }}
                />
              )}
              {row.resolved_closed > 0 && (
                <div
                  className="h-full bg-[#083D20] transition-all"
                  style={{ width: `${Math.max((row.resolved_closed / maxTotal) * 100, 2)}%` }}
                />
              )}
            </div>

            {/* Status breakdown */}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {row.new > 0 && (
                <span className="text-[11px] text-blue-500 tabular-nums">{row.new} nuevo{row.new !== 1 ? 's' : ''}</span>
              )}
              {row.in_progress > 0 && (
                <span className="text-[11px] text-amber-500 tabular-nums">{row.in_progress} en proceso</span>
              )}
              {row.waiting > 0 && (
                <span className="text-[11px] text-purple-400 tabular-nums">{row.waiting} esperando</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
          <span className="text-xs text-gray-400">Nuevo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-xs text-gray-400">En proceso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-purple-300" />
          <span className="text-xs text-gray-400">Esperando</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#083D20]" />
          <span className="text-xs text-gray-400">Resuelto / Cerrado</span>
        </div>
      </div>
    </div>
  )
}
