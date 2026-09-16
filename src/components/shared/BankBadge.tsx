import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Maps bank names to their logo file in /public/banks/.
 * Logo files are 128×128 PNGs.
 */
const BANK_LOGO: Record<string, string> = {
  'Santander':      '/banks/santander.png',
  'Unicaja':        '/banks/unicaja.png',
  'CR Teruel':      '/banks/cr-teruel.png',
  'CR Granada':     '/banks/cr-granada.png',
  'Laboral Kutxa':  '/banks/laboral-kutxa.png',
  'EuroCajaRural':  '/banks/eurocajarural.png',
  'ING':            '/banks/ing.png',
  'CR Extremadura': '/banks/cr-extremadura.png',
  'CR Asturias':    '/banks/cr-asturias.png',
  'Deutsche Bank':  '/banks/deutsche-bank.png',
  'UCI':            '/banks/uci.png',
  'MyInvestor':     '/banks/myinvestor.png',
  'CR del Sur':     '/banks/cr-del-sur.png',
  'Globalcaja':     '/banks/globalcaja.png',
  'Ibercaja':       '/banks/ibercaja.png',
  'No Bank Fee':    '/banks/no-bank-fee.png',
  'Caixa Popular':  '/banks/caixa-popular.png',
  'Ruralnostra':    '/banks/ruralnostra.png',
  'Kutxabank':      '/banks/kutxabank.png',
  'Sabadell':       '/banks/sabadell.png',
  'BBVA':           '/banks/bbva.png',
  'CaixaBank':      '/banks/caixabank.png',
  'Bankinter':      '/banks/bankinter.png',
  'Abanca':         '/banks/abanca.png',
  'Openbank':       '/banks/openbank.png',
  'Cajamar':        '/banks/cajamar.png',
  'EVO Banco':      '/banks/evo-banco.png',
  'Liberbank':      '/banks/liberbank.png',
  'Pibank':         '/banks/pibank.png',
  'Targobank':      '/banks/targobank.png',
  'WiZink':         '/banks/wizink.png',
}

function getLogo(bankName: string): string | null {
  if (BANK_LOGO[bankName]) return BANK_LOGO[bankName]
  const key = Object.keys(BANK_LOGO).find(k => k.toLowerCase() === bankName.toLowerCase())
  return key ? BANK_LOGO[key] : null
}

interface Props {
  bankName: string | null | undefined
  /** 'chip' = logo + name pill, 'icon' = logo circle only */
  variant?: 'chip' | 'icon'
  className?: string
}

export function BankBadge({ bankName, variant = 'chip', className }: Props) {
  if (!bankName) return null
  const logo = getLogo(bankName)

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
      <div
        className={cn(
          'w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0',
          className,
        )}
        title={bankName}
      >
        {bankName.slice(0, 2).toUpperCase()}
      </div>
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
        <span className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] font-bold text-gray-600">
          {bankName.slice(0, 2).toUpperCase()}
        </span>
      )}
      {bankName}
    </span>
  )
}
