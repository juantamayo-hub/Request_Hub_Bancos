import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDeal } from '@/lib/pipedrive'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const dealId = parseInt(id, 10)
  if (isNaN(dealId) || dealId <= 0) {
    return NextResponse.json({ error: 'ID de deal inválido' }, { status: 400 })
  }

  try {
    const result = await validateDeal(dealId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al consultar Pipedrive'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
