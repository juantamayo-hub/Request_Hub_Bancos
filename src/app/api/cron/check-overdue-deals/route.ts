import { NextRequest, NextResponse }                    from 'next/server'
import { createAdminClient }                            from '@/lib/supabase/admin'
import { fetchOpenDealsInStage, fetchDealStageId, updateDealField, FIELD_DEAL_SUMMARY } from '@/lib/pipedrive'
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

  // ── Pass 1: Snooze re-open ────────────────────────────────────
  {
    const { data: snoozedTickets } = await admin
      .from('tickets')
      .select('id, snoozed_until, snooze_previous_status')
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
      ])
    }
    if ((snoozedTickets ?? []).length > 0) {
      console.log(`[cron] snooze-reopen: reopened ${snoozedTickets!.length} tickets`)
    }
  }

  // ── Pass 2: Auto-close tickets whose deal has progressed ─────
  {
    // Fetch all relevant category IDs (system + non-system)
    const { data: allCats } = await admin
      .from('categories')
      .select('id, name')
      .in('name', AUTO_CLOSE_RULES.map(r => r.categoryName))

    if (allCats && allCats.length > 0) {
      const allCatMap = new Map(allCats.map(c => [c.name, c.id as string]))

      // Fetch open tickets for these categories with a deal ID
      const catIds = allCats.map(c => c.id as string)
      const { data: openTickets } = await admin
        .from('tickets')
        .select('id, status, category_id, pipedrive_deal_id')
        .in('category_id', catIds)
        .in('status', ['new', 'in_progress', 'waiting_on_employee'])
        .not('pipedrive_deal_id', 'is', null)

      if (openTickets && openTickets.length > 0) {
        // Fetch current stage for all deals in parallel
        const dealIds = [...new Set(openTickets.map(t => t.pipedrive_deal_id as number))]
        const stageMap = new Map<number, number | null>()
        await Promise.all(
          dealIds.map(async dealId => {
            const stage = await fetchDealStageId(dealId)
            stageMap.set(dealId, stage)
          }),
        )

        // Build category id → trigger stage map
        const catTriggerMap = new Map<string, number>()
        for (const rule of AUTO_CLOSE_RULES) {
          const catId = allCatMap.get(rule.categoryName)
          if (catId) catTriggerMap.set(catId, rule.triggerStage)
        }

        for (const ticket of openTickets) {
          const triggerStage = catTriggerMap.get(ticket.category_id as string)
          if (triggerStage === undefined) continue
          const currentStage = stageMap.get(ticket.pipedrive_deal_id as number)
          if (currentStage === null || currentStage === undefined) continue
          if (!isPastStage(currentStage, triggerStage)) continue

          // Close this ticket
          await admin.from('tickets').update({ status: 'closed' }).eq('id', ticket.id)

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
              metadata:   { auto: true, reason: 'deal_stage_progressed', stage: currentStage },
            }),
            admin.from('ticket_status_history').insert({
              ticket_id:  ticket.id,
              status:     'closed',
              changed_by: '00000000-0000-0000-0000-000000000000',
            }),
            admin.from('ticket_comments').insert({
              ticket_id:  ticket.id,
              author_id:  '00000000-0000-0000-0000-000000000000',
              body:       `Ticket cerrado automáticamente. El deal ha avanzado al stage ${currentStage}.`,
              visibility: 'internal',
            }),
          ])

          // 7.4 — deal summary
          if (lastComment?.body && ticket.pipedrive_deal_id) {
            updateDealField(ticket.pipedrive_deal_id as number, FIELD_DEAL_SUMMARY, lastComment.body).catch(console.error)
          }
        }
      }
    }
  }

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
