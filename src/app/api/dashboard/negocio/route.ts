import { NextRequest, NextResponse } from 'next/server'
import { fetchBaytecaMetrics, fetchBaytecaRevenue } from '@/lib/pipedrive'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const sp  = request.nextUrl.searchParams
  const now = new Date()

  const year  = parseInt(sp.get('year')  ?? String(now.getFullYear()), 10)
  const month = parseInt(sp.get('month') ?? String(now.getMonth() + 1), 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year/month params' }, { status: 400 })
  }

  const from = new Date(year, 0, 1)               // Jan 1
  const to   = new Date(year, month, 0, 23, 59, 59) // last day of selected month

  try {
    const GLOBAL_TIMEOUT_MS = 55_000
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Global timeout after 25s')), GLOBAL_TIMEOUT_MS),
    )

    const [metrics, revenue] = await Promise.race([
      Promise.all([
        fetchBaytecaMetrics(year, month),
        fetchBaytecaRevenue(from, to),
      ]),
      timeout,
    ])

    return NextResponse.json({
      kpis:    metrics.kpis,
      funnel:  metrics.funnel,
      bsTotal: metrics.bsTotal,
      revenue,
    })
  } catch (err) {
    console.warn('[dashboard/negocio] fetch failed:', err)
    return NextResponse.json({ error: 'Pipedrive fetch failed' }, { status: 500 })
  }
}
