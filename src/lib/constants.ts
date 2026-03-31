import type { TicketStatus, TicketPriority } from './database.types'

export const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? 'huspy.io'
export const ALLOWED_DOMAINS = ['huspy.io', 'bayteca.com']

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'new',                 label: 'Nuevo' },
  { value: 'in_progress',         label: 'En Proceso' },
  { value: 'waiting_on_employee', label: 'Esperando' },
  { value: 'resolved',            label: 'Cancelado' },
  { value: 'closed',              label: 'Cerrado' },
]

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low',    label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high',   label: 'Alta' },
]

export const STATUS_COLORS: Record<TicketStatus, string> = {
  new:                 'bg-[#DBEAFE] text-[#1E3A8A]',
  in_progress:         'bg-[#FEF9C3] text-[#713F12]',
  waiting_on_employee: 'bg-[#FFEDD5] text-[#9A3412]',
  resolved:            'bg-red-100 text-red-700',
  closed:              'bg-[#F3F4F6] text-[#6B7280]',
}

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-red-100 text-red-700',
}

export const OPEN_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting_on_employee']
export const CLOSED_STATUSES: TicketStatus[] = ['resolved', 'closed']

export const SLA_WARNING_HOURS = 4  // Show warning when < 4h remaining

export const BANK_LIST = [
  'Santander',
  'Unicaja',
  'CR Teruel',
  'CR Granada',
  'Laboral Kutxa',
  'EuroCajaRural',
  'ING',
  'CR Extremadura',
  'CR Asturias',
  'Deutsche Bank',
  'UCI',
  'MyInvestor',
  'CR del Sur',
  'Globalcaja',
  'Ibercaja',
  'No Bank Fee',
  'Caixa Popular',
  'Ruralnostra',
] as const

export type BankName = typeof BANK_LIST[number]
