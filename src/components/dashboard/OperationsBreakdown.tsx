interface CategoryEntry {
  name:   string
  open:   number
  closed: number
}

interface OperationsEntry {
  name:       string
  open:       number
  closed:     number
  categories?: CategoryEntry[]
}

interface Props {
  rows:      OperationsEntry[]
  emptyMsg?: string
}

function Bar({ open, closed, maxTotal }: { open: number; closed: number; maxTotal: number }) {
  const openPct   = Math.round((open   / maxTotal) * 100)
  const closedPct = Math.round((closed / maxTotal) * 100)
  return (
    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex gap-px">
      {open > 0 && (
        <div
          className="h-full bg-amber-400 rounded-l-full transition-all"
          style={{ width: `${Math.max(openPct, 2)}%` }}
        />
      )}
      {closed > 0 && (
        <div
          className="h-full bg-[#083D20] rounded-r-full transition-all"
          style={{ width: `${Math.max(closedPct, 2)}%` }}
        />
      )}
    </div>
  )
}

export function OperationsBreakdown({ rows, emptyMsg = 'Sin datos' }: Props) {
  const sorted = [...rows].sort((a, b) => (b.open + b.closed) - (a.open + a.closed))

  if (sorted.length === 0 || sorted.every(r => r.open + r.closed === 0)) {
    return <p className="text-sm text-gray-400">{emptyMsg}</p>
  }

  const maxTotal = Math.max(...sorted.map(r => r.open + r.closed), 1)

  return (
    <div className="space-y-4">
      {sorted.map(row => {
        const total = row.open + row.closed
        if (total === 0) return null

        const cats = (row.categories ?? []).filter(c => c.open + c.closed > 0)
          .sort((a, b) => (b.open + b.closed) - (a.open + a.closed))

        return (
          <div key={row.name}>
            {/* Bank header */}
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">{row.name}</span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                {row.open   > 0 && <span className="text-xs text-amber-600 tabular-nums">{row.open} pend.</span>}
                {row.closed > 0 && <span className="text-xs text-green-700 tabular-nums">{row.closed} resuel.</span>}
              </div>
            </div>
            <Bar open={row.open} closed={row.closed} maxTotal={maxTotal} />

            {/* Category sub-rows */}
            {cats.length > 0 && (
              <div className="mt-2 ml-3 space-y-1.5 border-l-2 border-gray-100 pl-3">
                {cats.map(cat => (
                  <div key={cat.name}>
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-xs text-gray-500 truncate max-w-[65%]">{cat.name}</span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {cat.open   > 0 && <span className="text-[11px] text-amber-500 tabular-nums">{cat.open} pend.</span>}
                        {cat.closed > 0 && <span className="text-[11px] text-green-600 tabular-nums">{cat.closed} resuel.</span>}
                      </div>
                    </div>
                    <Bar open={cat.open} closed={cat.closed} maxTotal={maxTotal} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-xs text-gray-400">Pendientes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#083D20]" />
          <span className="text-xs text-gray-400">Resueltas</span>
        </div>
      </div>
    </div>
  )
}
