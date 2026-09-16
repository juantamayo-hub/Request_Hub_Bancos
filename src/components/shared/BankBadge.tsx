import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Banks with a real PNG favicon in /public/banks/ */
const BANK_LOGO: Record<string, string> = {
  'Santander':      '/banks/santander.png',
  'Unicaja':        '/banks/unicaja.png',
  'CR Teruel':      '/banks/cr-teruel.png',
  'CR Granada':     '/banks/cr-granada.png',
  'ING':            '/banks/ing.png',
  'Deutsche Bank':  '/banks/deutsche-bank.png',
  'UCI':            '/banks/uci.png',
  'MyInvestor':     '/banks/myinvestor.png',
  'Globalcaja':     '/banks/globalcaja.png',
  'Ibercaja':       '/banks/ibercaja.png',
  'No Bank Fee':    '/banks/no-bank-fee.png',
  'Ruralnostra':    '/banks/ruralnostra.png',
  'Sabadell':       '/banks/sabadell.png',
  'BBVA':           '/banks/bbva.png',
  'CaixaBank':      '/banks/caixabank.png',
  'Bankinter':      '/banks/bankinter.png',
  'Abanca':         '/banks/abanca.png',
  'Openbank':       '/banks/openbank.png',
  'Cajamar':        '/banks/cajamar.png',
  'Liberbank':      '/banks/liberbank.png',
  'Pibank':         '/banks/pibank.png',
  'Targobank':      '/banks/targobank.png',
}

/** Brand color + abbreviation for banks without a downloadable logo */
const BANK_BRAND: Record<string, { bg: string; short: string }> = {
  'Kutxabank':      { bg: '#003DA5', short: 'KTX' },
  'EVO Banco':      { bg: '#00A3E0', short: 'EVO' },
  'EuroCajaRural':  { bg: '#006633', short: 'ECR' },
  'CR Asturias':    { bg: '#004B28', short: 'CRA' },
  'CR del Sur':     { bg: '#1B5E20', short: 'CRS' },
  'CR Extremadura': { bg: '#2E7D32', short: 'CRE' },
  'CR Aragón':      { bg: '#388E3C', short: 'CRA' },
  'Laboral Kutxa':  { bg: '#E65100', short: 'LK' },
  'Caixa Popular':  { bg: '#0277BD', short: 'CP' },
  'WiZink':         { bg: '#FF6F00', short: 'WIZ' },
}

function lookup<T>(map: Record<string, T>, bankName: string): T | null {
  if (map[bankName]) return map[bankName]
  const key = Object.keys(map).find(k => k.toLowerCase() === bankName.toLowerCase())
  return key ? map[key] : null
}

function autoShort(name: string): string {
  const words = name.split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

interface Props {
  bankName: string | null | undefined
  /** 'chip' = logo + name pill, 'icon' = logo circle only */
  variant?: 'chip' | 'icon'
  className?: string
}

/** Inline colored circle for banks without a PNG logo */
function BrandCircle({ bankName, size }: { bankName: string; size: 'sm' | 'md' }) {
  const brand = lookup(BANK_BRAND, bankName)
  const bg = brand?.bg ?? '#6B7280'
  const short = brand?.short ?? autoShort(bankName)
  const px = size === 'sm' ? 'w-4 h-4 text-[7px]' : 'w-6 h-6 text-[9px]'

  return (
    <span
      className={`${px} rounded-full flex items-center justify-center font-bold text-white shrink-0 leading-none`}
      style={{ backgroundColor: bg }}
      title={bankName}
    >
      {short.slice(0, size === 'sm' ? 2 : 3)}
    </span>
  )
}

export function BankBadge({ bankName, variant = 'chip', className }: Props) {
  if (!bankName) return null
  const logo = lookup(BANK_LOGO, bankName)

  if (variant === 'icon') {
    return logo ? (
      <Image
        src={logo}
        alt={bankName}
        width={24}
        height={24}
        className={cn('w-6 h-6 rounded-full object-contain bg-white shrink-0', className)}
      />
    ) : (
      <BrandCircle bankName={bankName} size="md" />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium pl-1 pr-2 py-0.5 rounded-full bg-gray-100 text-gray-700',
        className,
      )}
    >
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={16}
          height={16}
          className="w-4 h-4 rounded-full object-contain"
        />
      ) : (
        <BrandCircle bankName={bankName} size="sm" />
      )}
      {bankName}
    </span>
  )
}
