'use client'

import { useCallback, useState } from 'react'
import {
  Sparkles, RefreshCw, AlertTriangle, ArrowRight, Phone, Mail, StickyNote,
  Layers, User, Landmark, ChevronDown, ExternalLink, CircleCheck,
} from 'lucide-react'
import type { DealSummary, DealSummaryContent } from '@/lib/deal-summary'

interface Props {
  ticketId: string
  dealId:   number
}

const HEALTH: Record<DealSummaryContent['health'], { label: string; className: string; dot: string }> = {
  en_curso:  { label: 'En curso',          className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  atencion:  { label: 'Requiere atención', className: 'bg-amber-50 text-amber-800 ring-amber-200',       dot: 'bg-amber-500' },
  en_riesgo: { label: 'En riesgo',         className: 'bg-red-50 text-red-700 ring-red-200',             dot: 'bg-red-500' },
  cerrado:   { label: 'Cerrado',           className: 'bg-gray-100 text-gray-700 ring-gray-200',          dot: 'bg-gray-400' },
}

const DEAL_STATUS: Record<string, string> = { open: 'Abierto', won: 'Ganado', lost: 'Perdido' }

function formatDay(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1)  return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.round(mins / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`
}

function Fact({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70 ring-1 ring-black/5">
        <Icon className="h-3.5 w-3.5 text-[#1F3657]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-gray-900 truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-[#083D20]">
        <Sparkles className="h-4 w-4 animate-spin [animation-duration:3s]" />
        Leyendo Pipedrive (notas, llamadas, emails) y redactando el resumen…
      </div>
      <div className="h-5 w-3/4 rounded bg-gray-200" />
      <div className="space-y-2">
        <div className="h-3 rounded bg-gray-100" />
        <div className="h-3 rounded bg-gray-100" />
        <div className="h-3 w-5/6 rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}

export function DealSummaryCard({ ticketId, dealId }: Props) {
  const [data, setData]       = useState<DealSummary | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async (refresh: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/tickets/${ticketId}/summary`, { method: refresh ? 'POST' : 'GET', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo generar el resumen.')
      setData(json as DealSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el resumen.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  const s      = data?.summary
  const f      = data?.facts
  const health = s ? HEALTH[s.health] ?? HEALTH.en_curso : null

  return (
    <section className="card overflow-hidden mb-6" aria-label="Resumen de la operación">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-[#083D20] to-[#1F3657] text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-200" />
          <h2 className="text-sm font-semibold truncate">Resumen de la operación</h2>
          <span className="hidden sm:inline text-[11px] text-white/60">· generado con IA a partir de Pipedrive</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {data && !loading && <span className="hidden sm:inline text-[11px] text-white/60">{timeAgo(data.generatedAt)}</span>}
          {data && (
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          )}
        </div>
      </div>

      {!loading && !data && !error && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-gray-600">
            Resume en segundos el estado del deal: notas, llamadas, emails, etapa y owner.
          </p>
          <button
            type="button"
            onClick={() => void load(false)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#083D20] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0a4d28] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Generar resumen con IA
          </button>
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && error && (
        <div className="p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">{error}</p>
            <button type="button" onClick={() => void load(false)} className="mt-1 text-[#083D20] font-medium hover:underline">
              Reintentar
            </button>
          </div>
        </div>
      )}

      {!loading && s && f && health && (
        <>
          {/* Facts strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 bg-[#F4F8F5] border-b border-gray-100">
            <Fact icon={Layers}   label="Etapa"  value={f.stageName} />
            <Fact icon={User}     label="Owner"  value={f.ownerName} />
            <Fact icon={Landmark} label="Banco"  value={f.bankName} />
            <Fact icon={CircleCheck} label="Deal" value={`${DEAL_STATUS[f.status] ?? f.status}${f.lostReason ? ` · ${f.lostReason}` : ''}`} />
          </div>

          <div className="p-5 space-y-5">
            {/* Headline */}
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${health.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                {health.label}
              </span>
              <p className="mt-2 text-base font-semibold text-gray-900 leading-snug">{s.headline}</p>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{s.situation}</p>
            </div>

            {/* Next steps + blockers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#083D20] mb-2">Próximos pasos</p>
                {s.next_steps.length ? (
                  <ul className="space-y-1.5">
                    {s.next_steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-800">
                        <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-[#083D20]" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-500">Sin pasos pendientes.</p>}
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">Bloqueos y riesgos</p>
                {s.blockers.length ? (
                  <ul className="space-y-1.5">
                    {s.blockers.map((b, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-800">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-500">No se detectan bloqueos.</p>}
              </div>
            </div>

            {/* Last contact */}
            {s.last_contact && (
              <div className="flex gap-3 rounded-lg bg-[#EEF3FA] p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#1F3657]/10">
                  {/mail|email|correo/i.test(s.last_contact.channel)
                    ? <Mail className="h-4 w-4 text-[#1F3657]" />
                    : /llam|call|tel/i.test(s.last_contact.channel)
                      ? <Phone className="h-4 w-4 text-[#1F3657]" />
                      : <StickyNote className="h-4 w-4 text-[#1F3657]" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1F3657]">
                    Último contacto · {s.last_contact.channel} · {formatDay(s.last_contact.date)}
                  </p>
                  <p className="text-sm text-gray-700 mt-0.5">{s.last_contact.summary}</p>
                </div>
              </div>
            )}

            {/* Timeline + people (collapsible) */}
            {(s.timeline.length > 0 || s.people.length > 0) && (
              <div>
                <button
                  type="button"
                  onClick={() => setExpanded(v => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                  aria-expanded={expanded}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  {expanded ? 'Ocultar cronología y personas' : 'Ver cronología y personas'}
                </button>

                {expanded && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {s.timeline.length > 0 && (
                      <ol className="sm:col-span-2 relative border-l-2 border-emerald-100 ml-1.5 space-y-3">
                        {s.timeline.map((t, i) => (
                          <li key={i} className="pl-4 relative">
                            <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#083D20]" />
                            <p className="text-[11px] font-semibold text-gray-500">{formatDay(t.date)}</p>
                            <p className="text-sm text-gray-800">{t.event}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                    {s.people.length > 0 && (
                      <ul className="space-y-2">
                        {s.people.map((p, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1F3657] text-[11px] font-semibold text-white">
                              {p.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                              <p className="text-[11px] text-gray-500 truncate">{p.role}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer: sources */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-t border-gray-100 text-[11px] text-gray-500">
            <span className="inline-flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1"><StickyNote className="h-3.5 w-3.5" />{f.counts.notes} notas</span>
              <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{f.counts.calls} llamadas</span>
              <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{f.counts.emails} emails</span>
              <span>· Revisa los datos clave en Pipedrive antes de actuar.</span>
            </span>
            <a
              href={`https://app.pipedrive.com/deal/${dealId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#083D20] hover:underline"
            >
              Abrir en Pipedrive <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </>
      )}
    </section>
  )
}
