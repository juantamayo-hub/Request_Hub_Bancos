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

// ── Generic range reader ──────────────────────────────────────

export async function readRange(range: string): Promise<(string | number | null)[][]> {
  const sheets   = await getSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  })
  return (response.data.values ?? []) as (string | number | null)[][]
}

// ── Structured data fetchers ──────────────────────────────────

export interface LostReasonCount {
  reason: string
  count:  number
}

/**
 * Reads lost reasons from "RAW DATA Bank Area Conversions," tab, column O.
 * Returns top reasons sorted by count desc, ignoring nulls/blanks.
 */
export async function fetchLostReasons(): Promise<LostReasonCount[]> {
  // Column O = lost reason. Skip header row (row 2 is header in this sheet).
  const rows = await readRange("'RAW DATA Bank Area Conversions,'!O3:O")

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
 * Reads volume by bank from "Main huge calculations per Main" tab.
 * Returns yearly totals for FEIN volume per bank.
 * Row structure: (Area, MetricType, Metric, BankName, 2025_total, Q1, Jan, ...)
 */
export async function fetchVolumeByBank(year: number): Promise<VolumeByBank[]> {
  const rows = await readRange("'Main huge calculations per Main'!A:AK")
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
 * Reads BoR→Won conversion rates by bank from the "Calculations" tab.
 * Extracts the most recent month's rates per bank.
 */
export async function fetchConversionsByBank(): Promise<ConversionByBank[]> {
  // The Calculations sheet is very wide — read only the first section (BoR conversions)
  // Row 4 (index 3) has headers: BoR month, Bank Name, ..., M0, M1, M2, M3, M4, M4+, Total conversions
  // We look for the "Total conversions" column for BoR→VAL, VAL→FEIN, FEIN→Won

  // Read a manageable section
  const rows = await readRange("'Calculations'!A4:BK")
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
