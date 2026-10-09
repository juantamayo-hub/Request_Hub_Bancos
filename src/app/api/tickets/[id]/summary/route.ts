import { NextResponse, type NextRequest } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDealSummary, invalidateDealSummary } from '@/lib/deal-summary'

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

/**
 * GET  /api/tickets/[id]/summary  → resumen IA del deal de Pipedrive del ticket (cacheado)
 * POST /api/tickets/[id]/summary  → descarta la caché y lo regenera
 *
 * Mismo acceso que la página de detalle del ticket: cualquier usuario con sesión.
 */
async function handle(id: string, refresh: boolean) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'El resumen IA no está configurado.' }, { status: 503 })
  }

  const { data: ticket } = await createAdminClient()
    .from('tickets')
    .select('pipedrive_deal_id')
    .eq('id', id)
    .maybeSingle()

  const dealId = (ticket as { pipedrive_deal_id?: number | null } | null)?.pipedrive_deal_id
  if (!dealId) return NextResponse.json({ error: 'El ticket no tiene deal de Pipedrive.' }, { status: 404 })

  try {
    if (refresh) invalidateDealSummary(dealId)
    return NextResponse.json(await getDealSummary(dealId))
  } catch (err) {
    console.error(`[summary] ticket ${id} / deal ${dealId}:`, err)
    return NextResponse.json({ error: 'No se pudo generar el resumen. Inténtalo de nuevo.' }, { status: 502 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle((await params).id, false)
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle((await params).id, true)
}
