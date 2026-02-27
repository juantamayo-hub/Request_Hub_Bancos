import { TicketCard } from './TicketCard'
import type { TicketWithRelations } from '@/lib/database.types'

interface Props {
  tickets:  TicketWithRelations[]
  isAdmin?: boolean
}

export function TicketList({ tickets, isAdmin = false }: Props) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-4">🎟️</p>
        <p className="font-medium">No tickets found</p>
        {!isAdmin && (
          <p className="text-sm mt-1">
            <a href="/tickets/new" className="text-gray-600 underline hover:text-gray-900">
              Open your first ticket
            </a>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tickets.map(ticket => (
        <TicketCard key={ticket.id} ticket={ticket} isAdmin={isAdmin} />
      ))}
    </div>
  )
}
