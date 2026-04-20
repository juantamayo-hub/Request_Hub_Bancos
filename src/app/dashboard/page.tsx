import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { CommandStrip } from '@/components/dashboard/CommandStrip'
import { SLAHealthRing } from '@/components/dashboard/SLAHealthRing'
import { AgingDistribution } from '@/components/dashboard/AgingDistribution'
import { AtRiskTicketList } from '@/components/dashboard/AtRiskTicketList'
import { StatusPipeline } from '@/components/dashboard/StatusPipeline'
import { OperationsBreakdown } from '@/components/dashboard/OperationsBreakdown'
import { PriorityDistribution } from '@/components/dashboard/PriorityDistribution'
import { VelocityChart } from '@/components/dashboard/VelocityChart'
import { WoWSummaryStrip } from '@/components/dashboard/WoWSummaryStrip'
import { PipedriveMetricsSection } from '@/components/dashboard/PipedriveMetricsSection'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { DashboardTabSwitcher } from '@/components/dashboard/DashboardTabSwitcher'
import { NegocioView } from '@/components/dashboard/NegocioView'
import { OwnerWorkload } from '@/components/dashboard/OwnerWorkload'
import type { DashboardMetrics, AtRiskTicket, TicketPriority } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Dashboard' }

// ─── Page ─────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; bank?: string; category?: string; tab?: string }>
}) {
  const profile = await requireAdmin()
  const params  = await searchParams

  // ── Negocio tab: skip all Supabase queries ────────────────
  if (params.tab === 'negocio') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
        <Navbar profile={profile} isAdmin />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Métricas de negocio</p>
          </div>
          <DashboardTabSwitcher active="negocio" />
          <Suspense>
            <NegocioView />
          </Suspense>
        </main>
      </div>
    )
  }

  const supabase = await createClient()

  // ── Date range ───────────────────────────────────────────────
  const now       = new Date()

  // Use local-time date strings to avoid UTC offset shifting Jan 1 → Dec 31
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const yearStartStr = `${now.getFullYear()}-01-01`
  const todayStr     = localDate(now)

  const fromStr  = params.from ?? yearStartStr
  const toStr    = params.to   ?? todayStr
  const fromDate = new Date(fromStr)
  const toDate   = new Date(toStr + 'T23:59:59')
  const fromISO  = fromDate.toISOString()
  const toISO    = toDate.toISOString()
  const fromLabel = fromDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  const toLabel   = toDate.toLocaleDateString('es-ES',   { day: '2-digit', month: 'short', year: 'numeric' })

  const sevenDaysAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
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

  // ── Avg resolution ────────────────────────────────────────────
  const { data: resolvedTickets } = await supabase
    .from('tickets')
    .select('created_at, resolved_at')
    .in('status', ['resolved', 'closed'])
    .not('resolved_at', 'is', null)

  const avgResolutionDays = computeAvgResolution(resolvedTickets ?? [])

  // ── Velocity, at-risk, prev-week (parallel) ───────────────────
  const [
    atRiskRaw,
    recentOpened,
    recentClosed,
    prevWeekOpenResult,
    prevWeekSlaResult,
    prevWeekResolvedTickets,
  ] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, display_id, subject, category_id, sla_deadline')
      .not('status', 'in', '(resolved,closed)')
      .not('sla_deadline', 'is', null)
      .lte('sla_deadline', fourHoursFromNow.toISOString())
      .order('sla_deadline', { ascending: true })
      .limit(5),

    supabase.from('tickets').select('created_at')
      .gte('created_at', sevenDaysAgo.toISOString()),

    supabase.from('tickets').select('resolved_at')
      .in('status', ['resolved', 'closed'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', sevenDaysAgo.toISOString()),

    supabase.from('tickets').select('*', { count: 'exact', head: true })
      .not('status', 'in', '(resolved,closed)')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString()),

    supabase.from('tickets').select('*', { count: 'exact', head: true })
      .not('status', 'in', '(resolved,closed)')
      .not('sla_deadline', 'is', null)
      .lt('sla_deadline', sevenDaysAgo.toISOString()),

    supabase.from('tickets').select('created_at, resolved_at')
      .in('status', ['resolved', 'closed'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', fourteenDaysAgo.toISOString())
      .lt('resolved_at', sevenDaysAgo.toISOString()),
  ])

  // ── Operations data (filtered by date range + optional bank/category) ──
  let opsQuery = supabase
    .from('tickets')
    .select('category_id, bank_name, status, priority, created_at, assignee_id')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)

  if (params.bank)     opsQuery = opsQuery.eq('bank_name',   params.bank)
  if (params.category) opsQuery = opsQuery.eq('category_id', params.category)

  const [opsResult, categoriesResult, allBanksResult, assigneeProfilesResult] = await Promise.all([
    opsQuery,
    supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
    supabase.from('tickets').select('bank_name').not('bank_name', 'is', null),
    supabase.from('profiles').select('id, email, first_name, last_name').eq('role', 'admin'),
  ])

  const opsTickets  = opsResult.data ?? []
  const categories  = categoriesResult.data ?? []
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))

  const assigneeProfiles = assigneeProfilesResult.data ?? []
  const profileMap       = Object.fromEntries(
    assigneeProfiles.map(p => [p.id, p.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : p.email])
  )

  // ── Derive: operations by category ──────────────────────────
  const catOps: Record<string, { open: number; closed: number }> = {}
  const bankOps: Record<string, { open: number; closed: number }> = {}
  const bankCatOps: Record<string, Record<string, { open: number; closed: number }>> = {}
  const ownerStats: Record<string, { name: string; new: number; in_progress: number; waiting: number; resolved_closed: number }> = {}
  const priorityCounts: Record<TicketPriority, number> = { low: 0, medium: 0, high: 0 }
  const ageBuckets = { '1-3d': 0, '3-7d': 0, '7d+': 0 }

  for (const t of opsTickets) {
    const catName  = categoryMap[t.category_id] ?? 'Otra'
    const bankName = t.bank_name ?? 'Sin banco'
    const isOpen   = !['resolved', 'closed'].includes(t.status)

    if (!catOps[catName])   catOps[catName]   = { open: 0, closed: 0 }
    if (!bankOps[bankName]) bankOps[bankName] = { open: 0, closed: 0 }
    if (!bankCatOps[bankName]) bankCatOps[bankName] = {}
    if (!bankCatOps[bankName][catName]) bankCatOps[bankName][catName] = { open: 0, closed: 0 }

    if (isOpen) {
      catOps[catName].open++
      bankOps[bankName].open++
      bankCatOps[bankName][catName].open++
      const p = t.priority as TicketPriority
      if (p in priorityCounts) priorityCounts[p]++
      const ageDays = (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays < 3) ageBuckets['1-3d']++
      else if (ageDays < 7) ageBuckets['3-7d']++
      else ageBuckets['7d+']++
    } else {
      catOps[catName].closed++
      bankOps[bankName].closed++
      bankCatOps[bankName][catName].closed++
    }

    // Owner workload
    const aid = (t as typeof t & { assignee_id?: string | null }).assignee_id
    if (aid && profileMap[aid]) {
      if (!ownerStats[aid]) ownerStats[aid] = { name: profileMap[aid], new: 0, in_progress: 0, waiting: 0, resolved_closed: 0 }
      const s = t.status
      if      (s === 'new')                   ownerStats[aid].new++
      else if (s === 'in_progress')            ownerStats[aid].in_progress++
      else if (s === 'waiting_on_employee')    ownerStats[aid].waiting++
      else                                     ownerStats[aid].resolved_closed++
    }
  }

  const ownerWorkload = Object.values(ownerStats)

  const operationsByCategory = Object.entries(catOps).map(([name, v]) => ({ name, ...v }))
  const operationsByBank     = Object.entries(bankOps).map(([name, v]) => ({
    name, ...v,
    categories: Object.entries(bankCatOps[name] ?? {}).map(([catName, cv]) => ({ name: catName, ...cv })),
  }))

  const ticketsByPriority: DashboardMetrics['ticketsByPriority'] = [
    { priority: 'high',   count: priorityCounts.high   },
    { priority: 'medium', count: priorityCounts.medium },
    { priority: 'low',    count: priorityCounts.low    },
  ]

  const ageDistribution: DashboardMetrics['ageDistribution'] = [
    { bucket: '1-3d', count: ageBuckets['1-3d'] },
    { bucket: '3-7d', count: ageBuckets['3-7d'] },
    { bucket: '7d+',  count: ageBuckets['7d+']  },
  ]

  // ── At-risk ───────────────────────────────────────────────────
  const atRiskTickets: AtRiskTicket[] = (atRiskRaw.data ?? []).slice(0, 3).map(t => ({
    id:        t.id,
    displayId: t.display_id,
    subject:   t.subject,
    category:  categoryMap[t.category_id] ?? t.category_id,
    deadline:  t.sla_deadline!,
    status:    new Date(t.sla_deadline!) < now ? 'breaching' : 'at-risk',
  }))

  // ── Velocity ──────────────────────────────────────────────────
  const last7Days    = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const openedByDay  = Object.fromEntries(last7Days.map(d => [d, 0]))
  const closedByDay  = Object.fromEntries(last7Days.map(d => [d, 0]))
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

  // ── Assemble core metrics ─────────────────────────────────────
  const metrics: DashboardMetrics = {
    totalTickets:        total.count      ?? 0,
    openTickets:         open.count       ?? 0,
    newCount:            newC.count       ?? 0,
    inProgressCount:     inProgress.count ?? 0,
    waitingCount:        waiting.count    ?? 0,
    resolvedCount:       resolved.count   ?? 0,
    closedCount:         closed.count     ?? 0,
    slaBreaching:        slaBreaching.count ?? 0,
    agingTickets:        ageBuckets['7d+'],
    avgResolutionDays:   Math.round(avgResolutionDays * 10) / 10,
    ticketsByCategory:   operationsByCategory.map(r => ({ categoryId: r.name, name: r.name, count: r.open })),
    ticketsByPriority,
    ageDistribution,
    atRiskTickets,
    velocityLast7Days,
    prevWeekOpen,
    prevWeekSlaBreaching,
    prevWeekAvgResolution: Math.round(prevWeekAvgResolution * 10) / 10,
  }

  // ── Filter options (from all tickets, not filtered set) ──────
  const uniqueBanks = Array.from(
    new Set((allBanksResult.data ?? []).map(t => t.bank_name).filter(Boolean) as string[]),
  ).sort()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Resumen operativo</p>
        </div>

        {/* ── Tab switcher ────────────────────────────────────── */}
        <DashboardTabSwitcher active="operaciones" />

        {/* ── Filters ─────────────────────────────────────────── */}
        <Suspense>
          <DashboardFilters
            banks={uniqueBanks}
            categories={categories}
            defaultFrom={fromStr}
            defaultTo={toStr}
          />
        </Suspense>

        {/* ── Zone 1: Command Strip ───────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
          <div className="px-6 pt-4 pb-0 border-b border-gray-50">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
              Resumen del Día
            </p>
          </div>
          <CommandStrip metrics={metrics} />
        </div>

        {/* ── Zones 2 + 3: Health & Operational Load ──────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">

          {/* Zone 2 — Health & Risk (40%) */}
          <div className="md:col-span-2 space-y-6">

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Salud & Riesgo
              </p>
              <div className="flex items-start gap-6">
                <SLAHealthRing
                  openTickets={metrics.openTickets}
                  slaBreaching={metrics.slaBreaching}
                />
                <div className="flex-1 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                    Antigüedad
                  </p>
                  <AgingDistribution
                    ageDistribution={metrics.ageDistribution}
                    openTickets={metrics.openTickets}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Solicitudes en Riesgo
              </p>
              <AtRiskTicketList tickets={metrics.atRiskTickets} />
            </div>
          </div>

          {/* Zone 3 — Operational Load (60%) */}
          <div className="md:col-span-3 space-y-6">

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Pipeline de Estado
              </p>
              <StatusPipeline metrics={metrics} />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Operaciones por Categoría
              </p>
              <p className="text-xs text-gray-400 mb-4">{fromLabel} – {toLabel}</p>
              <OperationsBreakdown
                rows={operationsByCategory}
                emptyMsg="Sin solicitudes en el periodo seleccionado"
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Distribución por Prioridad
              </p>
              <PriorityDistribution
                ticketsByPriority={metrics.ticketsByPriority}
                openTickets={metrics.openTickets}
              />
            </div>
          </div>
        </div>

        {/* ── Owner Workload ───────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Carga por Responsable
          </p>
          <p className="text-xs text-gray-400 mb-4">{fromLabel} – {toLabel}</p>
          <OwnerWorkload
            rows={ownerWorkload}
            emptyMsg="Sin solicitudes asignadas en el periodo seleccionado"
          />
        </div>

        {/* ── Operations by Bank ───────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Operaciones por Banco
          </p>
          <p className="text-xs text-gray-400 mb-4">{fromLabel} – {toLabel}</p>
          <OperationsBreakdown
            rows={operationsByBank}
            emptyMsg="Sin solicitudes en el periodo seleccionado"
          />
        </div>

        {/* ── Zone 4: Performance Trends ──────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Tendencias de Rendimiento
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
