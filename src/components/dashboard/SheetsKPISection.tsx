'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────

interface LostReason    { reason: string; count: number }
interface VolumeByBank  { bankName: string; fein: number; bor: number }
interface ConvByBank    { bankName: string; borToVal: number | null }

interface SheetsData {
  configured:       boolean
  year?:            number
  lostReasons?:     LostReason[]
  volumeByBank?:    VolumeByBank[]
  conversionsByBank?: ConvByBank[]
  error?:           string
}

// ── Setup card ────────────────────────────────────────────────

function SetupCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-8 mb-6">
      <div className="max-w-xl">
        <p className="text-sm font-semibold text-gray-700 mb-1">Google Sheets KPIs — Configuración requerida</p>
        <p className="text-xs text-gray-500 mb-4">
          Para mostrar los KPIs del Sheets (volumen por banco, razones de pérdida, conversiones), configura una cuenta de servicio de Google Cloud.
        </p>
        <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
          <li>Ve a <strong>console.cloud.google.com</strong> → habilita <em>Google Sheets API</em></li>
          <li>IAM &amp; Admin → Service Accounts → Crear cuenta de servicio</li>
          <li>Descarga la clave JSON y copia el <code>client_email</code> y <code>private_key</code></li>
          <li>Comparte el spreadsheet con el email de la cuenta de servicio (lector)</li>
          <li>
            Agrega en Vercel estas env vars:
            <ul className="mt-1 ml-4 space-y-0.5 font-mono">
              <li><code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code></li>
              <li><code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code></li>
              <li><code>GOOGLE_SHEETS_ID = 1HP5oNhiu_sltIpvN04ZuOto4mmltL7Kj_U9n9Z2LI5U</code></li>
            </ul>
          </li>
          <li>Redeploy y los charts aparecerán aquí automáticamente</li>
        </ol>
      </div>
    </div>
  )
}

// ── Chart helpers ─────────────────────────────────────────────

const COLORS = [
  '#083D20', '#1F3657', '#2d6a4f', '#40916c', '#52b788',
  '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc',
]

const truncate = (s: string, n = 18) => s.length > n ? s.slice(0, n) + '…' : s

// ── Charts ────────────────────────────────────────────────────

function LostReasonsChart({ data }: { data: LostReason[] }) {
  const top10 = data.slice(0, 10)
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Razones de Pérdida · Top 10
        </p>
      </div>
      <div className="p-4" style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="reason"
              width={180}
              tick={{ fontSize: 10 }}
              tickFormatter={v => truncate(String(v), 28)}
            />
            <Tooltip
              formatter={(v) => [v, 'Deals']}
              labelFormatter={l => String(l)}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {top10.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#6b7280' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function VolumeByBankChart({ data, year }: { data: VolumeByBank[]; year: number }) {
  const top12 = data.slice(0, 12)
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Volumen FEIN por Banco · {year}
        </p>
      </div>
      <div className="p-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top12} margin={{ left: 8, right: 16, top: 4, bottom: 40 }}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="bankName"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
              tickFormatter={v => truncate(String(v), 14)}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v) => [v, 'FEINs']}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="fein" name="FEIN" radius={[4, 4, 0, 0]}>
              {top12.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ConversionsByBankChart({ data }: { data: ConvByBank[] }) {
  const chartData = data
    .filter(d => d.borToVal !== null)
    .slice(0, 12)
    .map(d => ({ bankName: d.bankName, rate: d.borToVal ?? 0 }))

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
      <div className="px-6 pt-4 pb-3 border-b border-gray-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Conversión BoR → Valuation por Banco (%)
        </p>
      </div>
      <div className="p-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 8, right: 16, top: 4, bottom: 40 }}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="bankName"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
              tickFormatter={v => truncate(String(v), 14)}
            />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip
              formatter={(v) => [`${v}%`, 'BoR→VAL']}
              contentStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="rate" name="BoR→VAL" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.rate >= 70 ? '#083D20' : entry.rate >= 45 ? '#d97706' : '#ef4444'}
                />
              ))}
              <LabelList
                dataKey="rate"
                position="top"
                formatter={(v: unknown) => `${v}%`}
                style={{ fontSize: 10, fill: '#6b7280' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────

export function SheetsKPISection() {
  const year = new Date().getFullYear()
  const [data,    setData]    = useState<SheetsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/dashboard/sheets-kpi?year=${year}`)
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(() => { setData({ configured: false }); setLoading(false) })
  }, [year])

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-8 mb-6 text-center">
        <p className="text-sm text-gray-400">Cargando KPIs del Sheets…</p>
      </div>
    )
  }

  if (!data?.configured) return <SetupCard />

  if (data.error) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <p className="text-sm text-red-500">Error al cargar Sheets: {data.error}</p>
      </div>
    )
  }

  return (
    <>
      {data.lostReasons && data.lostReasons.length > 0 && (
        <LostReasonsChart data={data.lostReasons} />
      )}
      {data.volumeByBank && data.volumeByBank.length > 0 && (
        <VolumeByBankChart data={data.volumeByBank} year={data.year ?? year} />
      )}
      {data.conversionsByBank && data.conversionsByBank.length > 0 && (
        <ConversionsByBankChart data={data.conversionsByBank} />
      )}
    </>
  )
}
