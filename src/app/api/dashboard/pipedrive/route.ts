import { NextRequest, NextResponse } from 'next/server'
import { fetchRevenue, fetchFunnelConversions } from '@/lib/pipedrive'

export const runtime     = 'nodejs'
export const maxDuration = 60   // Vercel Pro: 60s. Hobby: capped at 10s but isolated from SSR.

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from/to params' }, { status: 400 })
  }

  const fromDate = new Date(from)
  const toDate   = new Date(to + 'T23:59:59')

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date params' }, { status: 400 })
  }

  const t0 = Date.now()
  console.log(`[pipedrive] ▶ starting  from=${from}  to=${to}`)

  try {
    const GLOBAL_TIMEOUT_MS = 25_000
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Global timeout after 25s')), GLOBAL_TIMEOUT_MS),
    )

    const [rawRevenue, funnel] = await Promise.race([
      Promise.all([
        fetchRevenue(fromDate, toDate).then(r => {
          console.log(`[pipedrive] ✓ revenue  ${Date.now() - t0}ms  p7=${r.bayteca.dealCount}  p10=${r.md.dealCount}`)
          return r
        }),
        fetchFunnelConversions(fromDate, toDate).then(r => {
          console.log(`[pipedrive] ✓ funnel   ${Date.now() - t0}ms  deals=${r.totalDeals}`)
          return r
        }),
      ]),
      timeout,
    ])

    const revenue = {
      bayteca:   rawRevenue.bayteca.total,
      md:        rawRevenue.md.total,
      total:     rawRevenue.total,
      dealCount: { bayteca: rawRevenue.bayteca.dealCount, md: rawRevenue.md.dealCount },
    }

    console.log(`[pipedrive] ✓ total done     ${Date.now() - t0}ms`)
    return NextResponse.json({ revenue, funnel })
  } catch (err) {
    console.error('[dashboard/pipedrive] fetch failed:', err)
    return NextResponse.json({ error: 'Pipedrive fetch failed' }, { status: 500 })
  }
}
