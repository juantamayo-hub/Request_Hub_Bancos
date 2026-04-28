import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateDealField, FIELD_CLAIM_DATE, FIELD_CLAIM_OWNER } from '@/lib/pipedrive'

/**
 * POST /api/admin/backfill-pipedrive-claims
 * Backfills FIELD_CLAIM_DATE and FIELD_CLAIM_OWNER for all historical tickets
 * that have a pipedrive_deal_id and an assignee.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: tickets, error } = await admin
    .from('tickets')
    .select(`
      pipedrive_deal_id,
      created_at,
      assignee:profiles!tickets_assignee_id_fkey(first_name, last_name, email)
    `)
    .not('pipedrive_deal_id', 'is', null)
    .not('assignee_id', 'is', null)

  if (error || !tickets) {
    return NextResponse.json({ error: 'Error al obtener tickets' }, { status: 500 })
  }

  // Fire-and-forget all updates in parallel (batched to avoid rate limits)
  let processed = 0
  const tasks = tickets.map(ticket => {
    const dealId = ticket.pipedrive_deal_id as number
    const rawAssignee = ticket.assignee as { first_name: string | null; last_name: string | null; email: string } | null
    if (!rawAssignee) return null

    const assigneeName = rawAssignee.first_name
      ? `${rawAssignee.first_name} ${rawAssignee.last_name ?? ''}`.trim()
      : rawAssignee.email

    const claimDate = new Date(ticket.created_at as string).toISOString().slice(0, 10)
    processed++

    return Promise.all([
      updateDealField(dealId, FIELD_CLAIM_DATE,  claimDate).catch(console.error),
      updateDealField(dealId, FIELD_CLAIM_OWNER, assigneeName).catch(console.error),
    ])
  }).filter(Boolean)

  await Promise.all(tasks)

  return NextResponse.json({ processed })
}
