import type { TicketStatus, TicketPriority } from './database.types'

export const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? 'huspy.io'

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'new',                 label: 'New' },
  { value: 'in_progress',         label: 'In Progress' },
  { value: 'waiting_on_employee', label: 'Waiting on Employee' },
  { value: 'resolved',            label: 'Resolved' },
  { value: 'closed',              label: 'Closed' },
]

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

export const STATUS_COLORS: Record<TicketStatus, string> = {
  new:                 'bg-blue-100 text-blue-800',
  in_progress:         'bg-yellow-100 text-yellow-800',
  waiting_on_employee: 'bg-orange-100 text-orange-800',
  resolved:            'bg-green-100 text-green-800',
  closed:              'bg-gray-100 text-gray-600',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-red-100 text-red-700',
}

export const OPEN_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting_on_employee']
export const CLOSED_STATUSES: TicketStatus[] = ['resolved', 'closed']

export const SLA_WARNING_HOURS = 4  // Show warning when < 4h remaining
