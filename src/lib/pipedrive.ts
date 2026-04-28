// ============================================================
// Pipedrive API utilities — Request Hub Bancos
// Server-side only. Never import in client components.
// ============================================================

const API_TOKEN  = process.env.PIPEDRIVE_API_TOKEN!
const BASE_URL   = 'https://api.pipedrive.com/v1'

// Pipelines allowed for banking deals
export const BANK_PIPELINE_IDS  = [7, 10]  // 7=Bayteca_BankArea, 10=MD_Bank_Area
export const PIPELINE_NAMES: Record<number, string> = {
  7:  'Bayteca Bank Area',
  10: 'MD Bank Area',
}

// Custom field API codes
const FIELD_BANK_NAME      = 'c3a445b9bf0422b9db09abc776cf2dc281b7e975'
const FIELD_BANK_EMAIL     = '498dd83b5c5e1f1181c232131933717ceadfda34'
const FIELD_BANK_FEE       = 'a04769981931d317d4412a5dce1fe5f98ae2fb4d'       // Pipeline 7
const FIELD_MEMBERSHIP_AMT = '3d671c93e592fa9fe7f63aa1bf50211f7bdfaeda'  // Pipeline 10

// Claim / reclamación fields (written by Request Hub on ticket events)
export const FIELD_CLAIM_DATE    = 'c2f1c7dd74cf7062018aa780fdb2b97be9a17572'
export const FIELD_CLAIM_OWNER   = 'dd09ca0fa21ace10f6e44eaba4dad8b22d769972'
export const FIELD_CLAIM_CHANNEL = 'f93a9561404bca277316c7b5ee794b7bde1b40bf'
export const FIELD_DEAL_SUMMARY  = '09c8dc3c0e475f225cb07297ea65118f3a713de5'

// Option IDs for the FIELD_CLAIM_CHANNEL enum field
export const CLAIM_CHANNEL_IDS: Record<string, number> = {
  Phone:     3567,
  Email:     3568,
  WhatsApp:  3569,
}

// ─── Types ────────────────────────────────────────────────────

export interface DealValidationResult {
  dealId:      number
  pipelineId:  number
  pipelineName: string
  title:       string
  bankName:    string | null
  bankEmail:   string | null
  clientName:  string | null
}

export interface PipelineRevenue {
  pipelineId:   number
  pipelineName: string
  total:        number
  dealCount:    number
}

// ─── Deal Validation ─────────────────────────────────────────

export async function validateDeal(dealId: number): Promise<DealValidationResult> {
  const res = await fetch(
    `${BASE_URL}/deals/${dealId}?api_token=${API_TOKEN}`,
    { next: { revalidate: 0 } },
  )

  if (!res.ok) {
    if (res.status === 404) throw new Error(`El deal ${dealId} no existe en Pipedrive.`)
    throw new Error(`Error al consultar Pipedrive (${res.status}).`)
  }

  const json = await res.json()
  if (!json.success || !json.data) {
    throw new Error('El deal no existe en Pipedrive.')
  }

  const deal = json.data
  const pipelineId: number = deal.pipeline_id

  if (!BANK_PIPELINE_IDS.includes(pipelineId)) {
    throw new Error(
      `El deal ${dealId} pertenece al pipeline "${deal.pipeline_id}" y no es un deal bancario válido. Solo se aceptan deals de Bayteca Bank Area (7) o MD Bank Area (10).`,
    )
  }

  // person_id is an object like { value: 123, name: "John Doe" } or null
  const personName = typeof deal.person_id === 'object' && deal.person_id !== null
    ? (deal.person_id as { name?: string }).name ?? null
    : null

  return {
    dealId,
    pipelineId,
    pipelineName: PIPELINE_NAMES[pipelineId] ?? `Pipeline ${pipelineId}`,
    title:      deal.title ?? '',
    bankName:   deal[FIELD_BANK_NAME]  ?? null,
    bankEmail:  deal[FIELD_BANK_EMAIL] ?? null,
    clientName: personName,
  }
}

// ─── Create Note on Deal ──────────────────────────────────────

export async function createDealNote(dealId: number, content: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/notes?api_token=${API_TOKEN}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ deal_id: dealId, content }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Pipedrive note creation failed for deal ${dealId}:`, body)
    throw new Error(`No se pudo crear la nota en Pipedrive (${res.status}).`)
  }
}

// ─── Generic field updater ────────────────────────────────────

export async function updateDealField(dealId: number, fieldKey: string, value: unknown): Promise<void> {
  const res = await fetch(`${BASE_URL}/deals/${dealId}?api_token=${API_TOKEN}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ [fieldKey]: value }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[pipedrive] updateDealField(${dealId}, ${fieldKey}) failed (${res.status}):`, body)
  }
}

// ─── Fetch deal stage_id ──────────────────────────────────────

export async function fetchDealStageId(dealId: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/deals/${dealId}?api_token=${API_TOKEN}`,
      { signal: AbortSignal.timeout(8_000), cache: 'no-store' },
    )
    if (!res.ok) return null
    const json = await res.json()
    return (json.data?.stage_id as number | undefined) ?? null
  } catch {
    return null
  }
}

// ─── Funnel Conversion (Bayteca Pipeline 7) ──────────────────

const FIELD_BANK_SUBMISSION  = 'f20687cf44df74416768a89758ebabaca99a0c16'
const FIELD_NOTARY_DATE      = '9ffdabbc12795cb0615263cfd2e0278c506a4854'

// Month custom fields (return "YYYY-MM-DD" = first of the month)
const FIELD_BS_MONTH         = '19380ff04cfd319c3c7c53dfb13316a96e299a86'
const FIELD_BOR_MONTH        = '9503bcf59edfd6a61cc10007ddec00485860e42b'
const FIELD_VALUATION_MONTH  = '9ed4240a1d622e0dae2644517e96146afaf93a3f'
const FIELD_FEIN_MONTH       = '007e1e4c5d4c32629685eab6bd9ef14a9c3a08dc'

const FUNNEL_STAGES_META = [
  { id: 70, label: 'Bank Submission'    },
  { id: 71, label: 'Bank Offer Received'},
  { id: 72, label: 'Valuation'          },
  { id: 73, label: 'FEIN'               },
  { id: 75, label: 'Notary Signature'   },
] as const

const FUNNEL_TRANSITIONS = [
  { fromId: 70, toId: 71 },
  { fromId: 71, toId: 72 },
  { fromId: 73, toId: 75 },
] as const

export interface FunnelKPI {
  fromLabel: string
  toLabel:   string
  cohort:    number  // denominator
  count:     number  // numerator
  rate:      number  // 0–100
}

export interface WaterfallStage {
  label:        string
  count:        number
  rateFromBS:   number  // % vs BS total
  rateFromPrev: number  // % vs prev stage
}

export interface BaytecaMetrics {
  bsTotal:     number
  kpis:        FunnelKPI[]
  funnel:      WaterfallStage[]
  lostByStage: Record<string, number>   // stage label → lost count from BS cohort
  ytdKpis:     FunnelKPI[]
  ytdBsTotal:  number
}

// ─── Stage Snapshot ───────────────────────────────────────────

export interface StageCount {
  stageId:   number
  label:     string
  openCount: number
  lostCount: number
}

// ─── Mortgage Volume ──────────────────────────────────────────

export interface MortgageVolumeByBank {
  bankName: string
  amount:   number
  count:    number
}

export interface MortgageSummary {
  total:  number
  count:  number
  byBank: MortgageVolumeByBank[]
}

export interface FunnelConversionResult {
  fromLabel: string
  toLabel:   string
  fromCount: number
  toCount:   number
  rate:      number  // 0–100
}

export interface FunnelMetrics {
  totalDeals:    number
  conversions:   FunnelConversionResult[]
  avgDaysToSign: number | null
}

async function fetchStageOrderMap(): Promise<Map<number, number>> {
  const url = `${BASE_URL}/stages?pipeline_id=7&api_token=${API_TOKEN}`
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return new Map()
    const json = await res.json() as { data?: { id: number; name: string; order_nr: number }[] }
    const map  = new Map<number, number>()
    for (const s of json.data ?? []) map.set(s.id, s.order_nr)
    return map
  } catch {
    return new Map()
  }
}

interface RawFullDeal {
  stage_id:       number
  stage_order_nr: number
  status:         string
  update_time?:   string | null
  [key: string]:  unknown
}

// Fetches pipeline-7 deals sorted by update_time DESC, stopping once we see
// deals last updated before `from` (first day of the min selected month).
//
// Why update_time (not add_time):
//   Deals can be created years ago but only get BS_MONTH/BOR_MONTH/etc. set
//   when they progress through stages. Pipedrive always updates a deal's
//   update_time when any custom field changes, so every deal with a month-field
//   set in month M will have update_time >= first day of M.
//   Using `from` as the floor (e.g. April 1 for a single-April view) means we
//   typically only fetch 1-3 pages instead of scanning the full pipeline.
async function fetchAllPipelineDeals(from: Date, _to: Date, _explicitFloor?: Date): Promise<RawFullDeal[]> {
  const all:    RawFullDeal[] = []
  let   start = 0
  const limit = 500
  const floor = from  // first day of the min selected month

  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${BASE_URL}/deals?pipeline_id=7&status=all_not_deleted&sort=update_time+DESC&start=${start}&limit=${limit}&api_token=${API_TOKEN}`

    let json: {
      success: boolean
      data: RawFullDeal[]
      additional_data?: { pagination?: { more_items_in_collection?: boolean } }
    }
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
        cache:  'no-store',
      })
      if (!res.ok) {
        console.warn(`[pipedrive] fetchAllDeals page=${page} status=${res.status}`)
        break
      }
      json = await res.json()
    } catch (err) {
      console.warn(`[pipedrive] fetchAllDeals page=${page} error:`, err)
      break
    }

    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) break

    all.push(...json.data)

    // Early-exit: last deal on this page was updated before the selected range
    const lastUpdate = json.data[json.data.length - 1]?.update_time
    if (lastUpdate && new Date(lastUpdate) < floor) break

    if (!json.additional_data?.pagination?.more_items_in_collection) break
    start += limit
  }

  console.log(`[pipedrive] fetchAllPipelineDeals: fetched ${all.length} deals (${Math.ceil(all.length / limit)} pages)`)
  return all
}

export async function fetchFunnelConversions(from: Date, to: Date): Promise<FunnelMetrics> {
  const [stageMap, allDeals] = await Promise.all([
    fetchStageOrderMap(),
    fetchAllPipelineDeals(from, to),
  ])

  // Filter by bank submission date within [from, to]
  const filtered = allDeals.filter(deal => {
    const raw = deal[FIELD_BANK_SUBMISSION]
    if (!raw || typeof raw !== 'string') return false
    const d = new Date(raw)
    return d >= from && d <= to
  })

  // Count deals that reached each funnel stage (stage_order_nr >= stage's order)
  const stageCounts = new Map<number, number>(FUNNEL_STAGES_META.map(s => [s.id, 0]))
  let totalMs = 0, completedCount = 0

  for (const deal of filtered) {
    const dealOrder = deal.stage_order_nr

    for (const { id } of FUNNEL_STAGES_META) {
      const stageOrder = stageMap.get(id) ?? -1
      if (stageOrder >= 0 && dealOrder >= stageOrder) {
        stageCounts.set(id, (stageCounts.get(id) ?? 0) + 1)
      }
    }

    // Accumulate avg days: bank submission → notary signature
    const subRaw    = deal[FIELD_BANK_SUBMISSION]
    const notaryRaw = deal[FIELD_NOTARY_DATE]
    if (typeof subRaw === 'string' && typeof notaryRaw === 'string') {
      const ms = new Date(notaryRaw).getTime() - new Date(subRaw).getTime()
      if (ms > 0) { totalMs += ms; completedCount++ }
    }
  }

  const labelMap   = new Map(FUNNEL_STAGES_META.map(s => [s.id, s.label]))
  const conversions: FunnelConversionResult[] = FUNNEL_TRANSITIONS.map(({ fromId, toId }) => {
    const fromCount = stageCounts.get(fromId) ?? 0
    const toCount   = stageCounts.get(toId)   ?? 0
    return {
      fromLabel: labelMap.get(fromId)!,
      toLabel:   labelMap.get(toId)!,
      fromCount,
      toCount,
      rate: fromCount === 0 ? 0 : Math.round((toCount / fromCount) * 100),
    }
  })

  return {
    totalDeals:    filtered.length,
    conversions,
    avgDaysToSign: completedCount > 0
      ? Math.round(totalMs / completedCount / (1000 * 60 * 60 * 24))
      : null,
  }
}

// ─── Bayteca Metrics (Month-field based KPIs + Waterfall) ────

// Returns true when the raw date string's year+month is within the given set.
function inMonthSet(raw: unknown, year: number, months: number[]): boolean {
  if (!raw || typeof raw !== 'string') return false
  const d = new Date(raw)
  if (isNaN(d.getTime())) return false
  return d.getFullYear() === year && months.includes(d.getMonth() + 1)
}

// Fetches deals using a saved Pipedrive filter (by filter_id).
// Much more efficient than full-pipeline scans: only returns matching deals.
async function fetchDealsByFilterId(filterId: number): Promise<RawFullDeal[]> {
  const all: RawFullDeal[] = []
  let   start = 0
  const limit = 500

  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${BASE_URL}/deals?filter_id=${filterId}&start=${start}&limit=${limit}&api_token=${API_TOKEN}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' })
      if (!res.ok) { console.warn(`[pipedrive] filter ${filterId} page=${page} status=${res.status}`); break }
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) break
      all.push(...json.data as RawFullDeal[])
      if (!json.additional_data?.pagination?.more_items_in_collection) break
      start += limit
    } catch (err) { console.warn(`[pipedrive] filter ${filterId} page=${page} error:`, err); break }
  }

  console.log(`[pipedrive] fetchDealsByFilterId(${filterId}): ${all.length} deals`)
  return all
}

// Looks up the Pipedrive saved filter for BS_MONTH = current year.
// Checks PIPEDRIVE_BS_FILTER_ID env var first (fast path), then searches
// the filter list by name (cached 1h).
async function findBSYearFilter(year: number): Promise<number | null> {
  const envId = process.env.PIPEDRIVE_BS_FILTER_ID
  if (envId) return parseInt(envId, 10)

  try {
    const url = `${BASE_URL}/filters?type=deals&api_token=${API_TOKEN}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const json = await res.json() as { success: boolean; data?: { id: number; name: string }[] }
    if (!json.success || !json.data) return null

    const yearStr = String(year)
    const match   = json.data.find(f =>
      f.name.toLowerCase().includes('bs month') && f.name.includes(yearStr),
    )
    if (match) console.log(`[pipedrive] found BS filter: "${match.name}" id=${match.id}`)
    return match?.id ?? null
  } catch {
    return null
  }
}

// ─── Shared computation helper ────────────────────────────────

const STAGE_ID_TO_LABEL: Record<number, string> = {
  70: 'Bank Sub.',
  71: 'Bank Offer',
  72: 'Valuation',
  73: 'FEIN',
  75: 'Notary',
}

function computeMetricsFromDeals(
  allDeals:  RawFullDeal[],
  year:      number,
  months:    number[],
  stageMap:  Map<number, number>,
): { bsTotal: number; kpis: FunnelKPI[]; funnel: WaterfallStage[]; lostByStage: Record<string, number> } {
  const bsCohort = allDeals.filter(d => inMonthSet(d[FIELD_BS_MONTH],        year, months))
  const borCohort = allDeals.filter(d => inMonthSet(d[FIELD_BOR_MONTH],       year, months))
  const valCohort = allDeals.filter(d => inMonthSet(d[FIELD_VALUATION_MONTH], year, months))
  const feinCohort = allDeals.filter(d => inMonthSet(d[FIELD_FEIN_MONTH],     year, months))

  const notaryStageOrder = stageMap.get(75) ?? -1
  const hasField     = (d: RawFullDeal, field: string) => d[field] != null && typeof d[field] === 'string'
  const reachedNotary = (d: RawFullDeal) =>
    notaryStageOrder >= 0 && (d.stage_order_nr ?? -1) >= notaryStageOrder

  const bsTotal = bsCohort.length

  // ── 4 KPIs ────────────────────────────────────────────────
  const kpis: FunnelKPI[] = [
    { fromLabel: 'Bank Submission', toLabel: 'Bank Offer',  cohort: bsTotal,           count: bsCohort.filter(d => hasField(d, FIELD_BOR_MONTH)).length,          rate: 0 },
    { fromLabel: 'Bank Offer',      toLabel: 'Valuation',   cohort: borCohort.length,  count: borCohort.filter(d => hasField(d, FIELD_VALUATION_MONTH)).length,   rate: 0 },
    { fromLabel: 'Valuation',       toLabel: 'FEIN',        cohort: valCohort.length,  count: valCohort.filter(d => hasField(d, FIELD_FEIN_MONTH)).length,        rate: 0 },
    { fromLabel: 'FEIN',            toLabel: 'Notary',      cohort: feinCohort.length, count: feinCohort.filter(reachedNotary).length,                            rate: 0 },
  ]
  for (const kpi of kpis) {
    kpi.rate = kpi.cohort === 0 ? 0 : Math.round((kpi.count / kpi.cohort) * 100)
  }

  // ── Waterfall (BS cohort only) ─────────────────────────────
  const waterfallCounts = [
    bsTotal,
    bsCohort.filter(d => hasField(d, FIELD_BOR_MONTH)).length,
    bsCohort.filter(d => hasField(d, FIELD_VALUATION_MONTH)).length,
    bsCohort.filter(d => hasField(d, FIELD_FEIN_MONTH)).length,
    bsCohort.filter(reachedNotary).length,
  ]
  const waterfallLabels = ['Bank Sub.', 'Bank Offer', 'Valuation', 'FEIN', 'Notary']

  const funnel: WaterfallStage[] = waterfallCounts.map((count, i) => ({
    label:        waterfallLabels[i],
    count,
    rateFromBS:   bsTotal === 0 ? 0 : Math.round((count / bsTotal) * 100),
    rateFromPrev: i === 0 ? 100
      : waterfallCounts[i - 1] === 0 ? 0
      : Math.round((count / waterfallCounts[i - 1]) * 100),
  }))

  // ── Lost by stage from BS cohort ───────────────────────────
  const lostByStage: Record<string, number> = {}
  for (const deal of bsCohort) {
    if (String(deal.status) === 'lost') {
      const label = STAGE_ID_TO_LABEL[deal.stage_id as number] ?? `Stage ${deal.stage_id}`
      lostByStage[label] = (lostByStage[label] ?? 0) + 1
    }
  }

  return { bsTotal, kpis, funnel, lostByStage }
}

export async function fetchBaytecaMetrics(year: number, months: number[]): Promise<BaytecaMetrics> {
  const currentMonth = new Date().getMonth() + 1
  const ytdMonths    = Array.from({ length: currentMonth }, (_, i) => i + 1)

  // Always fetch from Jan 1 so we have full-year data for the YTD comparison
  const from = new Date(year, 0, 1)
  const to   = new Date(year, 11, 31, 23, 59, 59)

  const [stageMap, filterId] = await Promise.all([
    fetchStageOrderMap(),
    findBSYearFilter(year),
  ])

  const allDeals = filterId
    ? await fetchDealsByFilterId(filterId)
    : await fetchAllPipelineDeals(from, to)

  // Compute metrics for the selected period
  const selected = computeMetricsFromDeals(allDeals, year, months, stageMap)

  // Compute YTD (same calculation, different month set) — reuses same deals array
  const selSorted = [...months].sort((a, b) => a - b)
  const ytdSorted = [...ytdMonths].sort((a, b) => a - b)
  const isYtd = selSorted.length === ytdSorted.length && selSorted.every((m, i) => m === ytdSorted[i])
  const ytd   = isYtd ? selected : computeMetricsFromDeals(allDeals, year, ytdMonths, stageMap)

  return {
    bsTotal:     selected.bsTotal,
    kpis:        selected.kpis,
    funnel:      selected.funnel,
    lostByStage: selected.lostByStage,
    ytdKpis:     ytd.kpis,
    ytdBsTotal:  ytd.bsTotal,
  }
}

// ─── Stage Snapshot (current pipeline state) ─────────────────

async function countDealsInStageByStatus(stageId: number, status: 'open' | 'lost'): Promise<number> {
  let total = 0
  let start = 0
  const limit = 500
  for (let page = 0; page < 10; page++) {
    const url = `${BASE_URL}/deals?pipeline_id=7&stage_id=${stageId}&status=${status}&start=${start}&limit=${limit}&api_token=${API_TOKEN}`
    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
      if (!res.ok) break
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data)) break
      total += json.data.length
      if (!json.additional_data?.pagination?.more_items_in_collection) break
      start += limit
    } catch { break }
  }
  return total
}

export async function fetchStageCounts(): Promise<StageCount[]> {
  const stages = [
    { id: 70, label: 'Bank Submission' },
    { id: 71, label: 'Bank Offer' },
    { id: 72, label: 'Valuation' },
    { id: 73, label: 'FEIN' },
    { id: 75, label: 'Notary' },
  ]
  return Promise.all(
    stages.map(async ({ id, label }) => {
      const [openCount, lostCount] = await Promise.all([
        countDealsInStageByStatus(id, 'open'),
        countDealsInStageByStatus(id, 'lost'),
      ])
      return { stageId: id, label, openCount, lostCount }
    }),
  )
}

// ─── Financed Mortgage Volume ─────────────────────────────────

export async function fetchMortgageVolume(year: number, months: number[]): Promise<MortgageSummary> {
  // Won deals in period + currently open deals in Notary stage
  const [wonDeals, notaryDeals] = await Promise.all([
    fetchWonDealsForPipeline(7, new Date(year, 0, 1)),
    fetchOpenDealsInStage(75),
  ])

  const inRange = (wonTime: string | null): boolean => {
    if (!wonTime) return false
    const d = new Date(wonTime)
    return d.getFullYear() === year && months.includes(d.getMonth() + 1)
  }

  const parseAmt = (val: unknown): number => {
    const n = parseFloat(String(val ?? '0'))
    return isNaN(n) ? 0 : n
  }

  const map = new Map<string, { amount: number; count: number }>()
  const add  = (bankName: string, amount: number) => {
    if (!map.has(bankName)) map.set(bankName, { amount: 0, count: 0 })
    const e = map.get(bankName)!
    e.amount += amount
    e.count  += 1
  }

  for (const deal of wonDeals) {
    if (!inRange(deal.won_time)) continue
    add((deal[FIELD_BANK_NAME] as string | null) ?? 'Sin banco', parseAmt(deal.value))
  }
  for (const deal of notaryDeals) {
    add((deal[FIELD_BANK_NAME] as string | null) ?? 'Sin banco', parseAmt(deal.value))
  }

  const byBank = Array.from(map.entries())
    .map(([bankName, { amount, count }]) => ({ bankName, amount, count }))
    .sort((a, b) => b.amount - a.amount)

  return {
    total:  byBank.reduce((s, b) => s + b.amount, 0),
    count:  byBank.reduce((s, b) => s + b.count,  0),
    byBank,
  }
}

// ─── Stage Deals (for cron overdue checks) ───────────────────

export interface StageDeal {
  id:        number
  title:     string
  status:    string
  stage_id:  number
  owner_id:  { name?: string; email?: string } | null
  person_id: { name?: string } | null
  [key: string]: unknown
}

// Fetches all open deals currently in a specific stage of pipeline 7.
// Used by the overdue-alert cron job — much more efficient than fetching
// the full pipeline because it only returns deals in the target stage.
export async function fetchOpenDealsInStage(stageId: number): Promise<StageDeal[]> {
  const all: StageDeal[] = []
  let   start = 0
  const limit = 500

  for (let page = 0; page < 5; page++) { // max 2500 deals per stage
    const url =
      `${BASE_URL}/deals?pipeline_id=7&stage_id=${stageId}&status=open&start=${start}&limit=${limit}&api_token=${API_TOKEN}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
      if (!res.ok) break
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) break
      all.push(...json.data as StageDeal[])
      if (!json.additional_data?.pagination?.more_items_in_collection) break
      start += limit
    } catch { break }
  }

  return all
}

// ─── Revenue Calculation ──────────────────────────────────────

interface RawDeal {
  pipeline_id: number
  status:      string
  won_time:    string | null
  [key: string]: unknown
}

const MAX_PAGES = 100  // safety cap: 100 × 500 = 50 000 deals max per fetch

export interface BaytecaRevenue {
  bankFee:       number
  membership:    number
  total:         number
  dealCount:     number
}

async function fetchWonDealsForPipeline(pipelineId: number, fromDate?: Date): Promise<RawDeal[]> {
  const all: RawDeal[] = []
  let start = 0
  const limit = 500

  for (let page = 0; page < MAX_PAGES; page++) {
    // Sort by won_time DESC so we can early-exit once past the target window
    const url =
      `${BASE_URL}/deals?pipeline_id=${pipelineId}&status=won&sort=won_time+DESC&start=${start}&limit=${limit}&api_token=${API_TOKEN}`

    let json: { success: boolean; data: RawDeal[]; additional_data?: { pagination?: { more_items_in_collection?: boolean } } }
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        cache:  'no-store',
      })
      if (!res.ok) {
        console.warn(`[pipedrive] fetchWonDeals pipeline=${pipelineId} page=${page} status=${res.status}`)
        break
      }
      json = await res.json()
    } catch (err) {
      console.warn(`[pipedrive] fetchWonDeals pipeline=${pipelineId} page=${page} error:`, err)
      break
    }

    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) break
    all.push(...json.data)

    // Early-exit: last deal on page was won before our floor date
    if (fromDate) {
      const lastWon = json.data[json.data.length - 1]?.won_time
      if (lastWon && new Date(lastWon) < fromDate) break
    }

    if (!json.additional_data?.pagination?.more_items_in_collection) break
    start += limit
  }

  return all
}

export async function fetchBaytecaRevenue(year: number, months: number[]): Promise<BaytecaRevenue> {
  // Start from Jan 1 of the target year so we fetch all won deals in that year,
  // regardless of which months are selected for the funnel filter.
  const deals = await fetchWonDealsForPipeline(7, new Date(year, 0, 1))

  const inRange = (wonTime: string | null): boolean => {
    if (!wonTime) return false
    const d = new Date(wonTime)
    return d.getFullYear() === year && months.includes(d.getMonth() + 1)
  }

  const parseNum = (val: unknown): number => {
    const n = parseFloat(String(val ?? '0'))
    return isNaN(n) ? 0 : n
  }

  let bankFee    = 0
  let membership = 0
  let dealCount  = 0

  for (const deal of deals) {
    if (!inRange(deal.won_time)) continue
    bankFee    += parseNum(deal[FIELD_BANK_FEE])
    membership += parseNum(deal[FIELD_MEMBERSHIP_AMT])
    dealCount++
  }

  return { bankFee, membership, total: bankFee + membership, dealCount }
}

export async function fetchRevenue(
  from: Date,
  to:   Date,
): Promise<{ bayteca: PipelineRevenue; md: PipelineRevenue; total: number }> {
  const [baytecaDeals, mdDeals] = await Promise.all([
    fetchWonDealsForPipeline(7),
    fetchWonDealsForPipeline(10),
  ])

  const inRange = (wonTime: string | null): boolean => {
    if (!wonTime) return false
    const d = new Date(wonTime)
    return d >= from && d <= to
  }

  const parseNum = (val: unknown): number => {
    const n = parseFloat(String(val ?? '0'))
    return isNaN(n) ? 0 : n
  }

  let baytecaTotal = 0
  let baytecaCount = 0
  for (const deal of baytecaDeals) {
    if (!inRange(deal.won_time)) continue
    baytecaTotal += parseNum(deal[FIELD_BANK_FEE])
    baytecaCount++
  }

  let mdTotal = 0
  let mdCount = 0
  for (const deal of mdDeals) {
    if (!inRange(deal.won_time)) continue
    mdTotal += parseNum(deal[FIELD_MEMBERSHIP_AMT])
    mdCount++
  }

  return {
    bayteca: { pipelineId: 7,  pipelineName: 'Bayteca',          total: baytecaTotal, dealCount: baytecaCount },
    md:      { pipelineId: 10, pipelineName: 'Mortgage Direct',  total: mdTotal,      dealCount: mdCount      },
    total:   baytecaTotal + mdTotal,
  }
}
