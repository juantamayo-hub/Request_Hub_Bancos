// ============================================================
// Contexto completo de un deal de Pipedrive para el resumen IA.
// Server-side only. Never import in client components.
//
// Los deals bancarios (pipelines 7/10) guardan notas e historial;
// los emails y las llamadas de Aircall (con transcripción) cuelgan
// de la persona, así que se leen desde ahí.
// ============================================================

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN!
const BASE_URL  = 'https://api.pipedrive.com/v1'

const FIELD_BANK_NAME = 'c3a445b9bf0422b9db09abc776cf2dc281b7e975'

// Límites para que el prompt no crezca sin control con deals muy largos
const MAX_NOTES          = 30
const MAX_ACTIVITIES     = 40
const MAX_CALL_CHARS     = 8_000   // por transcripción
const MAX_MAILS          = 25
const MAX_MAIL_BODIES    = 6       // cuerpos completos solo de los más recientes
const MAX_MAIL_BODY_CHAR = 3_000
const MAX_NOTE_CHARS     = 2_000

export interface DealFacts {
  dealId:      number
  title:       string
  status:      'open' | 'won' | 'lost' | string
  stageName:   string | null
  pipelineId:  number | null
  ownerName:   string | null
  clientName:  string | null
  bankName:    string | null
  lostReason:  string | null
  addTime:     string | null
  stageChangeTime: string | null
  counts: { notes: number; emails: number; calls: number; activities: number }
}

export interface DealContext {
  facts: DealFacts
  /** Texto plano con todo el contexto, listo para el prompt. */
  document: string
}

async function pd<T = unknown>(path: string): Promise<T | null> {
  const sep = path.includes('?') ? '&' : '?'
  try {
    const res = await fetch(`${BASE_URL}/${path}${sep}api_token=${API_TOKEN}`, {
      signal: AbortSignal.timeout(10_000),
      cache:  'no-store',
    })
    if (!res.ok) {
      console.error(`[deal-context] GET ${path.split('?')[0]} failed (${res.status})`)
      return null
    }
    const json = await res.json()
    return (json.data ?? null) as T | null
  } catch (err) {
    console.error(`[deal-context] GET ${path.split('?')[0]} error:`, err)
    return null
  }
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)} […recortado]` : text
}

type Named = { name?: string } | null | undefined
const nameOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? ((v as Named)?.name ?? null) : null
const idOf = (v: unknown): number | null =>
  v && typeof v === 'object' ? (((v as { value?: number }).value) ?? null) : (typeof v === 'number' ? v : null)

interface PdDeal {
  id: number; title: string; status: string; stage_id: number; pipeline_id: number
  user_id: unknown; person_id: unknown; add_time: string | null; stage_change_time: string | null
  lost_reason: string | null; won_time: string | null; lost_time: string | null
  [key: string]: unknown
}
interface PdNote     { add_time: string; content: string; user?: Named }
interface PdActivity { type: string; subject: string; note: string | null; due_date: string; done: boolean; owner_name?: string }
interface PdMail     { id: number; subject: string | null; snippet: string | null; message_time: string; from?: { email_address?: string; name?: string }[] }
interface PdFlow     { object: string; timestamp: string; data: { field_key?: string; old_value?: string; new_value?: string; additional_data?: Record<string, unknown> } }
interface PdStage    { id: number; name: string }

export async function fetchDealContext(dealId: number): Promise<DealContext | null> {
  const deal = await pd<PdDeal>(`deals/${dealId}`)
  if (!deal) return null

  const personId = idOf(deal.person_id)

  const [stage, notes, flow, activities, mails, personDeals] = await Promise.all([
    pd<PdStage>(`stages/${deal.stage_id}`),
    pd<PdNote[]>(`notes?deal_id=${dealId}&limit=${MAX_NOTES}&sort=add_time%20DESC`),
    pd<PdFlow[]>(`deals/${dealId}/flow?limit=100`),
    personId ? pd<PdActivity[]>(`persons/${personId}/activities?limit=100`) : Promise.resolve(null),
    personId ? pd<{ data?: PdMail }[] | PdMail[]>(`persons/${personId}/mailMessages?limit=${MAX_MAILS}`) : Promise.resolve(null),
    personId ? pd<PdDeal[]>(`persons/${personId}/deals?status=all_not_deleted&limit=50`) : Promise.resolve(null),
  ])

  // Nombres de etapa para el historial de cambios
  const stageIds = new Set<number>()
  for (const f of flow ?? []) {
    if (f.object === 'dealChange' && f.data.field_key === 'stage_id') {
      if (f.data.old_value) stageIds.add(Number(f.data.old_value))
      if (f.data.new_value) stageIds.add(Number(f.data.new_value))
    }
  }
  for (const d of personDeals ?? []) stageIds.add(d.stage_id)
  const stageNames: Record<number, string> = { [deal.stage_id]: stage?.name ?? `Etapa ${deal.stage_id}` }
  await Promise.all([...stageIds].filter(id => !stageNames[id]).map(async id => {
    const s = await pd<PdStage>(`stages/${id}`)
    if (s) stageNames[id] = s.name
  }))

  const mailList: PdMail[] = (mails ?? []).map(m => ('data' in m && m.data ? m.data : m) as PdMail)
    .sort((a, b) => (b.message_time ?? '').localeCompare(a.message_time ?? ''))

  const mailBodies = await Promise.all(mailList.slice(0, MAX_MAIL_BODIES).map(async m => {
    const full = await pd<{ body?: string }>(`mailbox/mailMessages/${m.id}?include_body=1`)
    return stripHtml(full?.body)
  }))

  const acts = (activities ?? [])
    .sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))
    .slice(0, MAX_ACTIVITIES)
  const isCall = (a: PdActivity) => a.type === 'call' || a.type.startsWith('aircall')

  // ─── Documento para el prompt ───────────────────────────────
  const out: string[] = []
  out.push('## Deal')
  out.push(`- ID: ${deal.id}`)
  out.push(`- Título: ${deal.title}`)
  out.push(`- Estado: ${deal.status}${deal.lost_reason ? ` (motivo pérdida: ${deal.lost_reason})` : ''}`)
  out.push(`- Etapa actual: ${stageNames[deal.stage_id]} (desde ${deal.stage_change_time ?? 'desconocido'})`)
  out.push(`- Owner: ${nameOf(deal.user_id) ?? '—'}`)
  out.push(`- Cliente: ${nameOf(deal.person_id) ?? '—'}`)
  out.push(`- Banco: ${(deal[FIELD_BANK_NAME] as string | null) ?? '—'}`)
  out.push(`- Creado: ${deal.add_time ?? '—'}`)

  if (personDeals?.length) {
    out.push('\n## Otros deals del mismo cliente')
    for (const d of personDeals.filter(d => d.id !== deal.id)) {
      out.push(`- #${d.id} "${d.title}" — pipeline ${d.pipeline_id}, etapa ${stageNames[d.stage_id] ?? d.stage_id}, estado ${d.status}`)
    }
  }

  const stageChanges = (flow ?? []).filter(f => f.object === 'dealChange' && f.data.field_key === 'stage_id')
  if (stageChanges.length) {
    out.push('\n## Historial de etapas')
    for (const f of stageChanges.reverse()) {
      const from = stageNames[Number(f.data.old_value)] ?? f.data.old_value
      const to   = stageNames[Number(f.data.new_value)] ?? f.data.new_value
      out.push(`- ${f.timestamp}: ${from} → ${to}`)
    }
  }

  if (notes?.length) {
    out.push('\n## Notas del deal (más recientes primero)')
    for (const n of notes) {
      out.push(`- [${n.add_time}] ${nameOf(n.user) ?? ''}: ${clip(stripHtml(n.content), MAX_NOTE_CHARS)}`)
    }
  }

  if (acts.length) {
    out.push('\n## Actividades y llamadas del cliente (más recientes primero)')
    for (const a of acts) {
      const note = stripHtml(a.note)
      const body = note ? `\n  ${clip(note, isCall(a) ? MAX_CALL_CHARS : MAX_NOTE_CHARS).replace(/\n/g, '\n  ')}` : ''
      out.push(`- [${a.due_date}] (${a.type}${a.done ? ', hecha' : ', pendiente'}) ${a.subject}${a.owner_name ? ` — ${a.owner_name}` : ''}${body}`)
    }
  }

  if (mailList.length) {
    out.push('\n## Emails con el cliente (más recientes primero)')
    mailList.forEach((m, i) => {
      const from = m.from?.[0]?.name || m.from?.[0]?.email_address || '—'
      const text = mailBodies[i] ? clip(mailBodies[i]!, MAX_MAIL_BODY_CHAR) : (m.snippet ?? '')
      out.push(`- [${m.message_time}] De: ${from} — Asunto: ${m.subject ?? '(sin asunto)'}\n  ${text.replace(/\n/g, '\n  ')}`)
    })
  }

  return {
    facts: {
      dealId,
      title:      deal.title,
      status:     deal.status,
      stageName:  stageNames[deal.stage_id] ?? null,
      pipelineId: deal.pipeline_id,
      ownerName:  nameOf(deal.user_id),
      clientName: nameOf(deal.person_id),
      bankName:   (deal[FIELD_BANK_NAME] as string | null) ?? null,
      lostReason: deal.lost_reason,
      addTime:    deal.add_time,
      stageChangeTime: deal.stage_change_time,
      counts: {
        notes:      notes?.length ?? 0,
        emails:     mailList.length,
        calls:      acts.filter(isCall).length,
        activities: acts.length,
      },
    },
    document: out.join('\n'),
  }
}
