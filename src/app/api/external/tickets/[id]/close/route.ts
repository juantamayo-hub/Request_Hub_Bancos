import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyStatusChanged } from '@/lib/notifications'
import { updateDealField, FIELD_DEAL_SUMMARY } from '@/lib/pipedrive'

function checkAuth(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') ?? ''
  const secret = process.env.EXTERNAL_API_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

const OPEN_STATUSES = ['new', 'in_progress', 'waiting_on_employee']

/**
 * POST /api/external/tickets/[id]/close
 *
 * Marks a ticket as solved (status 'closed') from an external system — e.g. the Command Center once it has written
 * the Santander gestor in Pipedrive. Same side effects as closing it from the admin panel:
 *   audit_log (status_changed) · ticket_status_history · requester notification (Slack DM + feedback) ·
 *   Pipedrive "Claim Summary" ← last public comment.
 * Only open tickets are closed (closed / resolved / cancelled are left as they are → idempotent).
 *
 * Body: { author_email: string }   — profile that appears as the one who closed it
 * Protected by Authorization: Bearer EXTERNAL_API_SECRET
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: { author_email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.author_email?.trim()) {
    return NextResponse.json({ error: 'author_email is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: author } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', body.author_email.trim().toLowerCase())
    .single()
  if (!author) {
    return NextResponse.json({ error: `No profile found for email: ${body.author_email}` }, { status: 404 })
  }

  const { data: current } = await admin
    .from('tickets')
    .select('id, display_id, subject, status, pipedrive_deal_id, profiles!tickets_created_by_fkey(email)')
    .eq('id', id)
    .single()
  if (!current) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }
  if (!OPEN_STATUSES.includes(current.status)) {
    return NextResponse.json({ ticket: { id: current.id, display_id: current.display_id, status: current.status }, changed: false })
  }

  const { data: updated, error: updateErr } = await admin
    .from('tickets')
    .update({ status: 'closed' })
    .eq('id', id)
    .in('status', OPEN_STATUSES)          // no pisar un cambio simultáneo
    .select('id, display_id, status, resolved_at')
    .single()
  if (updateErr || !updated) {
    console.error('External close error:', updateErr)
    return NextResponse.json({ error: 'Failed to close ticket' }, { status: 500 })
  }

  await admin.from('audit_log').insert({
    ticket_id:  id,
    actor_id:   author.id,
    action:     'status_changed',
    from_value: current.status,
    to_value:   'closed',
    metadata:   { source: 'external_api' },
  })
  await admin.from('ticket_status_history').insert({ ticket_id: id, status: 'closed', changed_by: author.id })

  const rawProfiles = (current as unknown as { profiles: { email: string } | { email: string }[] | null }).profiles
  const requesterEmail = rawProfiles
    ? (Array.isArray(rawProfiles) ? rawProfiles[0]?.email : rawProfiles.email) ?? ''
    : ''
  await notifyStatusChanged({
    ticketId:       id,
    displayId:      current.display_id,
    subject:        current.subject,
    oldStatus:      current.status,
    newStatus:      'closed',
    updatedBy:      author.email,
    requesterEmail,
  }).catch(console.error)

  // Deal summary = last public comment (same as closing from the admin panel)
  if (current.pipedrive_deal_id) {
    const { data: lastComment } = await admin
      .from('ticket_comments')
      .select('body')
      .eq('ticket_id', id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (lastComment?.body) {
      updateDealField(current.pipedrive_deal_id, FIELD_DEAL_SUMMARY, lastComment.body).catch(console.error)
    }
  }

  return NextResponse.json({ ticket: updated, changed: true })
}
