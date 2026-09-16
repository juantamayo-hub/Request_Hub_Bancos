import { TicketCard } from './TicketCard'
import type { TicketWithRelations } from '@/lib/database.types'

interface Props {
  tickets:          TicketWithRelations[]
  isAdmin?:         boolean
  unreadTicketIds?: Set<string>
}

export function TicketList({ tickets, isAdmin = false, unreadTicketIds }: Props) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-10 h-10 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="font-medium">No se encontraron solicitudes</p>
        {!isAdmin && (
          <p className="text-sm mt-1">
            <a href="/tickets/new" className="text-gray-600 underline hover:text-gray-900">
              Crea tu primera solicitud
            </a>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tickets.map(ticket => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          isAdmin={isAdmin}
          hasUnread={unreadTicketIds?.has(ticket.id) ?? false}
        />
      ))}
    </div>
  )
}
