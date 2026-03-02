import Link from 'next/link'
import type { AtRiskTicket } from '@/lib/database.types'

interface Props {
  tickets: AtRiskTicket[]
}

function formatTimeStatus(deadline: string, status: 'breaching' | 'at-risk') {
  const diffMs = new Date(deadline).getTime() - Date.now()
  if (status === 'breaching') {
    const overMs = Math.abs(diffMs)
    const overH = Math.floor(overMs / (1000 * 60 * 60))
    const overM = Math.floor((overMs % (1000 * 60 * 60)) / (1000 * 60))
    if (overH > 0) return `Overdue ${overH}h`
    return `Overdue ${overM}m`
  }
  const h = Math.floor(diffMs / (1000 * 60 * 60))
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (h > 0) return `Due in ${h}h`
  return `Due in ${m}m`
}

export function AtRiskTicketList({ tickets }: Props) {
  if (tickets.length === 0) {
    return (
      <p className="text-sm text-green-600 font-medium py-1">
        ✓ No SLA risks right now
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {tickets.map(t => {
        const isBreaching = t.status === 'breaching'
        const rowBg = isBreaching
          ? 'bg-red-50 hover:bg-red-100/60'
          : 'bg-amber-50 hover:bg-amber-100/60'
        const timeBadge = isBreaching
          ? 'text-red-700 bg-red-100'
          : 'text-amber-700 bg-amber-100'

        return (
          <Link
            key={t.id}
            href={`/admin/tickets/${t.id}`}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${rowBg}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-gray-400 shrink-0">
                  {t.displayId}
                </span>
                <span className="text-xs text-gray-500 shrink-0">{t.category}</span>
              </div>
              <p className="text-xs text-gray-700 mt-0.5 truncate">{t.subject}</p>
            </div>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${timeBadge}`}
            >
              {formatTimeStatus(t.deadline, t.status)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
