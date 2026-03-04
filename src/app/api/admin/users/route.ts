import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/users
 * Returns all profiles. Admin only.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, role, department, avatar_url, is_available, created_at')
    .order('first_name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })

  return NextResponse.json({ profiles })
}
