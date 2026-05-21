import type { TicketStatus, TicketPriority } from './database.types'

export const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? 'huspy.io'
export const ALLOWED_DOMAINS = ['huspy.io', 'bayteca.com']

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'new',                 label: 'Nuevo' },
  { value: 'in_progress',         label: 'Proceso / Trámite' },
  { value: 'waiting_on_employee', label: 'Esperando banco' },
  { value: 'resolved',            label: 'Cancelado' },
  { value: 'closed',              label: 'Solucionado' },
]

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low',    label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high',   label: 'Alta' },
]

export const STATUS_COLORS: Record<TicketStatus, string> = {
  new:                 'bg-blue-100 text-blue-700',
  in_progress:         'bg-violet-100 text-violet-700',
  waiting_on_employee: 'bg-amber-100 text-amber-700',
  resolved:            'bg-rose-100 text-rose-600',   // "Cancelado" — user cancellation
  closed:              'bg-slate-100 text-slate-500',
}


export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:    'bg-emerald-50 text-emerald-600',
  medium: 'bg-sky-100 text-sky-700',
  high:   'bg-red-100 text-red-600',
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
