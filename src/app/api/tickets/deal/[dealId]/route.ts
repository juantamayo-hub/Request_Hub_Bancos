import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/tickets/deal/[dealId]
 * Returns open tickets for the given Pipedrive deal ID.
 * Used by TicketForm to warn about duplicates.
 * Uses admin client so system-created tickets (created_by=NULL) and
 * tickets from other users are visible — same cross-user check as POST /api/tickets.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const parsedId = parseInt(dealId, 10)
  if (isNaN(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: 'Deal ID inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: tickets, error } = await admin
    .from('tickets')
    .select('id, display_id, subject, status, categories(name)')
    .eq('pipedrive_deal_id', parsedId)
    .in('status', ['new', 'in_progress', 'waiting_on_employee'])

  if (error) {
    console.error('[deal-tickets] query error:', error)
    return NextResponse.json({ error: 'Error al consultar tickets' }, { status: 500 })
  }

  return NextResponse.json({ tickets: tickets ?? [] })
}
