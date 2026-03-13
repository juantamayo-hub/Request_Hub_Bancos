import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { CommandStrip } from '@/components/dashboard/CommandStrip'
import { SLAHealthRing } from '@/components/dashboard/SLAHealthRing'
import { AgingDistribution } from '@/components/dashboard/AgingDistribution'
import { AtRiskTicketList } from '@/components/dashboard/AtRiskTicketList'
import { StatusPipeline } from '@/components/dashboard/StatusPipeline'
import { CategoryWorkload } from '@/components/dashboard/CategoryWorkload'
import { PriorityDistribution } from '@/components/dashboard/PriorityDistribution'
import { VelocityChart } from '@/components/dashboard/VelocityChart'
import { WoWSummaryStrip } from '@/components/dashboard/WoWSummaryStrip'
import type { DashboardMetrics, AtRiskTicket, TicketPriority } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const profile  = await requireAdmin()
  const supabase = await createClient()

  const now            = new Date()
  const sevenDaysAgo   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)

  // ── Core counts ──────────────────────────────────────────────
  const [total, open, newC, inProgress, waiting, resolved, closed, slaBreaching] =
    await Promise.all([
      supabase.from('tickets').select('*', { count: 'exact', head: true }),
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .not('status', 'in', '(resolved,closed)'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'waiting_on_employee'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .not('status', 'in', '(resolved,closed)')
        .not('sla_deadline', 'is', null)
        .lt('sla_deadline', now.toISOString()),
    ])

  // ── Avg resolution (all time) ─────────────────────────────────
  const { data: resolvedTickets } = await supabase
    .from('tickets')
    .select('created_at, resolved_at')
    .in('status', ['resolved', 'closed'])
    .not('resolved_at', 'is', null)

  const avgResolutionDays = computeAvgResolution(resolvedTickets ?? [])

  // ── New queries (all in parallel) ────────────────────────────
  const [
    openTicketsDetail,
    categories,
    atRiskRaw,
    recentOpened,
    recentClosed,
    prevWeekOpenResult,
    prevWeekSlaResult,
    prevWeekResolvedTickets,
  ] = await Promise.all([
    // Open ticket detail for priority/age/support-type distribution
    supabase
      .from('tickets')
      .select('category_id, priority, created_at, subcategory')
      .not('status', 'in', '(resolved,closed)'),

    // Active categories for name lookup
    supabase.from('categories').select('id, name').eq('is_active', true),

    // At-risk: SLA deadline within 4h or already past
    supabase
      .from('tickets')
      .select('id, display_id, subject, category_id, sla_deadline')
      .not('status', 'in', '(resolved,closed)')
      .not('sla_deadline', 'is', null)
      .lte('sla_deadline', fourHoursFromNow.toISOString())
      .order('sla_deadline', { ascending: true })
      .limit(5),

    // Velocity: opened last 7 days
    supabase
      .from('tickets')
      .select('created_at')
      .gte('created_at', sevenDaysAgo.toISOString()),

    // Velocity: closed last 7 days
    supabase
      .from('tickets')
      .select('resolved_at')
      .in('status', ['resolved', 'closed'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', sevenDaysAgo.toISOString()),

    // Prev-week open ticket count proxy (opened that week, now open)
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '(resolved,closed)')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString()),

    // Prev-week SLA breaching snapshot
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '(resolved,closed)')
      .not('sla_deadline', 'is', null)
      .lt('sla_deadline', sevenDaysAgo.toISOString()),

    // Prev-week resolved tickets for avg resolution
    supabase
      .from('tickets')
      .select('created_at, resolved_at')
      .in('status', ['resolved', 'closed'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', fourteenDaysAgo.toISOString())
      .lt('resolved_at', sevenDaysAgo.toISOString()),
  ])

  // ── Derive: age distribution ──────────────────────────────────
  const ageBuckets = { '1-3d': 0, '3-7d': 0, '7d+': 0 }
  for (const t of openTicketsDetail.data ?? []) {
    const ageDays = (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays < 3) ageBuckets['1-3d']++
    else if (ageDays < 7) ageBuckets['3-7d']++
    else ageBuckets['7d+']++
  }
  const ageDistribution: DashboardMetrics['ageDistribution'] = [
    { bucket: '1-3d', count: ageBuckets['1-3d'] },
    { bucket: '3-7d', count: ageBuckets['3-7d'] },
    { bucket: '7d+',  count: ageBuckets['7d+']  },
  ]

  // ── Derive: category workload (by form support type) ──────────
  // The at-risk lookup still needs the DB category name
  const categoryMap = Object.fromEntries(
    (categories.data ?? []).map(c => [c.id, c.name]),
  )
  // Map subcategory values → the 7 top-level form support types
  const SUBCATEGORY_TO_SUPPORT_TYPE: Record<string, string> = {
    'NOC for Travel':       'Documents',
    'NOC for Golden Visa':  'Documents',
    'Employment Letter':    'Documents',
    'Salary Certificate':   'Documents',
    'Payslips':             'Documents',
    'Other Document':       'Documents',
    'Visa':                 'Visa Queries',
    'Visa Queries':         'Visa Queries',
    'Health Insurance':     'Health Insurance',
    'Parking Application':  'Parking',
    'Parking Update':       'Parking',
    'Parking Cancellation': 'Parking',
    'Time-Off':             'Time-Off',
    'Revolut Adjustment':   'Revolut Adjustments',
    'Other':                'Other',
  }
  const SUPPORT_TYPES = [
    'Documents', 'Visa Queries', 'Health Insurance', 'Parking', 'Time-Off', 'Revolut Adjustments', 'Other',
  ]
  const supportTypeCounts: Record<string, number> = Object.fromEntries(
    SUPPORT_TYPES.map(t => [t, 0]),
  )
  for (const t of openTicketsDetail.data ?? []) {
    const label = SUBCATEGORY_TO_SUPPORT_TYPE[t.subcategory ?? ''] ?? 'Other'
    supportTypeCounts[label]++
  }
  const ticketsByCategory = SUPPORT_TYPES
    .map(name => ({ categoryId: name, name, count: supportTypeCounts[name] }))
    .sort((a, b) => b.count - a.count)

  // ── Derive: priority distribution ────────────────────────────
  const priorityCounts: Record<TicketPriority, number> = { low: 0, medium: 0, high: 0 }
  for (const t of openTicketsDetail.data ?? []) {
    const p = t.priority as TicketPriority
    if (p in priorityCounts) priorityCounts[p]++
  }
  const ticketsByPriority: DashboardMetrics['ticketsByPriority'] = [
    { priority: 'high',   count: priorityCounts.high   },
    { priority: 'medium', count: priorityCounts.medium },
    { priority: 'low',    count: priorityCounts.low    },
  ]

  // ── Derive: at-risk tickets ───────────────────────────────────
  const atRiskTickets: AtRiskTicket[] = (atRiskRaw.data ?? []).slice(0, 3).map(t => ({
    id:        t.id,
    displayId: t.display_id,
    subject:   t.subject,
    category:  categoryMap[t.category_id] ?? t.category_id,
    deadline:  t.sla_deadline!,
    status:    new Date(t.sla_deadline!) < now ? 'breaching' : 'at-risk',
  }))

  // ── Derive: velocity last 7 days ─────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const openedByDay = Object.fromEntries(last7Days.map(d => [d, 0]))
  const closedByDay = Object.fromEntries(last7Days.map(d => [d, 0]))
  for (const t of recentOpened.data ?? []) {
    const day = t.created_at.slice(0, 10)
    if (day in openedByDay) openedByDay[day]++
  }
  for (const t of recentClosed.data ?? []) {
    const day = (t.resolved_at ?? '').slice(0, 10)
    if (day in closedByDay) closedByDay[day]++
  }
  const velocityLast7Days = last7Days.map(date => ({
    date,
    opened: openedByDay[date],
    closed: closedByDay[date],
  }))

  // ── Prev-week KPIs ────────────────────────────────────────────
  const prevWeekOpen          = prevWeekOpenResult.count  ?? 0
  const prevWeekSlaBreaching  = prevWeekSlaResult.count   ?? 0
  const prevWeekAvgResolution = computeAvgResolution(prevWeekResolvedTickets.data ?? [])

  // ── Aging: existing field for backward compat ─────────────────
  const agingCount = ageBuckets['7d+']

  // ── Assemble metrics ──────────────────────────────────────────
  const metrics: DashboardMetrics = {
    totalTickets:        total.count      ?? 0,
    openTickets:         open.count       ?? 0,
    newCount:            newC.count       ?? 0,
    inProgressCount:     inProgress.count ?? 0,
    waitingCount:        waiting.count    ?? 0,
    resolvedCount:       resolved.count   ?? 0,
    closedCount:         closed.count     ?? 0,
    slaBreaching:        slaBreaching.count ?? 0,
    agingTickets:        agingCount,
    avgResolutionDays:   Math.round(avgResolutionDays * 10) / 10,
    ticketsByCategory,
    ticketsByPriority,
    ageDistribution,
    atRiskTickets,
    velocityLast7Days,
    prevWeekOpen,
    prevWeekSlaBreaching,
    prevWeekAvgResolution: Math.round(prevWeekAvgResolution * 10) / 10,
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar profile={profile} isAdmin />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Operations overview</p>
        </div>

        {/* ── Zone 1: Command Strip ───────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
          <div className="px-6 pt-4 pb-0 border-b border-gray-50">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
              Today at a Glance
            </p>
          </div>
          <CommandStrip metrics={metrics} />
        </div>

        {/* ── Zones 2 + 3: Health & Operational Load ──────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">

          {/* Zone 2 — Health & Risk (40%) */}
          <div className="md:col-span-2 space-y-6">

            {/* 2a + 2b: SLA Ring + Aging */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Health & Risk
              </p>
              <div className="flex items-start gap-6">
                <SLAHealthRing
                  openTickets={metrics.openTickets}
                  slaBreaching={metrics.slaBreaching}
                />
                <div className="flex-1 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                    Ticket Age
                  </p>
                  <AgingDistribution
                    ageDistribution={metrics.ageDistribution}
                    openTickets={metrics.openTickets}
                  />
                </div>
              </div>
            </div>

            {/* 2c: At-Risk Tickets */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                At-Risk Tickets
              </p>
              <AtRiskTicketList tickets={metrics.atRiskTickets} />
            </div>
          </div>

          {/* Zone 3 — Operational Load (60%) */}
          <div className="md:col-span-3 space-y-6">

            {/* 3a: Status Pipeline */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Status Pipeline
              </p>
              <StatusPipeline metrics={metrics} />
            </div>

            {/* 3b: Category Workload */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Category Workload
              </p>
              <CategoryWorkload ticketsByCategory={metrics.ticketsByCategory} />
            </div>

            {/* 3c: Priority Distribution */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Priority Distribution
              </p>
              <PriorityDistribution
                ticketsByPriority={metrics.ticketsByPriority}
                openTickets={metrics.openTickets}
              />
            </div>
          </div>
        </div>

        {/* ── Zone 4: Performance Trends ──────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Performance Trends
          </p>
          <VelocityChart velocityLast7Days={metrics.velocityLast7Days} />
          <div className="mt-4 pt-4 border-t border-gray-50">
            <WoWSummaryStrip
              velocityLast7Days={metrics.velocityLast7Days}
              avgResolutionDays={metrics.avgResolutionDays}
              prevWeekAvgResolution={metrics.prevWeekAvgResolution}
            />
          </div>
        </div>

      </main>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────

function computeAvgResolution(
  tickets: { created_at: string; resolved_at: string | null }[],
): number {
  const valid = tickets.filter(t => t.resolved_at)
  if (valid.length === 0) return 0
  const totalMs = valid.reduce(
    (sum, t) =>
      sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()),
    0,
  )
  return totalMs / valid.length / (1000 * 60 * 60 * 24)
}
