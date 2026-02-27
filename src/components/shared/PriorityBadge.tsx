import { Badge } from '@/components/ui/badge'
import { PRIORITY_COLORS, TICKET_PRIORITIES } from '@/lib/constants'
import type { TicketPriority } from '@/lib/database.types'

interface Props {
  priority: TicketPriority
}

export function PriorityBadge({ priority }: Props) {
  const label = TICKET_PRIORITIES.find(p => p.value === priority)?.label ?? priority
  return (
    <Badge className={PRIORITY_COLORS[priority]}>
      {label}
    </Badge>
  )
}
