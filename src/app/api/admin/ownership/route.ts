import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── GET /api/admin/ownership ──────────────────────────────────
// Returns all active categories joined with their routing rule.
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .select('id, name, routing_rules(id, owner_email, backup_owner_email, sla_hours, default_priority)')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ categories: data ?? [] })
}

// ─── PATCH /api/admin/ownership ────────────────────────────────
// Upserts the routing rule for a category (owner_email, backup_owner_email).
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { category_id: string; owner_email: string; backup_owner_email?: string | null }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.category_id || !body.owner_email?.trim()) {
    return NextResponse.json({ error: 'category_id y owner_email son obligatorios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('routing_rules')
    .upsert(
      {
        category_id:        body.category_id,
        owner_email:        body.owner_email.trim(),
        backup_owner_email: body.backup_owner_email?.trim() || null,
      },
      { onConflict: 'category_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
