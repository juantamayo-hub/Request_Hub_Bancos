import { cn } from '@/lib/utils'

/**
 * Brand colors and short labels for each bank.
 * bg = background class, text = text class, short = 2-3 char abbreviation
 */
const BANK_META: Record<string, { bg: string; text: string; short: string }> = {
  'Santander':      { bg: 'bg-red-600',     text: 'text-white',    short: 'SAN' },
  'Unicaja':        { bg: 'bg-green-700',    text: 'text-white',    short: 'UNI' },
  'CR Teruel':      { bg: 'bg-emerald-700',  text: 'text-white',    short: 'CRT' },
  'CR Granada':     { bg: 'bg-emerald-600',  text: 'text-white',    short: 'CRG' },
  'Laboral Kutxa':  { bg: 'bg-orange-500',   text: 'text-white',    short: 'LK' },
  'EuroCajaRural':  { bg: 'bg-blue-800',     text: 'text-white',    short: 'ECR' },
  'ING':            { bg: 'bg-orange-600',    text: 'text-white',    short: 'ING' },
  'CR Extremadura': { bg: 'bg-teal-700',     text: 'text-white',    short: 'CRE' },
  'CR Asturias':    { bg: 'bg-teal-600',     text: 'text-white',    short: 'CRA' },
  'Deutsche Bank':  { bg: 'bg-blue-900',     text: 'text-white',    short: 'DB' },
  'UCI':            { bg: 'bg-indigo-700',   text: 'text-white',    short: 'UCI' },
  'MyInvestor':     { bg: 'bg-cyan-600',     text: 'text-white',    short: 'MYI' },
  'CR del Sur':     { bg: 'bg-lime-700',     text: 'text-white',    short: 'CRS' },
  'Globalcaja':     { bg: 'bg-yellow-600',   text: 'text-white',    short: 'GLO' },
  'Ibercaja':       { bg: 'bg-purple-700',   text: 'text-white',    short: 'IBC' },
  'No Bank Fee':    { bg: 'bg-gray-500',     text: 'text-white',    short: 'NBF' },
  'Caixa Popular':  { bg: 'bg-sky-700',      text: 'text-white',    short: 'CP' },
  'Ruralnostra':    { bg: 'bg-amber-700',    text: 'text-white',    short: 'RN' },
}

const FALLBACK = { bg: 'bg-gray-400', text: 'text-white', short: '?' }

interface Props {
  bankName: string | null | undefined
  /** 'chip' = small inline pill, 'icon' = compact circle */
  variant?: 'chip' | 'icon'
  className?: string
}

export function BankBadge({ bankName, variant = 'chip', className }: Props) {
  if (!bankName) return null
  const meta = BANK_META[bankName] ?? FALLBACK

  if (variant === 'icon') {
    return (
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 leading-none',
          meta.bg,
          meta.text,
          className,
        )}
        title={bankName}
      >
        {meta.short.slice(0, 2)}
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <span className="font-bold text-[10px] opacity-80">{meta.short}</span>
      <span className="hidden sm:inline">{bankName}</span>
    </span>
  )
}
