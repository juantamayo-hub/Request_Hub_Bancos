import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AddCommentInput } from '@/lib/database.types'

/**
 * POST /api/tickets/[id]/comments
 * - Employees: public comments on their own tickets (enforced by RLS).
 * - Admins: any visibility on any ticket.
 * Audit log written via service-role client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  let body: AddCommentInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { body: commentBody, visibility = 'public' } = body

  if (!commentBody?.trim()) {
    return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
  }

  // Non-admins can only post public comments
  const effectiveVisibility = profile.role === 'admin' ? visibility : 'public'

  // Insert via regular client — RLS enforces ownership for employees
  const { data: comment, error: insertErr } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id:  id,
      author_id:  profile.id,
      body:       commentBody.trim(),
      visibility: effectiveVisibility,
    })
    .select(`*, profiles(id, email, first_name, last_name, avatar_url)`)
    .single()

  if (insertErr || !comment) {
    console.error('Comment insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }

  // Audit log (service-role)
  const admin = createAdminClient()
  await admin.from('audit_log').insert({
    ticket_id:  id,
    actor_id:   profile.id,
    action:     'comment_added',
    from_value: null,
    to_value:   effectiveVisibility,
    metadata:   { preview: commentBody.substring(0, 100) },
  })

  return NextResponse.json({ comment }, { status: 201 })
}
