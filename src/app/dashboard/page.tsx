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
import { fetchOpsSummary, fetchGlobalStats, computeAvgResolution, type GlobalStats } from '@/lib/dashboard-data'

export const metadata: Metadata = { title: 'Dashboard' }

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface DashboardParams { from?: string; to?: string; bank?: string; category?: string; tab?: string }

// ─── Page ─────────────────────────────────────────────────────
//
// Performance layout:
//   • Every Supabase query is fired in ONE parallel batch (previously 4
//     sequential waves), so server time ≈ the slowest single query.
//   • The page shell (navbar, header, tabs) renders immediately; filters and
//     the metrics body stream in independently via <Suspense>.
//   • The body's Suspense is keyed by the filter params, so changing a filter
//     only swaps the body for a skeleton — header and filters stay on screen.

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardParams>
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
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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

  // Start every query now (not awaited) so they all run in parallel while the
  // shell renders. Categories are shared by the filters and the metrics body.
  const categoriesPromise = Promise.resolve(
    supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
  ).then(r => r.data ?? [])

  // All-time stats (avg resolution + bank filter options), aggregated in SQL
  const globalStatsPromise = fetchGlobalStats(supabase)

  const dataPromise = loadDashboardData(supabase, params, now, fromStr, toStr, categoriesPromise, globalStatsPromise)

  const bodyKey = [params.from, params.to, params.bank, params.category].join('|')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Resumen operativo</p>
          </div>
          <a
            href="https://banks-command-center.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:opacity-90 active:scale-95 whitespace-nowrap"
            style={{ backgroundColor: '#083D20' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            Command Center
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7h10v10M7 17 17 7"/>
            </svg>
          </a>
        </div>

        {/* ── Tab switcher ────────────────────────────────────── */}
        <DashboardTabSwitcher active="operaciones" />

        {/* ── Filters ─────────────────────────────────────────── */}
        <Suspense fallback={<FiltersSkeleton />}>
          <FiltersSection
            categoriesPromise={categoriesPromise}
            globalStatsPromise={globalStatsPromise}
            defaultFrom={fromStr}
            defaultTo={toStr}
          />
        </Suspense>

        {/* ── Metrics body ────────────────────────────────────── */}
        <Suspense key={bodyKey} fallback={<BodySkeleton />}>
          <DashboardBody dataPromise={dataPromise} />
        </Suspense>

      </main>
    </div>
  )
}

// ─── Filters section ──────────────────────────────────────────

async function FiltersSection({
  categoriesPromise,
  globalStatsPromise,
  defaultFrom,
  defaultTo,
}: {
  categoriesPromise:  Promise<{ id: string; name: string }[]>
  globalStatsPromise: Promise<GlobalStats>
  defaultFrom:        string
  defaultTo:          string
}) {
  const [categories, globalStats] = await Promise.all([categoriesPromise, globalStatsPromise])

  // ── Filter options (from all tickets, not filtered set) ──────
  const uniqueBanks = Array.from(new Set(globalStats.banks.filter(Boolean))).sort()

  return (
    <DashboardFilters
      banks={uniqueBanks}
      categories={categories}
      defaultFrom={defaultFrom}
      defaultTo={defaultTo}
    />
  )
}

// ─── Data loading (single parallel batch) ─────────────────────

async function loadDashboardData(
  supabase: SupabaseClient,
  params: DashboardParams,
  now: Date,
  fromStr: string,
  toStr: string,
  categoriesPromise: Promise<{ id: string; name: string }[]>,
  globalStatsPromise: Promise<GlobalStats>,
) {
  const fromDate = new Date(fromStr)
  const toDate   = new Date(toStr + 'T23:59:59')
  const fromISO  = fromDate.toISOString()
  const toISO    = toDate.toISOString()
  const fromLabel = fromDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  const toLabel   = toDate.toLocaleDateString('es-ES',   { day: '2-digit', month: 'short', year: 'numeric' })

  const sevenDaysAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)

  const [
    // Core counts
    total, open, newC, inProgress, waiting, resolved, closed, slaBreaching,
    // Avg resolution (all-time) — aggregated in SQL
    globalStats,
    // Velocity, at-risk, prev-week
    atRiskRaw,
    recentOpened,
    recentClosed,
    prevWeekOpenResult,
    prevWeekSlaResult,
    prevWeekResolvedTickets,
    // Operations (filtered by date range + optional bank/category) — aggregated in SQL
    opsSummary,
    categories,
    assigneeProfilesResult,
  ] = await Promise.all([
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

    globalStatsPromise,

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

    fetchOpsSummary(supabase, { fromISO, toISO, bank: params.bank, category: params.category, now }),
    categoriesPromise,
    // Fetch ALL profiles so tickets assigned to non-admins still appear in the chart.
    // Filtering to role='admin' would silently exclude tickets assigned to users
    // whose role has since changed, causing the chart to undercount.
    supabase.from('profiles').select('id, email, first_name, last_name'),
  ])

  const avgResolutionDays = globalStats.avgResolutionDays

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

  // Groups arrive pre-counted (n). Name mapping and open/closed rules are
  // unchanged: unknown category → 'Otra', null bank → 'Sin banco',
  // open = status not in (resolved, closed).
  for (const g of opsSummary.cat_bank_status) {
    const catName  = categoryMap[g.category_id] ?? 'Otra'
    const bankName = g.bank_name ?? 'Sin banco'
    const isOpen   = !['resolved', 'closed'].includes(g.status)

    if (!catOps[catName])   catOps[catName]   = { open: 0, closed: 0 }
    if (!bankOps[bankName]) bankOps[bankName] = { open: 0, closed: 0 }
    if (!bankCatOps[bankName]) bankCatOps[bankName] = {}
    if (!bankCatOps[bankName][catName]) bankCatOps[bankName][catName] = { open: 0, closed: 0 }

    if (isOpen) {
      catOps[catName].open += g.n
      bankOps[bankName].open += g.n
      bankCatOps[bankName][catName].open += g.n
    } else {
      catOps[catName].closed += g.n
      bankOps[bankName].closed += g.n
      bankCatOps[bankName][catName].closed += g.n
    }
  }

  // Open tickets only: priority + age buckets (<3d, <7d, 7d+)
  for (const g of opsSummary.open_priority_age) {
    const p = g.priority as TicketPriority
    if (p in priorityCounts) priorityCounts[p] += g.n
    ageBuckets[g.age_bucket] += g.n
  }

  // Owner workload — source of truth: opsTickets (created within selected date range
  // + optional bank/category filters). Counts here are period-scoped, so they will
  // differ from the all-time totals visible on /admin/tickets with no date filter.
  for (const g of opsSummary.assignee_status) {
    const aid = g.assignee_id
    if (aid && profileMap[aid]) {
      if (!ownerStats[aid]) ownerStats[aid] = { name: profileMap[aid], new: 0, in_progress: 0, waiting: 0, resolved_closed: 0 }
      const s = g.status
      if      (s === 'new')                   ownerStats[aid].new += g.n
      else if (s === 'in_progress')            ownerStats[aid].in_progress += g.n
      else if (s === 'waiting_on_employee')    ownerStats[aid].waiting += g.n
      else                                     ownerStats[aid].resolved_closed += g.n
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

  return { metrics, operationsByCategory, operationsByBank, ownerWorkload, fromLabel, toLabel }
}

// ─── Metrics body ─────────────────────────────────────────────

async function DashboardBody({
  dataPromise,
}: {
  dataPromise: ReturnType<typeof loadDashboardData>
}) {
  const { metrics, operationsByCategory, operationsByBank, ownerWorkload, fromLabel, toLabel } =
    await dataPromise

  return (
    <>
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
    </>
  )
}

// ── Skeletons ──────────────────────────────────────────────────

function FiltersSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl mb-6 animate-pulse">
      <div className="h-3 w-12 bg-gray-100 rounded" />
      {[140, 140, 150, 170].map((w, i) => (
        <div key={i} className="h-7 bg-gray-100 rounded-md" style={{ width: w }} />
      ))}
    </div>
  )
}

function BodySkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando métricas">
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <div className="h-3 w-28 bg-gray-100 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
              <div className="h-8 w-14 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-xl h-64" />
        <div className="md:col-span-3 bg-white border border-gray-100 rounded-xl h-64" />
      </div>
      <div className="bg-white border border-gray-100 rounded-xl h-48" />
    </div>
  )
}
