interface CategoryCount {
  categoryId: string
  name:       string
  count:      number
}

interface Props {
  ticketsByCategory: CategoryCount[]
}

export function CategoryWorkload({ ticketsByCategory }: Props) {
  const sorted = [...ticketsByCategory].sort((a, b) => b.count - a.count)
  const max = sorted[0]?.count || 1

  if (sorted.every(c => c.count === 0)) {
    return <p className="text-sm text-gray-400">No open tickets</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map(cat => {
        const pct = Math.round((cat.count / max) * 100)
        const barWidth = `${Math.max(pct, cat.count > 0 ? 3 : 0)}%`

        return (
          <div key={cat.categoryId}>
            {/* Label row */}
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
              <span className="text-sm tabular-nums text-gray-500 ml-2 shrink-0">{cat.count}</span>
            </div>
            {/* Bar */}
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{ width: barWidth }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
