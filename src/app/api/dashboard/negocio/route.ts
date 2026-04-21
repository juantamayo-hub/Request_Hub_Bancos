import { NextRequest, NextResponse } from 'next/server'
import { fetchBaytecaMetrics, fetchBaytecaRevenue, fetchStageCounts, fetchMortgageVolume } from '@/lib/pipedrive'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const sp  = request.nextUrl.searchParams
  const now = new Date()

  const year = parseInt(sp.get('year') ?? String(now.getFullYear()), 10)

  // Accept comma-separated months: ?months=3,4  or legacy ?month=4
  const monthsRaw = sp.get('months') ?? sp.get('month') ?? String(now.getMonth() + 1)
  const months    = monthsRaw
    .split(',')
    .map(Number)
    .filter(m => !isNaN(m) && m >= 1 && m <= 12)

  if (isNaN(year) || months.length === 0) {
    return NextResponse.json({ error: 'Invalid year/months params' }, { status: 400 })
  }

  try {
    const GLOBAL_TIMEOUT_MS = 55_000
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Global timeout after 55s')), GLOBAL_TIMEOUT_MS),
    )

    const [metrics, revenue, stageCounts, mortgageVolume] = await Promise.race([
      Promise.all([
        fetchBaytecaMetrics(year, months),
        fetchBaytecaRevenue(year, months),
        fetchStageCounts(),
        fetchMortgageVolume(year, months),
      ]),
      timeout,
    ])

    return NextResponse.json({
      kpis:           metrics.kpis,
      ytdKpis:        metrics.ytdKpis,
      ytdBsTotal:     metrics.ytdBsTotal,
      funnel:         metrics.funnel,
      lostByStage:    metrics.lostByStage,
      bsTotal:        metrics.bsTotal,
      revenue,
      stageCounts,
      mortgageVolume,
    })
  } catch (err) {
    console.warn('[dashboard/negocio] fetch failed:', err)
    return NextResponse.json({ error: 'Pipedrive fetch failed' }, { status: 500 })
  }
}
