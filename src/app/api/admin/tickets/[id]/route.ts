import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyStatusChanged, notifyAssigned, notifyTicketCancelled } from '@/lib/notifications'
import type { UpdateTicketInput, TicketStatus } from '@/lib/database.types'
import { updateDealField, FIELD_DEAL_SUMMARY } from '@/lib/pipedrive'

/**
 * PATCH /api/admin/tickets/[id]
 * Admin-only: update status, priority, and/or assignee.
 * All changes are written to the audit_log and ticket_status_history.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // ─── Auth + role check ────────────────────────────────────────
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // ─── Parse body ───────────────────────────────────────────────
  let body: UpdateTicketInput & { cancel_reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Cancellation requires a reason
  if (body.status === 'resolved' && !body.cancel_reason?.trim()) {
    return NextResponse.json({ error: 'Se requiere una razón para cancelar la solicitud.' }, { status: 400 })
  }

  // ─── Fetch current ticket (using admin client to bypass RLS edge cases) ─
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error('Admin client init failed:', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { data: current, error: fetchErr } = await admin
    .from('tickets')
    .select('id, display_id, subject, status, priority, assignee_id, pipedrive_deal_id, profiles!tickets_created_by_fkey(email), categories(name)')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // ─── Build update payload ─────────────────────────────────────
  const updates: Record<string, unknown> = {}
  const auditEntries: Array<{
    ticket_id:  string
    actor_id:   string
    action:     string
    from_value: string | null
    to_value:   string | null
    metadata:   Record<string, unknown>
  }> = []

  if (body.status !== undefined && body.status !== current.status) {
    updates.status = body.status
    auditEntries.push({
      ticket_id:  id,
      actor_id:   profile.id,
      action:     'status_changed',
      from_value: current.status,
      to_value:   body.status,
      metadata:   {},
    })
  }

  if (body.priority !== undefined && body.priority !== current.priority) {
    updates.priority = body.priority
    auditEntries.push({
      ticket_id:  id,
      actor_id:   profile.id,
      action:     'priority_changed',
      from_value: current.priority,
      to_value:   body.priority,
      metadata:   {},
    })
  }

  if ('assignee_id' in body && body.assignee_id !== current.assignee_id) {
    updates.assignee_id = body.assignee_id ?? null
    auditEntries.push({
      ticket_id:  id,
      actor_id:   profile.id,
      action:     'assigned',
      from_value: current.assignee_id ?? null,
      to_value:   body.assignee_id ?? null,
      metadata:   {},
    })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes to apply' }, { status: 400 })
  }

  // ─── Apply update ──────────────────────────────────────────────
  const { data: updated, error: updateErr } = await admin
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select('id, display_id, subject, status, priority, assignee_id, updated_at')
    .single()

  if (updateErr || !updated) {
    console.error('Ticket update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }

  // ─── Audit log ────────────────────────────────────────────────
  if (auditEntries.length > 0) {
    await admin.from('audit_log').insert(auditEntries)
  }

  // ─── Assignee notification ────────────────────────────────────
  if ('assignee_id' in body && body.assignee_id && body.assignee_id !== current.assignee_id) {
    const { data: newAssignee } = await admin
      .from('profiles')
      .select('email')
      .eq('id', body.assignee_id)
      .single()

    if (newAssignee?.email) {
      const rawProfiles2 = (current as unknown as { profiles: { email: string } | { email: string }[] | null }).profiles
      const requesterEmail = rawProfiles2
        ? (Array.isArray(rawProfiles2) ? rawProfiles2[0]?.email : rawProfiles2.email) ?? ''
        : ''
      const rawCats = (current as unknown as { categories: { name: string } | null }).categories
      const categoryName = rawCats?.name ?? ''

      await notifyAssigned({
        ticketId:       id,
        displayId:      current.display_id,
        subject:        current.subject,
        category:       categoryName,
        requesterEmail,
        assigneeEmail:  newAssignee.email,
      }).catch(console.error)
    }
  }

  // ─── Status history ────────────────────────────────────────────
  if (body.status && body.status !== current.status) {
    await admin.from('ticket_status_history').insert({
      ticket_id:  id,
      status:     body.status as TicketStatus,
      changed_by: profile.id,
    })

    const rawProfiles = (current as unknown as { profiles: { email: string } | { email: string }[] | null }).profiles
    const requesterEmail = rawProfiles
      ? (Array.isArray(rawProfiles) ? rawProfiles[0]?.email : rawProfiles.email) ?? ''
      : ''

    if (body.status === 'resolved' && body.cancel_reason?.trim()) {
      // Save cancellation reason as internal comment
      await admin.from('ticket_comments').insert({
        ticket_id:  id,
        author_id:  profile.id,
        body:       `[Cancelación] ${body.cancel_reason.trim()}`,
        visibility: 'internal',
      })

      // Notify requester with specific cancellation message
      await notifyTicketCancelled({
        ticketId:       id,
        displayId:      current.display_id,
        subject:        current.subject,
        cancelReason:   body.cancel_reason.trim(),
        requesterEmail,
      }).catch(console.error)
    } else {
      await notifyStatusChanged({
        ticketId:       id,
        displayId:      current.display_id,
        subject:        current.subject,
        oldStatus:      current.status,
        newStatus:      body.status,
        updatedBy:      profile.email,
        requesterEmail,
      }).catch(console.error)
    }
  }

  // 7.4 — deal summary = last public comment (fire-and-forget, only on close)
  if (body.status === 'closed') {
    const dealId = (current as typeof current & { pipedrive_deal_id?: number | null }).pipedrive_deal_id
    if (dealId) {
      const { data: lastComment } = await admin
        .from('ticket_comments')
        .select('body')
        .eq('ticket_id', id)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (lastComment?.body) {
        updateDealField(dealId, FIELD_DEAL_SUMMARY, lastComment.body).catch(console.error)
      }
    }
  }

  return NextResponse.json({ ticket: updated })
}
