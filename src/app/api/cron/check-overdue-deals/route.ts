import { NextRequest, NextResponse }                    from 'next/server'
import { createAdminClient }                            from '@/lib/supabase/admin'
import { fetchOpenDealsInStage }                        from '@/lib/pipedrive'
import { postSlackDM, buildCronSummaryMessage }         from '@/lib/notifications/slack'

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

// Returns 'high' if the deal just entered the overdue window (< 2× threshold),
// 'medium' if it has been stuck longer. FEIN is always 'high'.
function derivePriority(rule: OverdueRule, hours: number): 'high' | 'medium' {
  if (!rule.maxThresholdHours) return 'high'              // FEIN (no upper bound set)
  const highCeiling = rule.thresholdHours * 2             // e.g. BS: 96h, Val: 240h
  return hours <= highCeiling ? 'high' : 'medium'
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


  let totalCreated = 0
  const summary: string[] = []

  // Per-assignee summary: email → [{ categoryName, count }]
  const assigneeSummaries = new Map<string, Array<{ categoryName: string; count: number }>>()

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

    // Deals that truly need a new ticket
    const newDeals = deals.filter(deal => {
      const hours = hoursElapsed(deal[rule.timestampField])
      if (hours < rule.thresholdHours) return false
      if (rule.maxThresholdHours && hours > rule.maxThresholdHours) return false
      return !existingDealIds.has(deal.id)
    })

    const skipped = overdueDealIds.length - newDeals.length

    if (newDeals.length === 0) {
      summary.push(`${rule.categoryName}: ${deals.length} deals en stage, 0 tickets creados, ${skipped} ya existían`)
      continue
    }

    // Batch round-robin: single RPC returns one email per new deal
    const { data: assigneeEmails } = await admin.rpc('pick_assignees_batch', {
      p_category_id: categoryId,
      p_count:       newDeals.length,
    })

    // Batch resolve unique emails → profile ids
    const emailList  = [...new Set((assigneeEmails as string[] | null) ?? [])]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email')
      .in('email', emailList)
    const emailToId = new Map((profiles ?? []).map(p => [p.email, p.id as string]))

    const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Build all rows, then bulk insert in one request
    const rows = newDeals.map((deal, i) => {
      const email      = (assigneeEmails as string[] | null)?.[i] ?? null
      const assigneeId = email ? (emailToId.get(email) ?? null) : null
      const dealId     = deal.id
      const bankName   = (deal[FIELD_BANK_NAME] as string | null)
        ?? (deal.title as string | null)
        ?? `Deal #${dealId}`
      const clientName = deal.person_id?.name ?? null
      const hours      = hoursElapsed(deal[rule.timestampField])
      const description = [
        `Deal #${dealId} lleva ${formatDuration(hours)} en stage ${rule.stageName}.`,
        `Banco: ${bankName}`,
        `Responsable en Pipedrive: ${(deal.user_id as { name?: string } | null)?.name ?? 'Sin asignar'}`,
        `Ver deal: https://app.pipedrive.com/deal/${dealId}`,
        ``,
        `Ticket generado automáticamente por Request Hub Bancos.`,
      ].join('\n')

      return {
        created_by:        null,
        assignee_id:       assigneeId,
        category_id:       categoryId,
        subject:           `[Auto] ${rule.categoryName} – Deal #${dealId} – ${bankName}`,
        description,
        priority:          derivePriority(rule, hours),
        status:            'new' as const,
        sla_hours:         48,
        sla_deadline:      slaDeadline,
        bank_name:         bankName,
        client_name:       clientName,
        pipedrive_deal_id: dealId,
      }
    })

    const { error: insertErr } = await admin.from('tickets').insert(rows)
    if (insertErr) {
      console.error(`[cron] bulk insert error category=${rule.categoryName}:`, insertErr)
    }

    const created = insertErr ? 0 : newDeals.length
    totalCreated += created

    // Accumulate per-assignee counts for summary DM
    if (!insertErr) {
      for (let i = 0; i < newDeals.length; i++) {
        const email = (assigneeEmails as string[] | null)?.[i]
        if (!email) continue
        if (!assigneeSummaries.has(email)) assigneeSummaries.set(email, [])
        const entries = assigneeSummaries.get(email)!
        let entry = entries.find(e => e.categoryName === rule.categoryName)
        if (!entry) { entry = { categoryName: rule.categoryName, count: 0 }; entries.push(entry) }
        entry.count++
      }
    }
    summary.push(
      `${rule.categoryName}: ${deals.length} deals en stage, ${created} tickets creados, ${skipped} ya existían`,
    )
  }

  // ── Send one summary DM per assignee ─────────────────────────
  if (assigneeSummaries.size > 0) {
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const timeLabel = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    })
    await Promise.all(
      Array.from(assigneeSummaries.entries()).map(([email, cats]) => {
        const total = cats.reduce((s, c) => s + c.count, 0)
        return postSlackDM(email, buildCronSummaryMessage({ timeLabel, appUrl, categories: cats.map(c => ({ name: c.categoryName, count: c.count })), total }))
      }),
    )
  }

  const result = { ok: true, totalCreated, summary, runAt: new Date().toISOString() }
  console.log('[cron/check-overdue-deals]', JSON.stringify(result))
  return NextResponse.json(result)
}
