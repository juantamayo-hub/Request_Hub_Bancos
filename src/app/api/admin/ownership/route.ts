import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupportType } from '@/lib/database.types'

const VALID_SUPPORT_TYPES: SupportType[] = [
  'documents', 'visa', 'health_insurance', 'parking', 'time_off', 'revolut', 'other',
]

/**
 * GET /api/admin/ownership
 * Returns all support_type_owners grouped by support_type. Admin only.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: owners, error } = await admin
    .from('support_type_owners')
    .select('*')
    .order('support_type')
    .order('sort_order')

  if (error) return NextResponse.json({ error: 'Failed to fetch ownership' }, { status: 500 })

  return NextResponse.json({ owners: owners ?? [] })
}

/**
 * POST /api/admin/ownership
 * Add an owner to a support type.
 * Body: { support_type, owner_email }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { support_type: SupportType; owner_email: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!VALID_SUPPORT_TYPES.includes(body.support_type)) {
    return NextResponse.json({ error: 'Invalid support_type' }, { status: 400 })
  }
  if (!body.owner_email?.trim()) {
    return NextResponse.json({ error: 'owner_email is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the owner is an admin profile
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('email', body.owner_email)
    .single()

  if (!ownerProfile) {
    return NextResponse.json({ error: 'User not found. They must sign in at least once.' }, { status: 404 })
  }
  if (ownerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin users can be assigned as owners.' }, { status: 400 })
  }

  // Get the max sort_order for this support type to append at the end
  const { data: existing } = await admin
    .from('support_type_owners')
    .select('sort_order')
    .eq('support_type', body.support_type)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data: owner, error: insErr } = await admin
    .from('support_type_owners')
    .insert({
      support_type: body.support_type,
      owner_email:  body.owner_email,
      sort_order:   nextOrder,
    })
    .select('*')
    .single()

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json({ error: 'This user is already an owner for this category.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to add owner' }, { status: 500 })
  }

  return NextResponse.json({ owner }, { status: 201 })
}

/**
 * DELETE /api/admin/ownership
 * Remove an owner from a support type.
 * Body: { support_type, owner_email }
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { support_type: SupportType; owner_email: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error: delErr } = await admin
    .from('support_type_owners')
    .delete()
    .eq('support_type', body.support_type)
    .eq('owner_email', body.owner_email)

  if (delErr) return NextResponse.json({ error: 'Failed to remove owner' }, { status: 500 })

  return NextResponse.json({ success: true })
}
