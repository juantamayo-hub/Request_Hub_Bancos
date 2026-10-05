'use client'

import { usePathname } from 'next/navigation'
import AlmaChat from './AlmaChat'
import AlmaBoundary from './AlmaBoundary'

const HIDDEN_ON = ['/login', '/auth', '/unauthorized']

/** Monta el chat de Alma en todas las páginas con sesión (no en login). */
export function AlmaWidget({ envLabel }: { envLabel?: string }) {
  const pathname = usePathname() ?? ''
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null
  return (
    <AlmaBoundary>
      <AlmaChat apiBase="/api/alma" envLabel={envLabel} />
    </AlmaBoundary>
  )
}
