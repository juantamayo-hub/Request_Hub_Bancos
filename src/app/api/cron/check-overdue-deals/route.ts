import { NextRequest, NextResponse }                    from 'next/server'
import { createAdminClient }                            from '@/lib/supabase/admin'
import { fetchOpenDealsInStage, updateDealField, FIELD_DEAL_SUMMARY, type StageDeal } from '@/lib/pipedrive'
import { postSlackDM, buildCronSummaryMessage, buildSnoozeReopenedMessage } from '@/lib/notifications/slack'
import { isConfigured, listSheetNames, fetchDealScoringData, DealScoringData } from '@/lib/sheets'

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
    thresholdHours: 240, // 10 days
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

// ── Stage order for auto-close ────────────────────────────────

const STAGE_ORDER = [70, 71, 79, 72, 73, 74, 75]

function isPastStage(currentStage: number, triggerStage: number): boolean {
  const ci = STAGE_ORDER.indexOf(currentStage)
  const ti = STAGE_ORDER.indexOf(triggerStage)
  return ci > ti && ci !== -1 && ti !== -1
}

interface AutoCloseRule {
  categoryName: string
  triggerStage: number
}

const AUTO_CLOSE_RULES: AutoCloseRule[] = [
  { categoryName: 'Bank Submission Overdue',  triggerStage: 70 },
  { categoryName: 'Valuation Overdue',        triggerStage: 72 },
  { categoryName: 'FEIN Overdue',             triggerStage: 73 },
  { categoryName: 'Acelerar emisión de FEIN', triggerStage: 73 },
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

// Score = 0.8 × (prob / 0.50) + 0.2 × (revenue / maxRevenue)
// High: >= 0.05 | Medium: >= 0.008 | Low: < 0.008
// Returns null when deal is not found in scoring data (caller falls back to time-based).
function derivePriorityFromScore(
  dealId: number,
  scoring: DealScoringData | null,
): 'high' | 'medium' | 'low' | null {
  if (!scoring) return null

  const prob    = scoring.probabilityByDealId.get(dealId)
  const revenue = scoring.revenueByDealId.get(dealId)

  if (prob === undefined && revenue === undefined) return null

  const probScore    = prob    !== undefined ? Math.min(prob / 0.50, 1) * 0.8 : 0
  const revenueScore = (revenue !== undefined && scoring.maxRevenue > 0)
    ? (revenue / scoring.maxRevenue) * 0.2
    : 0

  const score = probScore + revenueScore

  if (score >= 0.05) return 'high'
  if (score >= 0.008) return 'medium'
  return 'low'
}

function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24)
  const rem  = Math.floor(hours % 24)
  if (days === 0) return `${Math.floor(hours)} horas`
  return rem > 0 ? `${days} días y ${rem}h` : `${days} días`
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)),
  ])
}

// ── Cron handler ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startedAt = Date.now()

  // Verify Vercel Cron secret (set CRON_SECRET in Vercel env vars)
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stageIdParam = request.nextUrl.searchParams.get('stageId')
  const modeParam    = request.nextUrl.searchParams.get('mode')
  const runMode      = modeParam ?? 'full'

  if (modeParam && modeParam !== 'autoclose') {
    return NextResponse.json({ error: 'Invalid mode. Use mode=autoclose.' }, { status: 400 })
  }

  if (modeParam === 'autoclose' && stageIdParam) {
    return NextResponse.json({ error: 'stageId is not compatible with mode=autoclose.' }, { status: 400 })
  }

  let selectedStageId: number | null = null
  if (stageIdParam) {
    const parsedStageId = Number(stageIdParam)
    if (!Number.isInteger(parsedStageId) || parsedStageId <= 0) {
      return NextResponse.json({ error: 'Invalid stageId.' }, { status: 400 })
    }
    selectedStageId = parsedStageId
  }
  if (stageIdParam && selectedStageId === null) {
    return NextResponse.json({ error: 'Invalid stageId.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const isAutoCloseOnly = runMode === 'autoclose'
  const shouldCreateOverdueTickets = !isAutoCloseOnly

  const targetRules = selectedStageId === null
    ? OVERDUE_RULES
    : OVERDUE_RULES.filter(rule => rule.stageId === selectedStageId)

  if (selectedStageId !== null && targetRules.length === 0) {
    return NextResponse.json({ error: `Unsupported stageId: ${selectedStageId}` }, { status: 400 })
  }

  const categoryMap = new Map<string, string>()
  if (shouldCreateOverdueTickets) {
    // Load all system categories (name → id)
    const { data: cats, error: catsErr } = await admin
      .from('categories')
      .select('id, name')
      .eq('is_system', true)

    if (catsErr || !cats?.length) {
      console.error('[cron] failed to load system categories:', catsErr)
      return NextResponse.json({ error: 'System categories not found' }, { status: 500 })
    }

    for (const cat of cats) categoryMap.set(cat.name, cat.id as string)
  }

  // ── Load scoring data from Google Sheets (optional) ───────────
  let scoringData: DealScoringData | null = null
  if (shouldCreateOverdueTickets && isConfigured()) {
    try {
      const sheetNames = await listSheetNames()
      scoringData = await fetchDealScoringData(sheetNames)
      console.log('[cron] scoring data loaded from Sheets')
    } catch (err) {
      console.warn('[cron] failed to load scoring data from Sheets (falling back to time-based priority):', err)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  let reopenedCount = 0
  let autoClosedCount = 0

  // ── Pass 1: Snooze re-open ────────────────────────────────────
  if (!shouldCreateOverdueTickets || selectedStageId === null) {
    const { data: snoozedTickets } = await admin
      .from('tickets')
      .select(`
        id, snoozed_until, snooze_previous_status, display_id, subject,
        assignee:profiles!tickets_assignee_id_fkey(email)
      `)
      .eq('status', 'closed')
      .not('snoozed_until', 'is', null)
      .lte('snoozed_until', new Date().toISOString())

    for (const t of snoozedTickets ?? []) {
      const prevStatus = (t.snooze_previous_status as string | null) ?? 'in_progress'
      await admin.from('tickets').update({
        status:                 prevStatus,
        snoozed_until:          null,
        snooze_previous_status: null,
      }).eq('id', t.id)

      const assigneeRaw   = t.assignee as unknown
      const assigneeEmail = Array.isArray(assigneeRaw)
        ? (assigneeRaw[0] as { email: string } | undefined)?.email
        : (assigneeRaw as { email: string } | null)?.email

      await Promise.all([
        admin.from('audit_log').insert({
          ticket_id:  t.id,
          actor_id:   '00000000-0000-0000-0000-000000000000',
          action:     'status_changed',
          from_value: 'closed',
          to_value:   prevStatus,
          metadata:   { auto: true, reason: 'snooze_expired' },
        }),
        admin.from('ticket_comments').insert({
          ticket_id:  t.id,
          author_id:  '00000000-0000-0000-0000-000000000000',
          body:       'Ticket reabierto automáticamente.',
          visibility: 'internal',
        }),
        assigneeEmail
          ? postSlackDM(assigneeEmail, buildSnoozeReopenedMessage({
              displayId: t.display_id as string,
              subject:   t.subject   as string,
              ticketId:  t.id,
              appUrl:    appUrl,
            }))
          : Promise.resolve(),
      ])
    }
    reopenedCount = (snoozedTickets ?? []).length
    if ((snoozedTickets ?? []).length > 0) {
      console.log(`[cron] snooze-reopen: reopened ${snoozedTickets!.length} tickets`)
    }
  }

  // ── Pre-fetch open deals per stage (reused in Pass 2 + Pass 3) ─
  // This replaces N individual fetchDealStageId() calls with 3 bulk stage fetches,
  // avoiding Pipedrive rate-limit issues and drastically reducing API usage.
  console.log('[cron] starting Pipedrive stage fetches', new Date().toISOString())
  const openDealsPerStage = new Map<number, StageDeal[]>()
  const stageFetchRules = isAutoCloseOnly ? OVERDUE_RULES : targetRules
  const stageResults = await Promise.all(
    stageFetchRules.map(async rule => {
      const categoryId = shouldCreateOverdueTickets ? (categoryMap.get(rule.categoryName) ?? null) : null
      if (shouldCreateOverdueTickets && !categoryId) return { rule, categoryId: null, deals: [] as StageDeal[] }
      try {
        const t0 = Date.now()
        const deals = await fetchOpenDealsInStage(rule.stageId)
        console.log(`[cron] stage ${rule.stageId} fetched ${deals.length} deals in ${Date.now() - t0}ms`)
        openDealsPerStage.set(rule.stageId, deals)
        return { rule, categoryId, deals }
      } catch (err) {
        console.error(`[cron] fetchOpenDealsInStage(${rule.stageId}) failed:`, err)
        return { rule, categoryId, deals: null as StageDeal[] | null }
      }
    })
  )
  console.log('[cron] Pipedrive stage fetches done', new Date().toISOString())

  // Build deal-ID sets per trigger stage for fast O(1) lookup
  const dealIdsInStage = new Map<number, Set<number>>()
  for (const [stageId, deals] of openDealsPerStage.entries()) {
    dealIdsInStage.set(stageId, new Set(deals.map(d => d.id)))
  }

  // ── Pass 2: Auto-close tickets whose deal has progressed ─────
  // Logic: if the deal is no longer among the open deals in its trigger stage,
  // the deal has advanced (or was won/lost) and the ticket can be closed.
  if (!shouldCreateOverdueTickets || selectedStageId === null) {
    // Fetch all relevant category IDs (system + non-system)
    const { data: allCats } = await admin
      .from('categories')
      .select('id, name')
      .in('name', AUTO_CLOSE_RULES.map(r => r.categoryName))

    if (allCats && allCats.length > 0) {
      const allCatMap = new Map(allCats.map(c => [c.name, c.id as string]))

      // Build category id → trigger stage map
      const catTriggerMap = new Map<string, number>()
      for (const rule of AUTO_CLOSE_RULES) {
        const catId = allCatMap.get(rule.categoryName)
        if (catId) catTriggerMap.set(catId, rule.triggerStage)
      }

      // Fetch open tickets for these categories with a deal ID
      const catIds = allCats.map(c => c.id as string)
      const { data: openTickets } = await admin
        .from('tickets')
        .select('id, status, category_id, pipedrive_deal_id')
        .in('category_id', catIds)
        .in('status', ['new', 'in_progress', 'waiting_on_employee'])
        .not('pipedrive_deal_id', 'is', null)

      let autoClosedCountRun = 0
      for (const ticket of openTickets ?? []) {
        const triggerStage = catTriggerMap.get(ticket.category_id as string)
        if (triggerStage === undefined) continue

        const idsInTriggerStage = dealIdsInStage.get(triggerStage)
        // If we successfully fetched the stage list and the deal is still there → keep open
        if (idsInTriggerStage && idsInTriggerStage.has(ticket.pipedrive_deal_id as number)) continue
        // Deal is no longer in trigger stage (advanced, won, or lost) → close
        // Skip if we don't have data for this trigger stage (fetch failed) to avoid false closes
        if (!idsInTriggerStage) continue

        // Close this ticket
        await admin.from('tickets').update({ status: 'closed' }).eq('id', ticket.id)
        autoClosedCountRun++

        // Fetch last public comment for deal summary
        const { data: lastComment } = await admin
          .from('ticket_comments')
          .select('body')
          .eq('ticket_id', ticket.id)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        await Promise.all([
          admin.from('audit_log').insert({
            ticket_id:  ticket.id,
            actor_id:   '00000000-0000-0000-0000-000000000000',
            action:     'status_changed',
            from_value: ticket.status as string,
            to_value:   'closed',
            metadata:   { auto: true, reason: 'deal_left_trigger_stage', triggerStage },
          }),
          admin.from('ticket_status_history').insert({
            ticket_id:  ticket.id,
            status:     'closed',
            changed_by: '00000000-0000-0000-0000-000000000000',
          }),
          admin.from('ticket_comments').insert({
            ticket_id:  ticket.id,
            author_id:  '00000000-0000-0000-0000-000000000000',
            body:       `Ticket cerrado automáticamente. El deal ya no está en el stage de origen (${triggerStage}).`,
            visibility: 'internal',
          }),
        ])

        if (lastComment?.body && ticket.pipedrive_deal_id) {
          updateDealField(ticket.pipedrive_deal_id as number, FIELD_DEAL_SUMMARY, lastComment.body).catch(console.error)
        }
      }
      autoClosedCount = autoClosedCountRun
      if (autoClosedCountRun > 0) {
        console.log(`[cron] auto-close: closed ${autoClosedCountRun} tickets`)
      }
    }
  }

  let totalCreated = 0
  const summary: string[] = []

  // Per-assignee summary: email → [{ categoryName, count }]
  const assigneeSummaries = new Map<string, Array<{ categoryName: string; count: number }>>()

  for (const { rule, categoryId, deals } of stageResults) {
    if (!shouldCreateOverdueTickets) break
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

      const scorePriority = derivePriorityFromScore(dealId, scoringData)

      return {
        created_by:        null,
        assignee_id:       assigneeId,
        category_id:       categoryId,
        subject:           `[Auto] ${rule.categoryName} – Deal #${dealId} – ${bankName}`,
        description,
        priority:          scorePriority ?? derivePriority(rule, hours),
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
    const timeLabel = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    })
    const dmResults = await Promise.allSettled(
      Array.from(assigneeSummaries.entries()).map(async ([email, cats]) => {
        const total = cats.reduce((s, c) => s + c.count, 0)
        return withTimeout(
          postSlackDM(
            email,
            buildCronSummaryMessage({
              timeLabel,
              appUrl,
              categories: cats.map(c => ({ name: c.categoryName, count: c.count })),
              total,
            }),
          ),
          3000,
        )
      }),
    )
    const failedDmCount = dmResults.filter(r => r.status === 'rejected').length
    if (failedDmCount > 0) {
      console.warn(`[cron] failed to send ${failedDmCount} Slack summary DMs`)
    }
  }

  const result = {
    ok: true,
    mode: isAutoCloseOnly ? 'autoclose' : (selectedStageId === null ? 'full' : `stage:${selectedStageId}`),
    processedStages: stageFetchRules.map(r => r.stageId),
    totalCreated,
    reopenedCount,
    autoClosedCount,
    summary,
    durationMs: Date.now() - startedAt,
    runAt: new Date().toISOString(),
  }
  console.log('[cron/check-overdue-deals]', JSON.stringify(result))
  return NextResponse.json(result)
}
