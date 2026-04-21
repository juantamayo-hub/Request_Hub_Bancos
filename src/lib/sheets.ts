// ============================================================
// Google Sheets API utility — Request Hub Bancos
// Server-side only. Never import in client components.
//
// Setup (one-time, done by admin):
// 1. Go to https://console.cloud.google.com/
// 2. Create/select project → Enable "Google Sheets API"
// 3. IAM & Admin → Service Accounts → Create service account
// 4. Download JSON key
// 5. Share the spreadsheet with the service account email (viewer)
// 6. Set env vars in Vercel:
//    GOOGLE_SERVICE_ACCOUNT_EMAIL  (e.g. my-sa@project.iam.gserviceaccount.com)
//    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  (paste the "private_key" from JSON, keep \n)
//    GOOGLE_SHEETS_ID  = 1HP5oNhiu_sltIpvN04ZuOto4mmltL7Kj_U9n9Z2LI5U
// ============================================================

import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!

export function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
    process.env.GOOGLE_SHEETS_ID
  )
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ── List available sheets ─────────────────────────────────────

export async function listSheetNames(): Promise<string[]> {
  const sheets   = await getSheetsClient()
  const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  return (response.data.sheets ?? []).map(s => s.properties?.title ?? '')
}

// ── Generic range reader ──────────────────────────────────────

export async function readRange(range: string): Promise<(string | number | null)[][]> {
  const sheets   = await getSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  })
  return (response.data.values ?? []) as (string | number | null)[][]
}

// ── Sheet name resolver ───────────────────────────────────────

/**
 * Finds a sheet by keywords (all must match, case-insensitive).
 * When multiple sheets match, returns the shortest name (most specific match).
 */
function findSheet(names: string[], ...keywords: string[]): string | null {
  const lower   = keywords.map(k => k.toLowerCase())
  const matches = names.filter(n => lower.every(k => n.toLowerCase().includes(k)))
  if (matches.length === 0) return null
  return matches.sort((a, b) => a.length - b.length)[0]
}

function quoteSheet(name: string): string {
  // Escape single quotes by doubling them, then wrap in single quotes
  return `'${name.replace(/'/g, "''")}'`
}

// ── Structured data fetchers ──────────────────────────────────

export interface LostReasonCount {
  reason: string
  count:  number
}

/**
 * Reads lost reasons from the RAW DATA tab, column O (lost reason field).
 */
export async function fetchLostReasons(sheetNames: string[]): Promise<LostReasonCount[]> {
  const sheet = findSheet(sheetNames, 'raw data', 'bank area')
  if (!sheet) {
    console.warn('[sheets] RAW DATA sheet not found. Available:', sheetNames)
    return []
  }
  const rows = await readRange(`${quoteSheet(sheet)}!O3:O`)

  const counts = new Map<string, number>()
  for (const row of rows) {
    const val = String(row[0] ?? '').trim()
    if (!val || val === 'null' || val === 'undefined') continue
    counts.set(val, (counts.get(val) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)  // top 15
}

export interface VolumeByBank {
  bankName: string
  fein:     number
  bor:      number
}

/**
 * Reads volume by bank from the "Main huge calculations" tab.
 */
export async function fetchVolumeByBank(year: number, sheetNames: string[]): Promise<VolumeByBank[]> {
  const sheet = findSheet(sheetNames, 'main', 'banks')
  if (!sheet) {
    console.warn('[sheets] Main calculations sheet not found. Available:', sheetNames)
    return []
  }
  const rows = await readRange(`${quoteSheet(sheet)}!A:AK`)
  if (rows.length < 2) return []

  // Find year column index from header row (row 0)
  const headerRow = rows[0] as (string | number | null)[]
  const yearColIdx = headerRow.findIndex(v => Number(v) === year)

  if (yearColIdx === -1) return []

  const result = new Map<string, VolumeByBank>()

  for (const row of rows.slice(2)) {
    const area       = String(row[0] ?? '').trim()
    const metricType = String(row[1] ?? '').trim()
    const metric     = String(row[2] ?? '').trim()
    const bankName   = String(row[3] ?? '').trim()

    if (!bankName || bankName === 'All' || bankName === 'Bank name |Year,  Quarter and month') continue
    if (metricType !== '#' || metric !== 'Volume') continue

    const volume = Number(row[yearColIdx] ?? 0)
    if (!result.has(bankName)) result.set(bankName, { bankName, fein: 0, bor: 0 })
    const entry = result.get(bankName)!

    if (area === 'FEIN') entry.fein += volume
    if (area === 'BoR')  entry.bor  += volume
  }

  return Array.from(result.values())
    .filter(b => b.fein > 0 || b.bor > 0)
    .sort((a, b) => b.fein - a.fein)
}

export interface ConversionByBank {
  bankName:    string
  borToVal:    number | null
  valToFein:   number | null
  feinToWon:   number | null
}

/**
 * Reads BoR→VAL conversion rates by bank from the "Calculations" tab.
 */
export async function fetchConversionsByBank(sheetNames: string[]): Promise<ConversionByBank[]> {
  const sheet = findSheet(sheetNames, 'calculation')
  if (!sheet) {
    console.warn('[sheets] Calculations sheet not found. Available:', sheetNames)
    return []
  }
  const rows = await readRange(`${quoteSheet(sheet)}!A4:BK`)
  if (rows.length < 2) return []

  const result = new Map<string, ConversionByBank>()

  // Look for rows with bank data: col B = date (BoR month), col C = bank name, col Q = total conversion
  for (const row of rows.slice(1)) {
    const bankName   = String(row[2] ?? '').trim()
    const totalConv  = row[17]  // column R (index 17) = "Total conversions" for BoR→VAL

    if (!bankName || bankName === 'Bank Name / Nombre del Banco' || bankName === '(No bank selected)') continue
    if (totalConv == null) continue

    const rate = typeof totalConv === 'number' ? totalConv : parseFloat(String(totalConv))
    if (isNaN(rate)) continue

    if (!result.has(bankName)) {
      result.set(bankName, { bankName, borToVal: null, valToFein: null, feinToWon: null })
    }
    // Most recent row per bank = last update wins
    result.get(bankName)!.borToVal = Math.round(rate * 100)
  }

  return Array.from(result.values())
    .filter(b => b.borToVal !== null)
    .sort((a, b) => (b.borToVal ?? 0) - (a.borToVal ?? 0))
}
