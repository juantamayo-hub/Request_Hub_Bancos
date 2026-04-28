import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTicketCancelled } from '@/lib/notifications'

/**
 * PATCH /api/tickets/[id]/cancel
 * Allows the ticket creator to cancel their own ticket.
 */
export async function PATCH(
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
    .select('id, email')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  let body: { cancel_reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const cancelReason = body.cancel_reason?.trim() ?? ''
  if (cancelReason.length < 5) {
    return NextResponse.json({ error: 'La razón de cancelación debe tener al menos 5 caracteres' }, { status: 400 })
  }

  // Fetch ticket via user client — RLS ensures they own it (or follow it)
  const { data: ticket, error: fetchErr } = await supabase
    .from('tickets')
    .select('id, display_id, subject, status, created_by')
    .eq('id', id)
    .single()

  if (fetchErr || !ticket) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
  }

  // Only the creator can cancel
  if (ticket.created_by !== profile.id) {
    return NextResponse.json({ error: 'Solo el creador puede cancelar esta solicitud' }, { status: 403 })
  }

  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    return NextResponse.json({ error: 'Esta solicitud ya está cerrada o resuelta' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: updateErr } = await admin
    .from('tickets')
    .update({ status: 'resolved' })
    .eq('id', id)

  if (updateErr) {
    console.error('[cancel] update error:', updateErr)
    return NextResponse.json({ error: 'Error al cancelar la solicitud' }, { status: 500 })
  }

  await Promise.all([
    admin.from('audit_log').insert({
      ticket_id:  id,
      actor_id:   profile.id,
      action:     'status_changed',
      from_value: ticket.status,
      to_value:   'resolved',
      metadata:   { cancelled_by_user: true },
    }),
    admin.from('ticket_status_history').insert({
      ticket_id:  id,
      status:     'resolved',
      changed_by: profile.id,
    }),
    admin.from('ticket_comments').insert({
      ticket_id:  id,
      author_id:  profile.id,
      body:       `Solicitud cancelada por el solicitante. Razón: ${cancelReason}`,
      visibility: 'public',
    }),
  ])

  notifyTicketCancelled({
    ticketId:       id,
    displayId:      ticket.display_id,
    subject:        ticket.subject,
    cancelReason,
    requesterEmail: profile.email,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
