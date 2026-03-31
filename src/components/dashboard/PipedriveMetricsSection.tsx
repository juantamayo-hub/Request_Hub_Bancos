'use client'

import { useEffect, useState } from 'react'
import { RevenueStrip }        from './RevenueStrip'
import { PipelineFunnelStrip } from './PipelineFunnelStrip'

// ── Types (mirrors API route response, no server imports needed) ──

interface RevenueData {
  bayteca:   number
  md:        number
  total:     number
  dealCount: { bayteca: number; md: number }
}

interface FunnelConversionResult {
  fromLabel: string
  toLabel:   string
  fromCount: number
  toCount:   number
  rate:      number
}

interface FunnelData {
  totalDeals:    number
  conversions:   FunnelConversionResult[]
  avgDaysToSign: number | null
}

interface ApiData {
  revenue: RevenueData
  funnel:  FunnelData
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

function FunnelSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6 animate-pulse">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <div className="h-2.5 w-64 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {[0, 1, 2].map(i => (
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

// ── Main Component ────────────────────────────────────────────

interface Props {
  from:      string  // YYYY-MM-DD
  to:        string  // YYYY-MM-DD
  fromLabel: string
  toLabel:   string
}

export function PipedriveMetricsSection({ from, to, fromLabel, toLabel }: Props) {
  const [data,    setData]    = useState<ApiData | null>(null)
  const [error,   setError]   = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setData(null)

    fetch(`/api/dashboard/pipedrive?from=${from}&to=${to}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ApiData>
      })
      .then(json => { if (!cancelled) { setData(json); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })

    return () => { cancelled = true }
  }, [from, to])

  if (loading) {
    return (
      <>
        <RevenueSkeleton />
        <FunnelSkeleton />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Revenue · Operaciones Ganadas</p>
          <p className="text-sm text-gray-400 mt-2">No se pudo cargar el revenue desde Pipedrive.</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Funnel de Conversión · Bayteca Bank Area</p>
          <p className="text-sm text-gray-400 mt-2">No se pudo cargar el funnel desde Pipedrive.</p>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Revenue */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <div className="px-6 pt-4 pb-0 border-b border-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
            Revenue · Operaciones Ganadas
          </p>
        </div>
        <RevenueStrip
          revenue={data.revenue}
          dateRange={{ from: fromLabel, to: toLabel }}
        />
      </div>

      {/* Funnel */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
        <div className="px-6 pt-4 pb-0 border-b border-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
            Funnel de Conversión · Bayteca Bank Area
          </p>
        </div>
        <PipelineFunnelStrip
          data={data.funnel}
          dateRange={{ from: fromLabel, to: toLabel }}
        />
      </div>
    </>
  )
}
