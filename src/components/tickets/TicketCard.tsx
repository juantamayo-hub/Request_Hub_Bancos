import Link from 'next/link'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { formatDateShort, isSlaBreaching } from '@/lib/utils'
import type { TicketWithRelations } from '@/lib/database.types'

interface Props {
  ticket:  TicketWithRelations
  isAdmin?: boolean
}

export function TicketCard({ ticket: t, isAdmin = false }: Props) {
  const href = isAdmin ? `/admin/tickets/${t.id}` : `/tickets/${t.id}`

  return (
    <Link
      href={href}
      className="card block p-4 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{t.display_id}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{t.categories.name}</span>
            {isSlaBreaching(t.sla_deadline) && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                SLA
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700 truncate">
            {t.subject}
          </p>

          {isAdmin && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {t.profiles.email}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={t.priority} />
          <StatusBadge status={t.status} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        <span>{formatDateShort(t.created_at)}</span>
        {t.assignee && (
          <span className="truncate ml-2">
            → {t.assignee.first_name ?? t.assignee.email}
          </span>
        )}
      </div>
    </Link>
  )
}
