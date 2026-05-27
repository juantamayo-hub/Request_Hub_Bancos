import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewComment } from '@/lib/notifications'

function checkAuth(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') ?? ''
  const secret = process.env.EXTERNAL_API_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

/**
 * POST /api/external/tickets/[id]/comment
 * Writes a comment on a ticket on behalf of an existing profile.
 * Protected by Authorization: Bearer EXTERNAL_API_SECRET
 *
 * Body:
 *   author_email  string  — email of the profile that will appear as author
 *   body          string  — comment text
 *   visibility    string  — "public" (default) | "internal"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { author_email?: string; body?: string; visibility?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { author_email, body: commentBody, visibility = 'public' } = body

  if (!author_email?.trim()) {
    return NextResponse.json({ error: 'author_email is required' }, { status: 400 })
  }
  if (!commentBody?.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const effectiveVisibility = visibility === 'internal' ? 'internal' : 'public'

  const admin = createAdminClient()

  // Resolve author profile
  const { data: author } = await admin
    .from('profiles')
    .select('id, email, first_name, role')
    .eq('email', author_email.trim().toLowerCase())
    .single()

  if (!author) {
    return NextResponse.json({ error: `No profile found for email: ${author_email}` }, { status: 404 })
  }

  // Verify ticket exists
  const { data: ticket } = await admin
    .from('tickets')
    .select('id, display_id, subject, created_by, assignee_id, pipedrive_deal_id')
    .eq('id', id)
    .single()

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // Insert comment
  const { data: comment, error: insertErr } = await admin
    .from('ticket_comments')
    .insert({
      ticket_id:  id,
      author_id:  author.id,
      body:       commentBody.trim(),
      visibility: effectiveVisibility,
    })
    .select('id, body, visibility, created_at')
    .single()

  if (insertErr || !comment) {
    console.error('External comment insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }

  // Audit log
  await admin.from('audit_log').insert({
    ticket_id:  id,
    actor_id:   author.id,
    action:     'comment_added',
    from_value: null,
    to_value:   effectiveVisibility,
    metadata:   { preview: commentBody.trim().substring(0, 100), source: 'external_api' },
  })

  // Notify on public comments
  if (effectiveVisibility === 'public') {
    const [requesterResult, assigneeResult] = await Promise.all([
      ticket.created_by
        ? admin.from('profiles').select('email').eq('id', ticket.created_by).single()
        : Promise.resolve({ data: null }),
      ticket.assignee_id
        ? admin.from('profiles').select('email').eq('id', ticket.assignee_id).single()
        : Promise.resolve({ data: null }),
    ])

    const requesterEmail = (requesterResult.data as { email?: string } | null)?.email ?? ''
    const ownerEmail     = (assigneeResult.data  as { email?: string } | null)?.email ?? ''
    const isRequester    = author.id === ticket.created_by

    if (isRequester && ownerEmail) {
      await notifyNewComment({
        ticketId:       id,
        displayId:      ticket.display_id,
        subject:        ticket.subject,
        commentPreview: commentBody.trim(),
        recipientEmail: ownerEmail,
        isOwner:        true,
      }).catch(console.error)
      if (ticket.assignee_id) {
        admin.from('notifications').insert({
          user_id: ticket.assignee_id, ticket_id: id, comment_id: comment.id, type: 'new_comment',
        })
      }
    } else if (!isRequester && requesterEmail) {
      await notifyNewComment({
        ticketId:       id,
        displayId:      ticket.display_id,
        subject:        ticket.subject,
        commentPreview: commentBody.trim(),
        recipientEmail: requesterEmail,
        isOwner:        false,
      }).catch(console.error)
      if (ticket.created_by) {
        admin.from('notifications').insert({
          user_id: ticket.created_by, ticket_id: id, comment_id: comment.id, type: 'new_comment',
        })
      }
    }
  }

  return NextResponse.json({ comment }, { status: 201 })
}
