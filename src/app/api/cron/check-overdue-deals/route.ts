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
  stageId:          number
  categoryName:     string
  timestampField:   string
  thresholdHours:   number
  maxThresholdHours?: number
  stageName:        string
}

const OVERDUE_RULES: OverdueRule[] = [
  {
    stageId:          70,
    categoryName:     'Bank Submission Overdue',
    timestampField:   FIELD_BANK_SUBMISSION_TS,
    thresholdHours:   48,
    maxThresholdHours: 360, // 15 days — ignore if deal has been stuck too long
    stageName:        'Bank Submission',
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
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Cache profile resolution (email → profile id)
  const profileCache = new Map<string, string | null>()

  async function resolveOwner(categoryId: string): Promise<string | null> {
    // Advance the round-robin counter and get the next assignee email
    const { data: email } = await admin.rpc('pick_next_assignee_email', { p_category_id: categoryId })
    if (!email) return null

    if (profileCache.has(email)) return profileCache.get(email) ?? null

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email as string)
      .maybeSingle()

    const id = (profile?.id as string | undefined) ?? null
    profileCache.set(email, id)
    return id
  }

  let totalCreated = 0
  const summary: string[] = []

  // Fetch all stages from Pipedrive in parallel
  console.log('[cron] starting Pipedrive fetches', new Date().toISOString())
  const stageResults = await Promise.all(
    OVERDUE_RULES.map(async rule => {
      const categoryId = categoryMap.get(rule.categoryName)
      if (!categoryId) return { rule, categoryId: null, deals: [] }
      try {
        const t0 = Date.now()
        const deals = await fetchOpenDealsInStage(rule.stageId)
        console.log(`[cron] stage ${rule.stageId} fetched ${deals.length} deals in ${Date.now() - t0}ms`)
        return { rule, categoryId, deals }
      } catch (err) {
        console.error(`[cron] fetchOpenDealsInStage(${rule.stageId}) failed:`, err)
        return { rule, categoryId, deals: null }
      }
    })
  )
  console.log('[cron] Pipedrive fetches done', new Date().toISOString())

  for (const { rule, categoryId, deals } of stageResults) {
    if (!categoryId) {
      summary.push(`SKIP ${rule.categoryName}: not in DB`)
      continue
    }
    if (!deals) {
      summary.push(`ERROR ${rule.categoryName}: Pipedrive fetch failed`)
      continue
    }

    // Filter overdue deals first, before any DB queries
    const overdueDealIds = deals
      .filter(deal => {
        const hours = hoursElapsed(deal[rule.timestampField])
        return hours >= rule.thresholdHours &&
          (!rule.maxThresholdHours || hours <= rule.maxThresholdHours)
      })
      .map(deal => deal.id)

    if (overdueDealIds.length === 0) {
      summary.push(`${rule.categoryName}: ${deals.length} deals en stage, 0 tickets creados, 0 ya existían`)
      continue
    }

    // Batch deduplication: one query for all overdue deals in this category
    const { data: existingTickets } = await admin
      .from('tickets')
      .select('pipedrive_deal_id')
      .eq('category_id', categoryId)
      .in('status', ['new', 'in_progress', 'waiting_on_employee'])
      .in('pipedrive_deal_id', overdueDealIds)

    const existingDealIds = new Set((existingTickets ?? []).map(t => t.pipedrive_deal_id))

    let created = 0
    let skipped = 0

    for (const deal of deals) {
      const hours = hoursElapsed(deal[rule.timestampField])
      if (hours < rule.thresholdHours) continue
      if (rule.maxThresholdHours && hours > rule.maxThresholdHours) continue

      const dealId = deal.id

      if (existingDealIds.has(dealId)) { skipped++; continue }

      // Advance round-robin per deal so each ticket goes to the next person
      const assigneeId = await resolveOwner(categoryId)

      const bankName     = (deal[FIELD_BANK_NAME] as string | null)
        ?? (deal.title as string | null)
        ?? `Deal #${dealId}`
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

      const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

      const { error: insertErr } = await admin.from('tickets').insert({
        created_by:        null,
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
