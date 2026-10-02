'use client'

import { usePathname } from 'next/navigation'
import AlmaChat from './AlmaChat'

const HIDDEN_ON = ['/login', '/auth', '/unauthorized']

/** Monta el chat de Alma en todas las páginas con sesión (no en login). */
export function AlmaWidget({ envLabel }: { envLabel?: string }) {
  const pathname = usePathname() ?? ''
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null
  return <AlmaChat apiBase="/api/alma" envLabel={envLabel} />
}
