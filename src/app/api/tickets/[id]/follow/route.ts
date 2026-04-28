import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/tickets/[id]/follow
 * Toggles the current user as a follower of the ticket.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const admin = createAdminClient()

  // Check current follow state
  const { data: existing } = await admin
    .from('ticket_followers')
    .select('ticket_id')
    .eq('ticket_id', id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existing) {
    // Unfollow
    await admin
      .from('ticket_followers')
      .delete()
      .eq('ticket_id', id)
      .eq('user_id', profile.id)
    return NextResponse.json({ following: false })
  } else {
    // Follow
    await admin
      .from('ticket_followers')
      .insert({ ticket_id: id, user_id: profile.id })
    return NextResponse.json({ following: true })
  }
}
