/**
 * Alma en Request Hub: el chat vive en el Command Center; aquí solo se valida la sesión y se reenvía.
 *  - ALMA_ENABLED=true             → mostrar Alma (en producción no se define hasta que Juanjo lo apruebe)
 *  - ALMA_ALLOWED_EMAILS=a@x,b@y   → si está definido, solo esos emails (staging)
 *  - ALMA_CC_URL                   → URL del Command Center (p. ej. el dominio de staging)
 *  - ALMA_SHARED_SECRET            → mismo valor que en el Command Center
 */

import { getUser } from '@/lib/auth'

const ALLOWED_DOMAINS = ['huspy.io', 'bayteca.com']

export function almaAllowedFor(email: string | null | undefined): boolean {
  if (process.env.ALMA_ENABLED !== 'true' || !email) return false
  if (!ALLOWED_DOMAINS.includes(email.split('@')[1]?.toLowerCase() ?? '')) return false
  const list = (process.env.ALMA_ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.length === 0 || list.includes(email.toLowerCase())
}

export async function almaVisibleForCurrentUser(): Promise<boolean> {
  try {
    const user = await getUser()
    return almaAllowedFor(user?.email)
  } catch {
    return false
  }
}

/** Reenvía una petición del navegador al Command Center con el email del usuario ya validado. */
export async function forwardToCommandCenter(path: 'chat' | 'report', req: Request): Promise<Response> {
  const user = await getUser().catch(() => null)
  if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!almaAllowedFor(user.email)) return Response.json({ error: 'Not found' }, { status: 404 })

  const base = process.env.ALMA_CC_URL
  const secret = process.env.ALMA_SHARED_SECRET
  if (!base || !secret) return Response.json({ error: 'Alma no está configurada' }, { status: 503 })

  const upstream = await fetch(`${base.replace(/\/$/, '')}/api/alma/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-alma-secret': secret, 'x-alma-user-email': user.email },
    body: await req.text(),
    cache: 'no-store',
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-cache, no-transform' },
  })
}
