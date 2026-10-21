import type { createClient } from '@/lib/supabase/server'

/**
 * Dashboard aggregates.
 *
 * Preferred path: the SQL RPCs from migration 022 (dashboard_ops_summary /
 * dashboard_global_stats). They aggregate inside Postgres, so only counts
 * travel over the wire and PostgREST's 1000-row cap can't truncate results.
 *
 * Fallback path: if the RPCs are missing (migration not yet applied) or fail,
 * we run the previous row-level queries and group them in JS into the same
 * shape. Both paths respect RLS (RPCs are SECURITY INVOKER).
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface OpsSummary {
  cat_bank_status:   { category_id: string; bank_name: string | null; status: string; n: number }[]
  assignee_status:   { assignee_id: string; status: string; n: number }[]
  open_priority_age: { priority: string; age_bucket: '1-3d' | '3-7d' | '7d+'; n: number }[]
}

export interface GlobalStats {
  avgResolutionDays: number
  banks:             string[]
}

interface OpsArgs {
  fromISO:   string
  toISO:     string
  bank?:     string
  category?: string
  now:       Date
}

// ─── Ops summary (period + filters) ───────────────────────────

export async function fetchOpsSummary(supabase: SupabaseClient, args: OpsArgs): Promise<OpsSummary> {
  const { data, error } = await supabase.rpc('dashboard_ops_summary', {
    p_from:     args.fromISO,
    p_to:       args.toISO,
    p_bank:     args.bank     || null,
    p_category: args.category || null,
    p_now:      args.now.toISOString(),
  })
  if (!error && data) return data as OpsSummary

  console.warn('[dashboard] dashboard_ops_summary unavailable, using fallback:', error?.message)
  return fetchOpsSummaryFallback(supabase, args)
}

async function fetchOpsSummaryFallback(supabase: SupabaseClient, args: OpsArgs): Promise<OpsSummary> {
  let opsQuery = supabase
    .from('tickets')
    .select('category_id, bank_name, status, priority, created_at, assignee_id')
    .gte('created_at', args.fromISO)
    .lte('created_at', args.toISO)

  if (args.bank)     opsQuery = opsQuery.eq('bank_name',   args.bank)
  if (args.category) opsQuery = opsQuery.eq('category_id', args.category)

  const { data } = await opsQuery
  const rows = data ?? []

  const catBank  = new Map<string, OpsSummary['cat_bank_status'][number]>()
  const assignee = new Map<string, OpsSummary['assignee_status'][number]>()
  const openPA   = new Map<string, OpsSummary['open_priority_age'][number]>()

  for (const t of rows) {
    const k1 = `${t.category_id}|${t.bank_name ?? '\u0000'}|${t.status}`
    const g1 = catBank.get(k1) ?? { category_id: t.category_id, bank_name: t.bank_name, status: t.status, n: 0 }
    g1.n++
    catBank.set(k1, g1)

    if (t.assignee_id) {
      const k2 = `${t.assignee_id}|${t.status}`
      const g2 = assignee.get(k2) ?? { assignee_id: t.assignee_id, status: t.status, n: 0 }
      g2.n++
      assignee.set(k2, g2)
    }

    if (!['resolved', 'closed'].includes(t.status)) {
      const ageDays = (args.now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
      const bucket  = ageDays < 3 ? '1-3d' : ageDays < 7 ? '3-7d' : '7d+'
      const k3 = `${t.priority}|${bucket}`
      const g3 = openPA.get(k3) ?? { priority: t.priority, age_bucket: bucket, n: 0 }
      g3.n++
      openPA.set(k3, g3)
    }
  }

  return {
    cat_bank_status:   Array.from(catBank.values()),
    assignee_status:   Array.from(assignee.values()),
    open_priority_age: Array.from(openPA.values()),
  }
}

// ─── Global stats (not affected by filters) ───────────────────

export async function fetchGlobalStats(supabase: SupabaseClient): Promise<GlobalStats> {
  const { data, error } = await supabase.rpc('dashboard_global_stats')
  if (!error && data) {
    const d = data as { avg_resolution_days: number | null; banks: string[] | null }
    return { avgResolutionDays: Number(d.avg_resolution_days ?? 0), banks: d.banks ?? [] }
  }

  console.warn('[dashboard] dashboard_global_stats unavailable, using fallback:', error?.message)
  const [resolvedResult, banksResult] = await Promise.all([
    supabase
      .from('tickets')
      .select('created_at, resolved_at')
      .in('status', ['resolved', 'closed'])
      .not('resolved_at', 'is', null),
    supabase.from('tickets').select('bank_name').not('bank_name', 'is', null),
  ])

  return {
    avgResolutionDays: computeAvgResolution(resolvedResult.data ?? []),
    banks: (banksResult.data ?? []).map(t => t.bank_name).filter(Boolean) as string[],
  }
}

// ─── Helpers ──────────────────────────────────────────────────

export function computeAvgResolution(
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
