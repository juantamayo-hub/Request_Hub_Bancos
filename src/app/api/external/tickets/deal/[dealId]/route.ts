import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function checkAuth(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') ?? ''
  const secret = process.env.EXTERNAL_API_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/external/tickets/deal/[dealId]
 * Returns open tickets (new | in_progress | waiting_on_employee) for a Pipedrive deal.
 * With ?include_closed=1 it returns tickets in ANY status (most recent first) — used by the Command Center to
 * comment the Santander gestor assignment on the deal's ticket even when it is already closed.
 * Protected by Authorization: Bearer EXTERNAL_API_SECRET
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dealId } = await params
  const parsed = parseInt(dealId, 10)
  if (isNaN(parsed) || parsed <= 0) {
    return NextResponse.json({ error: 'Invalid deal ID' }, { status: 400 })
  }

  const includeClosed = request.nextUrl.searchParams.get('include_closed') === '1'

  const admin = createAdminClient()

  let query = admin
    .from('tickets')
    .select('id, display_id, subject, status, bank_name, category_id, created_at')
    .eq('pipedrive_deal_id', parsed)
  if (!includeClosed) query = query.in('status', ['new', 'in_progress', 'waiting_on_employee'])
  const { data: tickets, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('External tickets/deal fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ tickets: tickets ?? [] })
}
