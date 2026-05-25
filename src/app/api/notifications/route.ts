import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/notifications
 * Returns the 30 most recent notifications for the authenticated user.
 * Optional query param: ?unread_only=true
 *
 * Uses separate scalar queries instead of PostgREST joins to avoid
 * schema-cache issues with the recently created notifications table.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const unreadOnly = request.nextUrl.searchParams.get('unread_only') === 'true'
  const admin = createAdminClient()

  // 1. Fetch notification rows (scalar only — no PostgREST joins)
  let notifQuery = admin
    .from('notifications')
    .select('id, type, is_read, created_at, ticket_id, comment_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (unreadOnly) {
    notifQuery = notifQuery.eq('is_read', false)
  }

  const { data: rows, error } = await notifQuery

  if (error) {
    console.error('notifications fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ notifications: [] })
  }

  // 2. Resolve ticket display_id + subject for each notification
  const ticketIds = [...new Set(rows.map(r => r.ticket_id as string))]
  const { data: tickets } = await admin
    .from('tickets')
    .select('id, display_id, subject')
    .in('id', ticketIds)

  const ticketMap = Object.fromEntries(
    (tickets ?? []).map(t => [t.id as string, { display_id: t.display_id, subject: t.subject }])
  )

  const notifications = rows.map(r => ({
    ...r,
    ticket: ticketMap[r.ticket_id as string] ?? null,
  }))

  return NextResponse.json({ notifications })
}
