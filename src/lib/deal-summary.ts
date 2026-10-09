// ============================================================
// Resumen IA de la operación (deal de Pipedrive) para el detalle
// del ticket. Server-side only. Requiere ANTHROPIC_API_KEY.
//
// Se genera al abrir el ticket y se cachea por deal (Vercel Data
// Cache) durante CACHE_SECONDS; "Actualizar" invalida la etiqueta.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { unstable_cache, revalidateTag } from 'next/cache'
import { fetchDealContext, type DealFacts } from '@/lib/deal-context'

const MODEL         = 'claude-opus-5'
const CACHE_SECONDS = 6 * 60 * 60

export interface DealSummaryContent {
  headline:     string
  situation:    string
  health:       'en_curso' | 'atencion' | 'en_riesgo' | 'cerrado'
  last_contact: { date: string; channel: string; summary: string } | null
  timeline:     { date: string; event: string }[]
  people:       { name: string; role: string }[]
  blockers:     string[]
  next_steps:   string[]
}

export interface DealSummary {
  facts:       DealFacts
  summary:     DealSummaryContent
  generatedAt: string
}

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'situation', 'health', 'last_contact', 'timeline', 'people', 'blockers', 'next_steps'],
  properties: {
    headline:  { type: 'string', description: 'Una frase (máx. 20 palabras) con el estado real de la operación.' },
    situation: { type: 'string', description: '2–4 frases: dónde está la operación, qué se ha hecho y qué falta.' },
    health:    { type: 'string', enum: ['en_curso', 'atencion', 'en_riesgo', 'cerrado'] },
    last_contact: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['date', 'channel', 'summary'],
          properties: {
            date:    { type: 'string', description: 'YYYY-MM-DD' },
            channel: { type: 'string', description: 'Llamada, Email, Nota…' },
            summary: { type: 'string', description: 'Qué se habló, en una o dos frases.' },
          },
        },
      ],
    },
    timeline: {
      type: 'array',
      description: 'Hitos clave en orden cronológico (máx. 6).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'event'],
        properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, event: { type: 'string' } },
      },
    },
    people: {
      type: 'array',
      description: 'Personas relevantes (máx. 5): owner, gestor, cliente, contacto del banco…',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role'],
        properties: { name: { type: 'string' }, role: { type: 'string' } },
      },
    },
    blockers:   { type: 'array', items: { type: 'string' }, description: 'Bloqueos o riesgos concretos (máx. 4). Vacío si no hay.' },
    next_steps: { type: 'array', items: { type: 'string' }, description: 'Siguientes pasos accionables (máx. 4).' },
  },
} as const

const SYSTEM_PROMPT = `Eres analista del área bancaria de Bayteca / Mortgage Direct (intermediación hipotecaria en España).
Recibes todo el contexto de Pipedrive de una operación hipotecaria: datos del deal, otros deals del mismo cliente (otros bancos), historial de etapas, notas, actividades, transcripciones de llamadas de Aircall y emails.

Escribe un resumen para el gestor que abre un ticket sobre esta operación, de modo que entienda en 30 segundos dónde está y qué hacer.
- Escribe en español, claro y directo, sin relleno.
- Básate solo en el contexto recibido. Si algo no consta, no lo inventes.
- Prioriza lo reciente y lo que bloquea el avance (documentación pendiente, tasación, FEIN, respuesta del banco, condiciones).
- Las transcripciones pueden contener ruido de reconocimiento de voz: extrae solo lo relevante.
- No copies teléfonos, DNI, IBAN ni otros datos personales sensibles en el resumen.
- health: "cerrado" si el deal está ganado o perdido; "en_riesgo" si hay señales de pérdida o bloqueo largo; "atencion" si hay algo pendiente que requiere acción; si no, "en_curso".`

async function generate(dealId: number): Promise<DealSummary> {
  const context = await fetchDealContext(dealId)
  if (!context) throw new Error(`No se pudo leer el deal ${dealId} en Pipedrive.`)

  const client = new Anthropic()
  const response = await client.beta.messages.create({
    model:      MODEL,
    max_tokens: 16000,
    betas:      ['server-side-fallback-2026-07-01'],
    fallbacks:  'default',
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: SUMMARY_SCHEMA },
    },
    system:   SYSTEM_PROMPT,
    messages: [{
      role:    'user',
      content: `Fecha de hoy: ${new Date().toISOString().slice(0, 10)}\n\n${context.document}`,
    }],
  })

  if (response.stop_reason === 'refusal') throw new Error('El modelo no pudo generar el resumen para este deal.')
  if (response.stop_reason === 'max_tokens') throw new Error('El resumen se cortó antes de terminar.')

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  if (!text) throw new Error('Respuesta vacía del modelo.')

  return {
    facts:       context.facts,
    summary:     JSON.parse(text) as DealSummaryContent,
    generatedAt: new Date().toISOString(),
  }
}

const tagFor = (dealId: number) => `deal-summary-${dealId}`

/** Devuelve el resumen cacheado del deal o lo genera. Los errores no se cachean. */
export function getDealSummary(dealId: number): Promise<DealSummary> {
  return unstable_cache(() => generate(dealId), ['deal-summary', String(dealId)], {
    revalidate: CACHE_SECONDS,
    tags:       [tagFor(dealId)],
  })()
}

/** Descarta el resumen cacheado para que la próxima lectura lo regenere. */
export function invalidateDealSummary(dealId: number): void {
  revalidateTag(tagFor(dealId))
}
