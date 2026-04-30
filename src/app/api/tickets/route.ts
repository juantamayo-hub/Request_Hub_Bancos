import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTicketCreated } from '@/lib/notifications'
import { createDealNote, updateDealField, FIELD_CLAIM_DATE, FIELD_CLAIM_OWNER } from '@/lib/pipedrive'
import type { CreateTicketInput } from '@/lib/database.types'

/**
 * POST /api/tickets
 * Creates a new banking ticket. Authenticated users only.
 * Assigns owner from routing_rules by category.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify session
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Get profile (for created_by FK)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  // Parse + validate body
  let body: CreateTicketInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { category_id, subject, description, subcategory, priority, tags, bank_name, bank_email, client_name, pipedrive_deal_id } = body


  if (!category_id || !subject?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: 'category_id, subject y description son obligatorios' },
      { status: 400 },
    )
  }

  if (!bank_name?.trim()) {
    return NextResponse.json(
      { error: 'bank_name es obligatorio' },
      { status: 400 },
    )
  }

  // ─── Admin client ─────────────────────────────────────────────
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error('Admin client init failed:', err)
    return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
  }

  // ─── Owner assignment from routing_rules (round-robin) ───────
  const [{ data: rule }, { data: assigneeEmail }] = await Promise.all([
    admin
      .from('routing_rules')
      .select('sla_hours, default_priority, categories(id, name)')
      .eq('category_id', category_id)
      .single(),
    admin.rpc('pick_next_assignee_email', { p_category_id: category_id }),
  ])

  // ─── Resolve assignee email → profile id ──────────────────────
  let assigneeId: string | null = null
  if (assigneeEmail) {
    const { data: assignee } = await admin
      .from('profiles')
      .select('id')
      .eq('email', assigneeEmail as string)
      .single()
    assigneeId = assignee?.id ?? null
  }

  const slaHours       = rule?.sla_hours ?? 72
  const defaultPriority = priority ?? rule?.default_priority ?? 'medium'
  const slaDeadline    = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()

  // ─── Create ticket ────────────────────────────────────────────
  const { data: ticket, error: insertErr } = await supabase
    .from('tickets')
    .insert({
      created_by:   profile.id,
      assignee_id:  assigneeId,
      category_id,
      subcategory:  subcategory ?? null,
      subject:      subject.trim(),
      description:  description.trim(),
      priority:     defaultPriority,
      status:       'new',
      sla_hours:    slaHours,
      sla_deadline: slaDeadline,
      tags:         tags ?? null,
      bank_name:         bank_name.trim(),
      bank_email:        bank_email?.trim() ?? null,
      client_name:       client_name?.trim() ?? null,
      pipedrive_deal_id: pipedrive_deal_id ?? null,
    })
    .select('id, display_id, subject, status, priority, created_at')
    .single()

  if (insertErr || !ticket) {
    console.error('Ticket insert error:', insertErr)
    return NextResponse.json({ error: 'Error al crear la solicitud' }, { status: 500 })
  }

  const categoryName = (rule as { categories?: { name: string } } | null)?.categories?.name ?? category_id

  // ─── Parallel: audit log + status history + assignee profile ──
  const [, , assigneeProfileRes] = await Promise.all([
    admin.from('audit_log').insert({
      ticket_id:  ticket.id,
      actor_id:   profile.id,
      action:     'created',
      from_value: null,
      to_value:   ticket.status,
      metadata:   { display_id: ticket.display_id },
    }),
    admin.from('ticket_status_history').insert({
      ticket_id:  ticket.id,
      status:     'new',
      changed_by: profile.id,
    }),
    assigneeId
      ? admin.from('profiles').select('first_name, last_name, email').eq('id', assigneeId).single()
      : Promise.resolve({ data: null }),
  ])

  // ─── Notifications — awaited so Vercel doesn't kill the promise ─
  await notifyTicketCreated({
    ticketId:       ticket.id,
    displayId:      ticket.display_id,
    subject:        ticket.subject,
    category:       categoryName,
    requesterEmail: profile.email,
    assigneeEmail:  assigneeEmail ?? undefined,
  }).catch(console.error)

  // ─── Pipedrive note + field updates — fire-and-forget ────────
  if (pipedrive_deal_id) {
    const ticketUrl    = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/tickets/${ticket.id}`
    const assigneeLine = assigneeEmail ? `\nAsignado a: ${assigneeEmail}` : ''
    const noteContent  = [
      `📋 <b>Ticket ${ticket.display_id} creado en Request Hub Bancos</b>`,
      ``,
      `<b>Categoría:</b> ${categoryName}`,
      `<b>Banco:</b> ${bank_name}`,
      `<b>Descripción:</b> ${description.trim()}${assigneeLine}`,
      ``,
      `<a href="${ticketUrl}">Ver ticket → ${ticket.display_id}</a>`,
    ].join('\n')

    createDealNote(pipedrive_deal_id, noteContent).catch(err =>
      console.error('Pipedrive note error:', err),
    )

    const claimDate = new Date(ticket.created_at ?? Date.now()).toISOString().slice(0, 10)
    updateDealField(pipedrive_deal_id, FIELD_CLAIM_DATE, claimDate).catch(console.error)

    const assigneeProfile = assigneeProfileRes?.data
    if (assigneeProfile) {
      const assigneeName = assigneeProfile.first_name
        ? `${assigneeProfile.first_name} ${assigneeProfile.last_name ?? ''}`.trim()
        : assigneeProfile.email
      updateDealField(pipedrive_deal_id, FIELD_CLAIM_OWNER, assigneeName).catch(console.error)
    }
  }

  return NextResponse.json({ ticket }, { status: 201 })
}
