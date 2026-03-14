import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTicketCreated } from '@/lib/notifications'
import type { CreateTicketInput } from '@/lib/database.types'

/**
 * POST /api/tickets
 * Creates a new ticket. Authenticated employees only.
 * Uses assign_ticket_owner() RPC for round-robin assignment by support_type.
 * Falls back to routing_rules for SLA configuration.
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

  const { category_id, subject, description, subcategory, support_type, priority, tags } = body

  if (!category_id || !subject?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: 'category_id, subject, and description are required' },
      { status: 400 },
    )
  }

  // ─── Admin client ─────────────────────────────────────────────
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error('Admin client init failed:', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // ─── Round-robin owner assignment ────────────────────────────
  // If support_type is provided, use the atomic assign_ticket_owner() RPC.
  // Otherwise fall back to routing_rules (legacy / admin-reclassified tickets).
  let assigneeEmail: string | null = null

  if (support_type) {
    const { data: ownerEmail, error: rpcErr } = await admin
      .rpc('assign_ticket_owner', { p_support_type: support_type })

    if (rpcErr) {
      console.error('assign_ticket_owner RPC error:', rpcErr)
    } else {
      assigneeEmail = ownerEmail as string | null
    }
  } else {
    // Fallback: look up routing_rules by category
    const { data: rule } = await admin
      .from('routing_rules')
      .select('owner_email')
      .eq('category_id', category_id)
      .single()
    assigneeEmail = rule?.owner_email ?? null
  }

  // ─── Fallback to Maryam if no assignee was resolved ──────────
  if (!assigneeEmail) {
    assigneeEmail = 'maryam.mesforoush@huspy.io'
  }

  // ─── Resolve assignee email → profile id ──────────────────────
  let assigneeId: string | null = null
  if (assigneeEmail) {
    const { data: assignee } = await admin
      .from('profiles')
      .select('id')
      .eq('email', assigneeEmail)
      .single()
    assigneeId = assignee?.id ?? null
  }

  // ─── SLA from routing_rules ───────────────────────────────────
  const { data: rule } = await admin
    .from('routing_rules')
    .select('*, categories(id, name)')
    .eq('category_id', category_id)
    .single()

  const slaHours      = rule?.sla_hours ?? 72
  const defaultPriority = priority ?? rule?.default_priority ?? 'medium'
  const slaDeadline   = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()

  // ─── Create ticket (use regular client so RLS created_by check fires) ─
  const { data: ticket, error: insertErr } = await supabase
    .from('tickets')
    .insert({
      created_by:   profile.id,
      assignee_id:  assigneeId,
      category_id,
      subcategory:  subcategory ?? null,
      support_type: support_type ?? null,
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

  // ─── Audit log ────────────────────────────────────────────────
  await admin.from('audit_log').insert({
    ticket_id:  ticket.id,
    actor_id:   profile.id,
    action:     'created',
    from_value: null,
    to_value:   ticket.status,
    metadata:   { display_id: ticket.display_id },
  })

  // ─── Status history ───────────────────────────────────────────
  await admin.from('ticket_status_history').insert({
    ticket_id:  ticket.id,
    status:     'new',
    changed_by: profile.id,
  })

  // ─── Notifications (fire-and-forget) ─────────────────────────
  const categoryName = (rule as { categories?: { name: string } } | null)?.categories?.name ?? category_id
  notifyTicketCreated({
    ticketId:       ticket.id,
    displayId:      ticket.display_id,
    subject:        ticket.subject,
    category:       categoryName,
    requesterEmail: profile.email,
    assigneeEmail:  assigneeEmail ?? undefined,
  }).catch(console.error)

  return NextResponse.json({ ticket }, { status: 201 })
}
