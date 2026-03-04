import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdminPromoted } from '@/lib/notifications'

/**
 * GET /api/admin/users/[id]
 * Returns user profile + their open tickets. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, role, is_available')
    .eq('id', id)
    .single()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Fetch open tickets assigned to this user
  const { data: openTickets } = await admin
    .from('tickets')
    .select('id, display_id, subject, status, priority, created_at')
    .eq('assignee_id', id)
    .not('status', 'in', '("resolved","closed")')
    .order('created_at', { ascending: false })

  return NextResponse.json({ profile, openTickets: openTickets ?? [] })
}

/**
 * PATCH /api/admin/users/[id]
 * Supported operations (pass one at a time in body):
 *   { action: 'toggle_availability' }
 *   { action: 'set_role', role: 'admin' | 'employee' }
 *   { action: 'reassign_tickets', reassign_to_id: string | null }
 *     reassign_to_id = null → keep assigned to the disabled user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { action: string; role?: string; reassign_to_id?: string | null }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── toggle_availability ───────────────────────────────────────
  if (body.action === 'toggle_availability') {
    const { data: target } = await admin
      .from('profiles')
      .select('is_available, email, first_name, last_name')
      .eq('id', id)
      .single()

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: updated, error: upErr } = await admin
      .from('profiles')
      .update({ is_available: !target.is_available })
      .eq('id', id)
      .select('id, is_available')
      .single()

    if (upErr) return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
    return NextResponse.json({ profile: updated })
  }

  // ── set_role ─────────────────────────────────────────────────
  if (body.action === 'set_role') {
    if (body.role !== 'admin' && body.role !== 'employee') {
      return NextResponse.json({ error: 'role must be admin or employee' }, { status: 400 })
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('id', id)
      .single()

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target.id === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const { data: updated, error: upErr } = await admin
      .from('profiles')
      .update({ role: body.role })
      .eq('id', id)
      .select('id, role')
      .single()

    if (upErr) return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })

    // Notify via Slack when promoted to admin
    if (body.role === 'admin' && target.role !== 'admin') {
      notifyAdminPromoted({
        email:     target.email,
        firstName: target.first_name ?? target.email.split('@')[0],
      }).catch(console.error)
    }

    return NextResponse.json({ profile: updated })
  }

  // ── reassign_tickets ──────────────────────────────────────────
  if (body.action === 'reassign_tickets') {
    // reassign_to_id = null means keep as-is (no-op)
    if (body.reassign_to_id === null || body.reassign_to_id === undefined) {
      return NextResponse.json({ reassigned: 0 })
    }

    // Validate target assignee exists
    const { data: newAssignee } = await admin
      .from('profiles')
      .select('id')
      .eq('id', body.reassign_to_id)
      .single()

    if (!newAssignee) return NextResponse.json({ error: 'Target assignee not found' }, { status: 404 })

    const { data: updated, error: upErr } = await admin
      .from('tickets')
      .update({ assignee_id: body.reassign_to_id })
      .eq('assignee_id', id)
      .not('status', 'in', '("resolved","closed")')
      .select('id')

    if (upErr) return NextResponse.json({ error: 'Failed to reassign tickets' }, { status: 500 })

    return NextResponse.json({ reassigned: updated?.length ?? 0 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
