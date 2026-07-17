import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = Promise<{ id: string; commentId: string }>

async function requireAdminProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return profile
}

/**
 * PATCH /api/tickets/[id]/comments/[commentId]
 * Admin only — edit a comment's body.
 */
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id: ticketId, commentId } = await params
  const supabase = await createClient()

  const profile = await requireAdminProfile(supabase)
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: string
  try {
    const json = await request.json()
    body = (json.body ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body) {
    return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the comment belongs to this admin
  const { data: existing } = await admin
    .from('ticket_comments')
    .select('author_id')
    .eq('id', commentId)
    .eq('ticket_id', ticketId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.author_id !== profile.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: comment, error } = await admin
    .from('ticket_comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('ticket_id', ticketId)
    .select('*')
    .single()

  if (error || !comment) {
    console.error('Comment update error:', error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }

  await admin.from('audit_log').insert({
    ticket_id:  ticketId,
    actor_id:   profile.id,
    action:     'comment_edited',
    from_value: null,
    to_value:   null,
    metadata:   { comment_id: commentId, preview: body.substring(0, 100) },
  })

  return NextResponse.json({ comment })
}

/**
 * DELETE /api/tickets/[id]/comments/[commentId]
 * Admin only — permanently delete a comment.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const { id: ticketId, commentId } = await params
  const supabase = await createClient()

  const profile = await requireAdminProfile(supabase)
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Verify the comment belongs to this admin
  const { data: existing } = await admin
    .from('ticket_comments')
    .select('author_id')
    .eq('id', commentId)
    .eq('ticket_id', ticketId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.author_id !== profile.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin
    .from('ticket_comments')
    .delete()
    .eq('id', commentId)
    .eq('ticket_id', ticketId)

  if (error) {
    console.error('Comment delete error:', error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }

  await admin.from('audit_log').insert({
    ticket_id:  ticketId,
    actor_id:   profile.id,
    action:     'comment_deleted',
    from_value: null,
    to_value:   null,
    metadata:   { comment_id: commentId },
  })

  return NextResponse.json({ success: true })
}
