import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: { default: 'Request Hub · Bancos', template: '%s | Request Hub Bancos' },
  description: 'Plataforma de gestión de solicitudes bancarias',
  icons: {
    icon: '/logo-bayteca.svg',
    apple: '/logo-bayteca.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
