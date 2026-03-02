import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTicketCreated } from '@/lib/notifications'
import type { CreateTicketInput } from '@/lib/database.types'

/**
 * POST /api/tickets
 * Creates a new ticket. Authenticated employees only.
 * Looks up the routing rule to set assignee + SLA automatically.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify session
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get profile (for created_by FK)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Parse + validate body
  let body: CreateTicketInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { category_id, subject, description, subcategory, priority, tags } = body

  if (!category_id || !subject?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: 'category_id, subject, and description are required' },
      { status: 400 },
    )
  }

  // ─── Look up routing rule ─────────────────────────────────────
  const admin = createAdminClient()

  const { data: rule } = await admin
    .from('routing_rules')
    .select('*, categories(id, name)')
    .eq('category_id', category_id)
    .single()

  // Resolve assignee by email → profile id
  let assigneeId: string | null = null
  if (rule?.owner_email) {
    const { data: assignee } = await admin
      .from('profiles')
      .select('id')
      .eq('email', rule.owner_email)
      .single()
    assigneeId = assignee?.id ?? null
  }

  const slaHours = rule?.sla_hours ?? 72
  const defaultPriority = priority ?? rule?.default_priority ?? 'medium'
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()

  // ─── Create ticket (use regular client so RLS created_by check fires) ─
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
    })
    .select('id, display_id, subject, status, priority')
    .single()

  if (insertErr || !ticket) {
    console.error('Ticket insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }

  // ─── Audit log (service-role only) ────────────────────────────
  await admin.from('audit_log').insert({
    ticket_id:  ticket.id,
    actor_id:   profile.id,
    action:     'created',
    from_value: null,
    to_value:   ticket.status,
    metadata:   { display_id: ticket.display_id },
  })

  // ─── Status history ────────────────────────────────────────────
  await admin.from('ticket_status_history').insert({
    ticket_id:  ticket.id,
    status:     'new',
    changed_by: profile.id,
  })

  // ─── Notifications (fire-and-forget) ──────────────────────────
  const categoryName = (rule as { categories?: { name: string } } | null)?.categories?.name ?? category_id
  notifyTicketCreated({
    ticketId:       ticket.id,
    displayId:      ticket.display_id,
    subject:        ticket.subject,
    category:       categoryName,
    requesterEmail: profile.email,
    assigneeEmail:  rule?.owner_email ?? undefined,
  }).catch(console.error)

  return NextResponse.json({ ticket }, { status: 201 })
}
