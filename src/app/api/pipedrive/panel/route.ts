import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { TICKET_STATUSES } from '@/lib/constants'
import type { TicketStatus } from '@/lib/database.types'

/**
 * GET /api/pipedrive/panel
 *
 * Data source for the "Request Hub Bancos" JSON panel shown in the
 * Pipedrive deal sidebar. Pipedrive calls it server-to-server with
 * ?selectedIds=<dealId>&companyId=...&token=<JWT>.
 *
 * Security:
 * - The JWT must be signed (HS256) with the app's JWT secret
 *   (PIPEDRIVE_JWT_SECRET, defaults to PIPEDRIVE_CLIENT_SECRET as in Pipedrive).
 * - Only our Pipedrive company may read data (the private app link could be
 *   installed by other companies).
 * - Returns only ticket metadata for that single deal (no descriptions/comments).
 */

const ALLOWED_PIPEDRIVE_COMPANY_ID = 1701372 // Mortgage Direct SL (mdsl.pipedrive.com)
const MAX_PANEL_OBJECTS = 10                  // Pipedrive JSON panel limit

const STATUS_COLOR: Record<TicketStatus, string> = {
  new:                 'blue',
  in_progress:         'purple',
  waiting_on_employee: 'yellow',
  resolved:            'grey',   // Cancelado
  closed:              'green',  // Solucionado
}
const OPEN_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting_on_employee']

function verifyPipedriveJwt(token: string, secret: string): Record<string, unknown> | null {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  const given    = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString())
    if (head.alg !== 'HS256') return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null
    return claims
  } catch {
    return null
  }
}

/** Pipedrive date-time format: YYYY-MM-DDThh:mm:ssZ (no milliseconds) */
function toPipedriveDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const secret = process.env.PIPEDRIVE_JWT_SECRET || process.env.PIPEDRIVE_CLIENT_SECRET
  if (!secret) {
    console.error('[pipedrive/panel] Missing PIPEDRIVE_CLIENT_SECRET')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const token  = searchParams.get('token') ?? bearer ?? ''
  const claims = verifyPipedriveJwt(token, secret)
  if (!claims || Number(claims.companyId) !== ALLOWED_PIPEDRIVE_COMPANY_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawDealId = (searchParams.get('selectedIds') ?? '').split(',')[0].trim()
  if (!/^\d+$/.test(rawDealId)) {
    return NextResponse.json({ error: 'Invalid deal' }, { status: 400 })
  }
  const dealId = parseInt(rawDealId, 10)

  const admin = createAdminClient()
  const { data: tickets, error } = await admin
    .from('tickets')
    .select('id, display_id, status, created_at, categories(name), assignee:profiles!tickets_assignee_id_fkey(first_name, last_name, email)')
    .eq('pipedrive_deal_id', dealId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[pipedrive/panel] query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // Open tickets first, then most recent
  const sorted = [...(tickets ?? [])].sort((a, b) =>
    Number(OPEN_STATUSES.includes(b.status as TicketStatus)) - Number(OPEN_STATUSES.includes(a.status as TicketStatus)),
  )

  const data = sorted.slice(0, MAX_PANEL_OBJECTS).map((t, i) => {
    const status   = t.status as TicketStatus
    const category = (t.categories as unknown as { name: string } | null)?.name ?? '—'
    const assignee = t.assignee as unknown as { first_name: string | null; last_name: string | null; email: string } | null
    const assigneeName = assignee
      ? [assignee.first_name, assignee.last_name].filter(Boolean).join(' ') || assignee.email
      : 'Sin asignar'

    return {
      id:          i + 1,
      header:      t.display_id,
      categoria:   category,
      estado:      { color: STATUS_COLOR[status] ?? 'grey', label: TICKET_STATUSES.find(s => s.value === status)?.label ?? status },
      responsable: assigneeName,
      creado:      toPipedriveDateTime(t.created_at),
      enlace:      { markdown: true, value: `[Ver en Request Hub](${origin}/tickets/${t.id})` },
    }
  })

  return NextResponse.json({
    data,
    external_link: {
      url:   `${origin}/tickets/new?dealId=${dealId}`,
      label: 'Abrir ticket bancario',
    },
  })
}
