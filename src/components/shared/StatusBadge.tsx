import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS } from '@/lib/constants'
import { TICKET_STATUSES } from '@/lib/constants'
import type { TicketStatus } from '@/lib/database.types'

interface Props {
  status: TicketStatus
}

export function StatusBadge({ status }: Props) {
  const label = TICKET_STATUSES.find(s => s.value === status)?.label ?? status
  return (
    <Badge className={STATUS_COLORS[status]}>
      {label}
    </Badge>
  )
}
