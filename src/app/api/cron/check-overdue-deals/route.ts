import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { fetchOpenDealsInStage }     from '@/lib/pipedrive'

// ── Vercel Cron config ────────────────────────────────────────
// Schedule defined in vercel.json: "0 6,12 * * 1-5"
// = 8:00 and 14:00 Madrid time (CEST, UTC+2) Mon–Fri

export const runtime     = 'nodejs'
export const maxDuration = 60

// ── Custom field codes (pipeline 7 banking deals) ─────────────

// Timestamp of when the deal entered each stage
const FIELD_BANK_SUBMISSION_TS = 'b2ce9770e6fad6b4d3ba5e7d955ad5d6b8cf115c'
const FIELD_VALUATION_TS       = 'a3dd06fd2653846072857496f81d7b7a9d41fe85'
const FIELD_FEIN_TS            = 'b61aafe43b4c3c4d8a1a70675beaaffa529bb295'

const FIELD_BANK_NAME = 'c3a445b9bf0422b9db09abc776cf2dc281b7e975'

// ── Overdue rules ─────────────────────────────────────────────

interface OverdueRule {
  stageId:        number
  categoryName:   string
  timestampField: string
  thresholdHours: number
  stageName:      string
}

const OVERDUE_RULES: OverdueRule[] = [
  {
    stageId:        70,
    categoryName:   'Bank Submission Overdue',
    timestampField: FIELD_BANK_SUBMISSION_TS,
    thresholdHours: 48,
    stageName:      'Bank Submission',
  },
  {
    stageId:        72,
    categoryName:   'Valuation Overdue',
    timestampField: FIELD_VALUATION_TS,
    thresholdHours: 120, // 5 days
    stageName:      'Valuation',
  },
  {
    stageId:        73,
    categoryName:   'FEIN Overdue',
    timestampField: FIELD_FEIN_TS,
    thresholdHours: 120, // 5 days
    stageName:      'FEIN',
  },
]

// ── Helpers ───────────────────────────────────────────────────

function hoursElapsed(raw: unknown): number {
  if (!raw || typeof raw !== 'string') return -1
  const d = new Date(raw)
  if (isNaN(d.getTime())) return -1
  return (Date.now() - d.getTime()) / (1000 * 60 * 60)
}

function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24)
  const rem  = Math.floor(hours % 24)
  if (days === 0) return `${Math.floor(hours)} horas`
  return rem > 0 ? `${days} días y ${rem}h` : `${days} días`
}

// ── Cron handler ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret (set CRON_SECRET in Vercel env vars)
  const auth = request.headers.get('authorization')
  const envSecret = process.env.CRON_SECRET
  if (!envSecret || auth !== `Bearer ${envSecret}`) {
    return NextResponse.json({
      error: 'Unauthorized',
      debug: {
        envSecretSet: !!envSecret,
        envSecretLen: envSecret?.length ?? 0,
        envSecretStart: envSecret?.slice(0, 6) ?? 'N/A',
        receivedAuthLen: auth?.length ?? 0,
        receivedAuthStart: auth?.slice(0, 13) ?? 'N/A',
      },
    }, { status: 401 })
  }

  const admin = createAdminClient()

  // Load all system categories (name → id)
  const { data: cats, error: catsErr } = await admin
    .from('categories')
    .select('id, name')
    .eq('is_system', true)

  if (catsErr || !cats?.length) {
    console.error('[cron] failed to load system categories:', catsErr)
    return NextResponse.json({ error: 'System categories not found' }, { status: 500 })
  }

  const categoryMap = new Map(cats.map(c => [c.name, c.id as string]))

  // Cache owner profile resolution (email → profile id)
  const ownerCache = new Map<string, string | null>()

  async function resolveOwner(categoryId: string): Promise<string | null> {
    const { data: rule } = await admin
      .from('routing_rules')
      .select('owner_email')
      .eq('category_id', categoryId)
      .maybeSingle()

    const email = rule?.owner_email
    if (!email) return null
    if (ownerCache.has(email)) return ownerCache.get(email) ?? null

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    const id = (profile?.id as string | undefined) ?? null
    ownerCache.set(email, id)
    return id
  }

  let totalCreated = 0
  const summary: string[] = []

  for (const rule of OVERDUE_RULES) {
    const categoryId = categoryMap.get(rule.categoryName)
    if (!categoryId) {
      summary.push(`SKIP ${rule.categoryName}: not in DB`)
      continue
    }

    let deals
    try {
      deals = await fetchOpenDealsInStage(rule.stageId)
    } catch (err) {
      summary.push(`ERROR ${rule.categoryName}: Pipedrive fetch failed`)
      console.error(`[cron] fetchOpenDealsInStage(${rule.stageId}) failed:`, err)
      continue
    }

    let created = 0
    let skipped = 0

    for (const deal of deals) {
      const hours = hoursElapsed(deal[rule.timestampField])
      if (hours < rule.thresholdHours) continue

      const dealId   = deal.id
      const bankName = (deal[FIELD_BANK_NAME] as string | null)
        ?? (deal.title as string | null)
        ?? `Deal #${dealId}`

      // Deduplication: skip if an open ticket already exists for this deal + category
      const { data: existing } = await admin
        .from('tickets')
        .select('id')
        .eq('pipedrive_deal_id', dealId)
        .eq('category_id', categoryId)
        .in('status', ['new', 'in_progress', 'waiting_on_employee'])
        .maybeSingle()

      if (existing) { skipped++; continue }

      const ownerName    = deal.owner_id?.name ?? 'Sin asignar'
      const pipedriveUrl = `https://app.pipedrive.com/deal/${dealId}`
      const timeStr      = formatDuration(hours)

      const description = [
        `Deal #${dealId} lleva ${timeStr} en stage ${rule.stageName}.`,
        `Banco: ${bankName}`,
        `Responsable en Pipedrive: ${ownerName}`,
        `Ver deal: ${pipedriveUrl}`,
        ``,
        `Ticket generado automáticamente por Request Hub Bancos.`,
      ].join('\n')

      const assigneeId  = await resolveOwner(categoryId)
      const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

      const { error: insertErr } = await admin.from('tickets').insert({
        created_by:        null,  // auto-generated — no human author
        assignee_id:       assigneeId,
        category_id:       categoryId,
        subject:           `[Auto] ${rule.categoryName} – Deal #${dealId} – ${bankName}`,
        description,
        priority:          'high',
        status:            'new',
        sla_hours:         48,
        sla_deadline:      slaDeadline,
        bank_name:         bankName,
        pipedrive_deal_id: dealId,
      })

      if (insertErr) {
        console.error(`[cron] insert error deal=${dealId} category=${rule.categoryName}:`, insertErr)
      } else {
        created++
      }
    }

    totalCreated += created
    summary.push(
      `${rule.categoryName}: ${deals.length} deals en stage, ${created} tickets creados, ${skipped} ya existían`,
    )
  }

  const result = { ok: true, totalCreated, summary, runAt: new Date().toISOString() }
  console.log('[cron/check-overdue-deals]', JSON.stringify(result))
  return NextResponse.json(result)
}
