import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/tickets/[id]/snooze
 * Sets ticket to "closed" with a snooze_until date.
 * The cron job will reopen it when the date passes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  let body: { snooze_until?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { snooze_until } = body
  if (!snooze_until) {
    return NextResponse.json({ error: 'snooze_until es obligatorio' }, { status: 400 })
  }

  const snoozeDate = new Date(snooze_until)
  if (isNaN(snoozeDate.getTime())) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 20)

  if (snoozeDate < tomorrow) {
    return NextResponse.json({ error: 'La fecha de posponer debe ser mínimo mañana' }, { status: 400 })
  }
  if (snoozeDate > maxDate) {
    return NextResponse.json({ error: 'La fecha de posponer no puede ser más de 20 días' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the ticket — RLS ensures the user can only see their own or admin sees all
  const { data: ticket, error: fetchErr } = await supabase
    .from('tickets')
    .select('id, display_id, status, created_by')
    .eq('id', id)
    .single()

  if (fetchErr || !ticket) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }

  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    return NextResponse.json({ error: 'No se puede posponer un ticket cerrado o resuelto' }, { status: 400 })
  }

  // Apply snooze
  const { error: updateErr } = await admin
    .from('tickets')
    .update({
      status:                 'closed',
      snoozed_until:          snoozeDate.toISOString(),
      snooze_previous_status: ticket.status,
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[snooze] update error:', updateErr)
    return NextResponse.json({ error: 'Error al posponer la solicitud' }, { status: 500 })
  }

  const displayDate = snoozeDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  await Promise.all([
    admin.from('audit_log').insert({
      ticket_id:  id,
      actor_id:   profile.id,
      action:     'status_changed',
      from_value: ticket.status,
      to_value:   'closed',
      metadata:   { snoozed_until: snoozeDate.toISOString() },
    }),
    admin.from('ticket_status_history').insert({
      ticket_id:  id,
      status:     'closed',
      changed_by: profile.id,
    }),
    admin.from('ticket_comments').insert({
      ticket_id:  id,
      author_id:  profile.id,
      body:       `Ticket pospuesto hasta ${displayDate}.`,
      visibility: 'internal',
    }),
  ])

  return NextResponse.json({ ok: true })
}
