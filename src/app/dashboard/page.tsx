import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import type { DashboardMetrics } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const profile  = await requireAdmin()
  const supabase = await createClient()

  // Parallel count queries — RLS admin policy covers all tickets.
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
        .lt('sla_deadline', new Date().toISOString()),
    ])

  // Aging: open tickets older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: agingCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '(resolved,closed)')
    .lt('created_at', sevenDaysAgo)

  // Average resolution time — fetch resolved/closed and compute in JS
  const { data: resolvedTickets } = await supabase
    .from('tickets')
    .select('created_at, resolved_at')
    .in('status', ['resolved', 'closed'])
    .not('resolved_at', 'is', null)

  let avgResolutionDays = 0
  if (resolvedTickets && resolvedTickets.length > 0) {
    const totalMs = resolvedTickets.reduce((sum, t) => {
      return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime())
    }, 0)
    avgResolutionDays = totalMs / resolvedTickets.length / (1000 * 60 * 60 * 24)
  }

  const metrics: DashboardMetrics = {
    totalTickets:    total.count      ?? 0,
    openTickets:     open.count       ?? 0,
    newCount:        newC.count       ?? 0,
    inProgressCount: inProgress.count ?? 0,
    waitingCount:    waiting.count    ?? 0,
    resolvedCount:   resolved.count   ?? 0,
    closedCount:     closed.count     ?? 0,
    slaBreaching:    slaBreaching.count ?? 0,
    agingTickets:    agingCount        ?? 0,
    avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Help Desk metrics at a glance</p>
        </div>
        <MetricsCards metrics={metrics} />
      </main>
    </div>
  )
}
