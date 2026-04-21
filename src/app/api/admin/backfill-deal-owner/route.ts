import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN!
const BASE_URL = 'https://api.pipedrive.com/v1'

/**
 * POST /api/admin/backfill-deal-owner
 * Admin-only. Finds tickets with "Responsable en Pipedrive: Sin asignar" in the
 * description, fetches the deal from Pipedrive, and replaces it with the real owner name.
 *
 * Usage (browser console while logged in as admin):
 *   fetch('/api/admin/backfill-deal-owner', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */
export async function POST(_request: NextRequest) {
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

  // Find all auto-generated tickets with "Sin asignar" in description that have a deal ID
  const { data: tickets, error: fetchErr } = await admin
    .from('tickets')
    .select('id, pipedrive_deal_id, description')
    .not('pipedrive_deal_id', 'is', null)
    .ilike('description', '%Responsable en Pipedrive: Sin asignar%')

  if (fetchErr) {
    return NextResponse.json({ error: 'Error al obtener tickets', detail: fetchErr.message }, { status: 500 })
  }

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ message: 'No hay tickets con "Sin asignar" pendientes', updated: 0 })
  }

  let updated = 0
  let skipped = 0
  const errors: { ticketId: string; dealId: number; error: string }[] = []

  for (const ticket of tickets) {
    const dealId = ticket.pipedrive_deal_id as number
    try {
      const res = await fetch(`${BASE_URL}/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`, {
        next: { revalidate: 0 },
      })

      if (!res.ok) {
        errors.push({ ticketId: ticket.id, dealId, error: `Pipedrive ${res.status}` })
        continue
      }

      const json = await res.json()
      const ownerName = (json.data?.user_id as { name?: string } | null)?.name ?? null

      if (!ownerName) {
        skipped++
        continue
      }

      const newDescription = (ticket.description as string).replace(
        'Responsable en Pipedrive: Sin asignar',
        `Responsable en Pipedrive: ${ownerName}`,
      )

      const { error: updateErr } = await admin
        .from('tickets')
        .update({ description: newDescription })
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

    // Avoid Pipedrive rate limits
    await new Promise(r => setTimeout(r, 120))
  }

  return NextResponse.json({
    message: `Backfill completado. ${updated} tickets actualizados, ${skipped} sin owner en Pipedrive, ${errors.length} errores.`,
    total:   tickets.length,
    updated,
    skipped,
    errors,
  })
}
