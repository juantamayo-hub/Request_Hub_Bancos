import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isConfigured,
  fetchLostReasons,
  fetchVolumeByBank,
  fetchConversionsByBank,
} from '@/lib/sheets'

export const runtime     = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/dashboard/sheets-kpi?year=2026
 * Returns KPI data from Google Sheets. Admin only.
 * Returns { configured: false } if service account env vars are not set.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Return early if not configured — frontend shows setup instructions
  if (!isConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const year = parseInt(request.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  try {
    const [lostReasons, volumeByBank, conversionsByBank] = await Promise.all([
      fetchLostReasons(),
      fetchVolumeByBank(year),
      fetchConversionsByBank(),
    ])

    return NextResponse.json({
      configured: true,
      year,
      lostReasons,
      volumeByBank,
      conversionsByBank,
    })
  } catch (err) {
    console.error('[sheets-kpi] fetch failed:', err)
    return NextResponse.json({ error: 'Error al leer Google Sheets', detail: String(err) }, { status: 500 })
  }
}
