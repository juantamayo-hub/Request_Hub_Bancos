'use client'

import { useEffect, useState } from 'react'
import { useSearchParams }    from 'next/navigation'
import { NegocioFilters }     from './NegocioFilters'
import { FunnelKPIStrip }     from './FunnelKPIStrip'
import { FunnelWaterfall }    from './FunnelWaterfall'

// ── Types (mirrors API response) ──────────────────────────────

interface FunnelKPI {
  fromLabel: string
  toLabel:   string
  cohort:    number
  count:     number
  rate:      number
}

interface WaterfallStage {
  label:        string
  count:        number
  rateFromBS:   number
  rateFromPrev: number
}

interface BaytecaRevenue {
  bankFee:    number
  membership: number
  total:      number
  dealCount:  number
}

interface ApiData {
  kpis:    FunnelKPI[]
  funnel:  WaterfallStage[]
  bsTotal: number
  revenue: BaytecaRevenue
}

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style:    'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function BaytecaRevenueCard({ revenue, dateRange }: { revenue: BaytecaRevenue; dateRange: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Revenue Total</p>
        <p className="text-3xl font-bold tabular-nums text-gray-900">{formatEUR(revenue.total)}</p>
        <p className="text-xs text-gray-400 mt-1">
          {revenue.dealCount} operación{revenue.dealCount !== 1 ? 'es' : ''} ganada{revenue.dealCount !== 1 ? 's' : ''} · {dateRange}
        </p>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Bank Fee</p>
        <p className="text-2xl font-bold tabular-nums text-[#083D20]">{formatEUR(revenue.bankFee)}</p>
        <p className="text-xs text-gray-400 mt-1">Bayteca Bank Area · Pipeline 7</p>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Membership Payment</p>
        <p className="text-2xl font-bold tabular-nums text-[#083D20]">{formatEUR(revenue.membership)}</p>
        <p className="text-xs text-gray-400 mt-1">Bayteca Bank Area · Pipeline 7</p>
      </div>
    </div>
  )
}

// ── Skeletons ─────────────────────────────────────────────────

function RevenueSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6 animate-pulse">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <div className="h-2.5 w-48 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {[0, 1, 2].map(i => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="h-2 w-24 bg-gray-100 rounded" />
            <div className="h-8 w-32 bg-gray-100 rounded" />
            <div className="h-2 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function KPISkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6 animate-pulse">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <div className="h-2.5 w-64 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="px-5 py-4 space-y-3">
            <div className="h-2 w-36 bg-gray-100 rounded" />
            <div className="h-8 w-16 bg-gray-100 rounded" />
            <div className="h-1.5 w-full bg-gray-100 rounded-full" />
            <div className="h-2 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function WaterfallSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6 animate-pulse">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <div className="h-2.5 w-48 bg-gray-100 rounded" />
      </div>
      <div className="flex gap-4 px-5 py-8">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 space-y-2">
            <div className="h-2 w-16 bg-gray-100 rounded mx-auto" />
            <div className="h-8 w-12 bg-gray-100 rounded mx-auto" />
            <div className="h-2 w-12 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Month labels ──────────────────────────────────────────────

const MONTH_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ── Main Component ────────────────────────────────────────────

export function NegocioView() {
  const searchParams = useSearchParams()
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const year         = now.getFullYear()

  const raw   = parseInt(searchParams.get('month') ?? String(currentMonth), 10)
  const month = isNaN(raw) || raw < 1 || raw > 12 ? currentMonth : raw

  const [data,    setData]    = useState<ApiData | null>(null)
  const [error,   setError]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setData(null)

    fetch(`/api/dashboard/negocio?year=${year}&month=${month}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ApiData>
      })
      .then(json => { if (!cancelled) { setData(json); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })

    return () => { cancelled = true }
  }, [month, year])

  const period    = `Ene ${year} – ${MONTH_SHORT[month]} ${year}`

  if (loading) {
    return (
      <>
        <NegocioFilters month={month} />
        <RevenueSkeleton />
        <KPISkeleton />
        <WaterfallSkeleton />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <NegocioFilters month={month} />
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Revenue · Operaciones Ganadas
          </p>
          <p className="text-sm text-gray-400 mt-2">No se pudo cargar el revenue desde Pipedrive.</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Funnel de Conversión · Bayteca Bank Area
          </p>
          <p className="text-sm text-gray-400 mt-2">No se pudo cargar el funnel desde Pipedrive.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <NegocioFilters month={month} />

      {/* Revenue */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <div className="px-6 pt-4 pb-0 border-b border-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
            Revenue · Operaciones Ganadas
          </p>
        </div>
        <BaytecaRevenueCard revenue={data.revenue} dateRange={period} />
      </div>

      {/* KPI Funnel */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <div className="px-6 pt-4 pb-0 border-b border-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
            Funnel de Conversión · Bayteca Bank Area
          </p>
        </div>
        <FunnelKPIStrip
          kpis={data.kpis}
          bsTotal={data.bsTotal}
          period={period}
        />
      </div>

      {/* Waterfall */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <div className="px-6 pt-4 pb-0 border-b border-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
            Progresión del Funnel · BS Cohort
          </p>
        </div>
        <FunnelWaterfall stages={data.funnel} />
      </div>
    </>
  )
}
