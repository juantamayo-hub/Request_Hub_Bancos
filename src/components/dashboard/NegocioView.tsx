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

// ── Session cache helpers ─────────────────────────────────────

const CACHE_VERSION = 'v2'

function cacheKey(year: number, months: number[]): string {
  return `negocio_${CACHE_VERSION}_${year}_${[...months].sort((a, b) => a - b).join(',')}`
}

interface CacheEntry { data: ApiData; ts: string }

function loadCache(year: number, months: number[]): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(year, months))
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry
  } catch { return null }
}

function saveCache(year: number, months: number[], data: ApiData): string {
  const ts = new Date().toISOString()
  try { sessionStorage.setItem(cacheKey(year, months), JSON.stringify({ data, ts })) } catch { /* ignore */ }
  return ts
}

function clearCache(year: number, months: number[]) {
  try { sessionStorage.removeItem(cacheKey(year, months)) } catch { /* ignore */ }
}

// ── Period label ──────────────────────────────────────────────

const MONTH_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatPeriod(year: number, months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b)
  if (sorted.length === 1) return `${MONTH_SHORT[sorted[0]]} ${year}`
  const isConsecutive = sorted.every((m, i) => i === 0 || m === sorted[i - 1] + 1)
  const first = MONTH_SHORT[sorted[0]]
  const last  = MONTH_SHORT[sorted[sorted.length - 1]]
  if (isConsecutive) return `${first} – ${last} ${year}`
  return sorted.map(m => MONTH_SHORT[m]).join(', ') + ` ${year}`
}

// ── Formatting ────────────────────────────────────────────────

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

// ── Pipedrive Loader ──────────────────────────────────────────

const LOADING_STEPS = [
  'Conectando con Pipedrive...',
  'Extrayendo deals del pipeline...',
  'Calculando métricas de conversión...',
  'Procesando datos de revenue...',
  'Casi listo...',
]

function PipedriveLoader() {
  const [stepIdx, setStepIdx] = useState(0)
  const [dots,    setDots]    = useState('')

  useEffect(() => {
    const stepTimer = setInterval(() => setStepIdx(i => (i + 1) % LOADING_STEPS.length), 3000)
    const dotsTimer = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500)
    return () => { clearInterval(stepTimer); clearInterval(dotsTimer) }
  }, [])

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-12 mb-6 flex flex-col items-center justify-center gap-6">
      <div className="relative w-16 h-16">
        <svg className="animate-spin w-16 h-16" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" stroke="#E8F2EC" strokeWidth="6" />
          <path d="M32 4 a28 28 0 0 1 28 28" stroke="#083D20" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#083D20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700 h-5 transition-all duration-300">
          {LOADING_STEPS[stepIdx].replace('...', '')}{dots}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Pipedrive procesa hasta miles de deals — esto puede tardar hasta un minuto
        </p>
      </div>
      <div className="flex gap-1.5">
        {LOADING_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === stepIdx ? 'w-6 bg-[#083D20]' : i < stepIdx ? 'w-1.5 bg-[#083D20]/30' : 'w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function NegocioView() {
  const searchParams = useSearchParams()
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const year         = now.getFullYear()

  // Parse ?months=3,4 (multi) or legacy ?month=4 (single)
  const rawParam     = searchParams.get('months') ?? searchParams.get('month') ?? String(currentMonth)
  const parsedMonths = rawParam
    .split(',')
    .map(Number)
    .filter(m => !isNaN(m) && m >= 1 && m <= currentMonth)
    .sort((a, b) => a - b)
  const months = parsedMonths.length > 0 ? parsedMonths : [currentMonth]

  const [data,       setData]       = useState<ApiData | null>(null)
  const [error,      setError]      = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [cachedAt,   setCachedAt]   = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const monthsKey = months.join(',')  // stable string for useEffect deps

  useEffect(() => {
    let cancelled = false

    // Check session cache first
    const cached = loadCache(year, months)
    if (cached) {
      setData(cached.data)
      setCachedAt(cached.ts)
      setLoading(false)
      setError(false)
      return
    }

    setLoading(true)
    setError(false)
    setData(null)
    setCachedAt(null)

    fetch(`/api/dashboard/negocio?year=${year}&months=${monthsKey}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ApiData>
      })
      .then(json => {
        if (!cancelled) {
          const ts = saveCache(year, months, json)
          setData(json)
          setCachedAt(ts)
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsKey, year, refreshKey])

  function handleRefresh() {
    clearCache(year, months)
    setRefreshKey(k => k + 1)
  }

  const period = formatPeriod(year, months)

  return (
    <>
      <NegocioFilters
        selectedMonths={months}
        onRefresh={handleRefresh}
        isLoading={loading}
        cachedAt={cachedAt}
      />

      {loading && <PipedriveLoader />}

      {!loading && (error || !data) && (
        <>
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
      )}

      {!loading && data && (
        <>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
            <div className="px-6 pt-4 pb-0 border-b border-gray-50">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
                Revenue · Operaciones Ganadas
              </p>
            </div>
            <BaytecaRevenueCard revenue={data.revenue} dateRange={period} />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
            <div className="px-6 pt-4 pb-0 border-b border-gray-50">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
                Funnel de Conversión · Bayteca Bank Area
              </p>
            </div>
            <FunnelKPIStrip kpis={data.kpis} bsTotal={data.bsTotal} period={period} />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
            <div className="px-6 pt-4 pb-0 border-b border-gray-50">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
                Progresión del Funnel · BS Cohort
              </p>
            </div>
            <FunnelWaterfall stages={data.funnel} />
          </div>
        </>
      )}
    </>
  )
}
