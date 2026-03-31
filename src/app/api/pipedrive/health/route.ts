// Quick connectivity test — call /api/pipedrive/health from the browser to verify
// Pipedrive is reachable and the API token is valid.
import { NextResponse } from 'next/server'

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN
const BASE_URL  = 'https://api.pipedrive.com/v1'

export const runtime    = 'nodejs'
export const maxDuration = 30

export async function GET() {
  if (!API_TOKEN) {
    return NextResponse.json({ ok: false, error: 'PIPEDRIVE_API_TOKEN not set' }, { status: 500 })
  }

  const start = Date.now()
  try {
    const res = await fetch(
      `${BASE_URL}/deals?pipeline_id=7&limit=1&api_token=${API_TOKEN}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    )
    const ms   = Date.now() - start
    const json = await res.json()

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: json?.error, ms })
    }

    return NextResponse.json({
      ok:            true,
      ms,
      totalDealsHint: json?.additional_data?.pagination?.next_start ?? '(no pagination)',
      firstDealId:    json?.data?.[0]?.id ?? null,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), ms: Date.now() - start }, { status: 500 })
  }
}
