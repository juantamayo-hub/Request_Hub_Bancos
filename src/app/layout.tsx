import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { PromoBanner } from '@/components/shared/PromoBanner'
import { AlmaWidget } from '@/components/alma/AlmaWidget'
import { almaVisibleForCurrentUser } from '@/lib/alma'

export const metadata: Metadata = {
  title: { default: 'Request Hub · Bancos', template: '%s | Request Hub Bancos' },
  description: 'Plataforma de gestión de solicitudes bancarias',
  icons: {
    icon: '/logo-bayteca.svg',
    apple: '/logo-bayteca.svg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Alma (chat): solo si está activada en este entorno y el usuario está permitido (staging hasta su aprobación)
  const showAlma = await almaVisibleForCurrentUser()
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <PromoBanner />
        {showAlma && <AlmaWidget envLabel={process.env.ALMA_ENV === 'production' ? undefined : 'staging'} />}
      </body>
    </html>
  )
}
