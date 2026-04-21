import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateDeal } from '@/lib/pipedrive'

/**
 * POST /api/admin/backfill-client-names
 * Admin-only. Iterates all tickets with a pipedrive_deal_id and null client_name,
 * fetches the deal from Pipedrive, and updates the ticket with person_id.name.
 *
 * Usage:
 *   curl -X POST https://your-domain.com/api/admin/backfill-client-names
 */
export async function POST(request: NextRequest) {
  // Auth — admin only
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Se requieren permisos de administrador' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch all tickets that have a deal ID but no client_name yet
  const { data: tickets, error: fetchErr } = await admin
    .from('tickets')
    .select('id, pipedrive_deal_id')
    .not('pipedrive_deal_id', 'is', null)
    .is('client_name', null)

  if (fetchErr) {
    return NextResponse.json({ error: 'Error al obtener tickets', detail: fetchErr.message }, { status: 500 })
  }

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ message: 'No hay tickets pendientes de actualizar', updated: 0 })
  }

  let updated = 0
  let skipped = 0
  const errors: { ticketId: string; dealId: number; error: string }[] = []

  for (const ticket of tickets) {
    const dealId = ticket.pipedrive_deal_id as number
    try {
      const deal = await validateDeal(dealId)
      if (!deal.clientName) {
        skipped++
        continue
      }

      const { error: updateErr } = await admin
        .from('tickets')
        .update({ client_name: deal.clientName })
        .eq('id', ticket.id)

      if (updateErr) {
        errors.push({ ticketId: ticket.id, dealId, error: updateErr.message })
      } else {
        updated++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      errors.push({ ticketId: ticket.id, dealId, error: msg })
    }

    // Small delay to avoid Pipedrive rate limits (10 req/s)
    await new Promise(r => setTimeout(r, 120))
  }

  return NextResponse.json({
    message: `Backfill completado. ${updated} tickets actualizados, ${skipped} sin contacto en Pipedrive, ${errors.length} errores.`,
    total:   tickets.length,
    updated,
    skipped,
    errors,
  })
}
