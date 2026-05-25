import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/notifications
 * Returns the 30 most recent notifications for the authenticated user.
 * Optional query param: ?unread_only=true
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const unreadOnly = request.nextUrl.searchParams.get('unread_only') === 'true'
  const admin = createAdminClient()

  let query = admin
    .from('notifications')
    .select(`
      id, type, is_read, created_at, ticket_id, comment_id,
      ticket:tickets(display_id, subject)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('notifications fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }

  return NextResponse.json({ notifications: data ?? [] })
}
