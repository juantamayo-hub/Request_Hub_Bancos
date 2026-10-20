import { NextResponse, after, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────

interface SlackAction {
  action_id: string
  value:     string
}

interface SlackBlockActionsPayload {
  type:         'block_actions'
  trigger_id:   string
  response_url: string
  user:         { id: string; username: string }
  actions:      SlackAction[]
}

interface SlackViewSubmissionPayload {
  type:    'view_submission'
  user:    { id: string }
  view: {
    callback_id:      string
    private_metadata: string
    state: {
      values: {
        comment_block?: {
          comment_input?: { value: string | null }
        }
        agent_email_block?: {
          agent_email_input?: { value: string | null }
        }
      }
    }
  }
}

type SlackPayload = SlackBlockActionsPayload | SlackViewSubmissionPayload

// ─── Signature verification ───────────────────────────────────

async function verifySlackSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) return true  // skip verification in dev if not configured

  const timestamp = req.headers.get('x-slack-request-timestamp')
  const signature = req.headers.get('x-slack-signature')
  if (!timestamp || !signature) return false

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false

  const sigBase   = `v0:${timestamp}:${rawBody}`
  const hmac      = createHmac('sha256', signingSecret).update(sigBase).digest('hex')
  const computed  = `v0=${hmac}`

  try {
    return timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'))
  } catch {
    return false
  }
}

// ─── Slack API helpers ────────────────────────────────────────

async function slackApi(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; [key: string]: unknown }> {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) {
    console.log('[Slack stub]', method, body)
    return { ok: false }
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
    body:    JSON.stringify(body),
  })
  return res.json()
}

async function getUserEmail(slackUserId: string): Promise<string | null> {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return null
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const data = await res.json() as { ok: boolean; user?: { profile?: { email?: string } } }
    return data.ok ? (data.user?.profile?.email ?? null) : null
  } catch {
    return null
  }
}

// ─── Handler ─────────────────────────────────────────────────

/**
 * POST /api/slack/interactions
 *
 * Handles Slack interactive component payloads:
 *  1. block_actions  — user clicked 👍/👎 button → open feedback modal
 *  2. view_submission — user submitted the feedback modal → store result
 *  3. block_actions 'add_bank_agent' → modal for a bank gestor's email; on submit → Command Center
 *     POST /api/santander/agents (env COMMAND_CENTER_URL + COMMAND_CENTER_API_SECRET)
 *
 * Required env vars:
 *   SLACK_BOT_TOKEN       xoxb-...
 *   SLACK_SIGNING_SECRET  (from Slack app Basic Information page)
 *
 * Required Slack app settings:
 *   Interactivity & Shortcuts → Request URL: https://<app-url>/api/slack/interactions
 *   Bot Token Scopes: chat:write, users:read, users:read.email
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!(await verifySlackSignature(request, rawBody))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Slack sends payload as URL-encoded form field
  const params  = new URLSearchParams(rawBody)
  const raw     = params.get('payload')
  if (!raw) return new NextResponse('', { status: 200 })

  let payload: SlackPayload
  try {
    payload = JSON.parse(raw) as SlackPayload
  } catch {
    return new NextResponse('', { status: 200 })
  }

  // ── Button click: open feedback modal ──────────────────────
  if (payload.type === 'block_actions') {
    const action = payload.actions?.[0]

    // ── Gestor de banco sin correo: abrir modal para añadirlo (Command Center → Santander gestores) ──
    if (action?.action_id === 'add_bank_agent') {
      let info: { bank?: string; agentName?: string; dealId?: number | null } = {}
      try { info = JSON.parse(action.value) } catch { /* valor inválido: modal sin datos */ }
      await slackApi('views.open', {
        trigger_id: payload.trigger_id,
        view: {
          type:             'modal',
          callback_id:      'add_bank_agent_modal',
          private_metadata: JSON.stringify({ ...info, response_url: payload.response_url }).slice(0, 2900),
          title:  { type: 'plain_text', text: 'Correo del gestor' },
          submit: { type: 'plain_text', text: 'Guardar y asignar' },
          close:  { type: 'plain_text', text: 'Cancelar' },
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `*${info.agentName ?? 'Gestor'}* (${info.bank ?? 'banco'})\nSe guardará en la lista de gestores y se completarán sus asignaciones pendientes en Pipedrive.` },
            },
            {
              type:     'input',
              block_id: 'agent_email_block',
              label:    { type: 'plain_text', text: 'Correo' },
              element: {
                type:        'email_text_input',
                action_id:   'agent_email_input',
                placeholder: { type: 'plain_text', text: 'nombre@gruposantander.es' },
              },
            },
          ],
        },
      })
      return new NextResponse('', { status: 200 })
    }

    if (!action || !['feedback_satisfied', 'feedback_unsatisfied'].includes(action.action_id)) {
      return new NextResponse('', { status: 200 })
    }

    const satisfied     = action.action_id === 'feedback_satisfied'
    const ticketId      = action.value
    const requesterEmail = await getUserEmail(payload.user.id) ?? ''

    const sentimentText = satisfied
      ? ':thumbsup: *Satisfied*\nAny additional comments? (optional)'
      : ':thumbsdown: *Not satisfied*\nWhat could have been better? (optional)'

    await slackApi('views.open', {
      trigger_id: payload.trigger_id,
      view: {
        type:             'modal',
        callback_id:      'ticket_feedback_modal',
        private_metadata: JSON.stringify({
          ticketId,
          satisfied,
          requesterEmail,
          response_url: payload.response_url,
        }),
        title:  { type: 'plain_text', text: 'Your feedback' },
        submit: { type: 'plain_text', text: 'Submit' },
        close:  { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: sentimentText },
          },
          {
            type:      'input',
            block_id:  'comment_block',
            optional:  true,
            label:     { type: 'plain_text', text: 'Comment' },
            element: {
              type:        'plain_text_input',
              action_id:   'comment_input',
              multiline:   true,
              placeholder: { type: 'plain_text', text: 'Write your comment here...' },
            },
          },
        ],
      },
    })

    return new NextResponse('', { status: 200 })
  }

  // ── Modal submission: correo de un gestor de banco → Command Center ──
  if (payload.type === 'view_submission' && payload.view.callback_id === 'add_bank_agent_modal') {
    let meta: { bank?: string; agentName?: string; dealId?: number | null; response_url?: string } = {}
    try { meta = JSON.parse(payload.view.private_metadata) } catch { /* sin metadatos */ }
    const email = (payload.view.state.values?.agent_email_block?.agent_email_input?.value ?? '').trim().toLowerCase()
    const errors = (msg: string) => new NextResponse(
      JSON.stringify({ response_action: 'errors', errors: { agent_email_block: msg } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errors('Correo no válido')
    if (!meta.agentName) return errors('Falta el nombre del gestor')

    const ccUrl    = process.env.COMMAND_CENTER_URL?.replace(/\/$/, '')
    const ccSecret = process.env.COMMAND_CENTER_API_SECRET
    if (!ccUrl || !ccSecret) return errors('Command Center no configurado (COMMAND_CENTER_URL / COMMAND_CENTER_API_SECRET)')

    // Slack solo espera 3 s la respuesta del modal: se cierra ya y el resultado (o el error con su causa)
    // se escribe en el mismo DM cuando el Command Center termina.
    const updateDm = (text: string) => meta.response_url
      ? fetch(meta.response_url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            replace_original: true,
            text,
            blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
          }),
        }).then(() => undefined).catch(console.error)
      : Promise.resolve()

    after(async () => {
      const addedBy = (await getUserEmail(payload.user.id)) ?? `slack:${payload.user.id}`
      await updateDm(`:hourglass_flowing_sand: Guardando *${meta.agentName}* → ${email} y completando sus asignaciones…`)
      try {
        const res = await fetch(`${ccUrl}/api/santander/agents`, {
          method:   'POST',
          headers:  { 'Content-Type': 'application/json', 'x-offers-secret': ccSecret },
          body:     JSON.stringify({ name: meta.agentName, email, added_by: addedBy }),
          redirect: 'manual',
        })
        const raw = await res.text()
        let result: { assigned?: number; error?: string } = {}
        try { result = JSON.parse(raw) } catch { /* no es JSON */ }
        if (!res.ok || result.error) {
          const why = result.error
            ?? (res.status >= 300 && res.status < 400
              ? `redirección ${res.status} (¿COMMAND_CENTER_URL apunta a un entorno protegido?)`
              : `respuesta ${res.status} no válida`)
          console.error('add_bank_agent → Command Center:', res.status, raw.slice(0, 300))
          await updateDm(`:warning: No se pudo añadir *${meta.agentName}* → ${email}: ${why}. Inténtalo de nuevo o añádelo en Command Center → Configuración → Santander → Asignaciones.`)
          return
        }
        const n = result.assigned ?? 0
        await updateDm(`:white_check_mark: *Gestor añadido:* ${meta.agentName} → ${email}\n${n} ${n === 1 ? 'asignación completada' : 'asignaciones completadas'} en Pipedrive.`)
      } catch (e) {
        console.error('add_bank_agent → Command Center error:', e)
        await updateDm(`:warning: No se pudo contactar con el Command Center (${String(e instanceof Error ? e.message : e).slice(0, 120)}).`)
      }
    })

    return new NextResponse(JSON.stringify({ response_action: 'clear' }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Modal submission: store feedback ──────────────────────
  if (payload.type === 'view_submission' && payload.view.callback_id === 'ticket_feedback_modal') {
    let meta: { ticketId: string; satisfied: boolean; requesterEmail: string; response_url?: string }
    try {
      meta = JSON.parse(payload.view.private_metadata)
    } catch {
      return new NextResponse(JSON.stringify({ response_action: 'clear' }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const comment = payload.view.state.values?.comment_block?.comment_input?.value ?? null

    // Store feedback via service-role client
    const admin = createAdminClient()
    await admin.from('ticket_feedback').upsert(
      {
        ticket_id:       meta.ticketId,
        requester_email: meta.requesterEmail || `slack:${payload.user.id}`,
        satisfied:       meta.satisfied,
        comment:         comment || null,
      },
      { onConflict: 'ticket_id' },
    )

    // Also post a comment on the ticket thread
    if (meta.requesterEmail) {
      const { data: authorProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', meta.requesterEmail)
        .single()

      if (authorProfile) {
        const emoji   = meta.satisfied ? '👍' : '👎'
        const label   = meta.satisfied ? 'Satisfecho' : 'No satisfecho'
        const body    = comment
          ? `${emoji} Feedback: ${label}\n\n${comment}`
          : `${emoji} Feedback: ${label}`
        await admin.from('ticket_comments').insert({
          ticket_id:  meta.ticketId,
          author_id:  authorProfile.id,
          body,
          visibility: 'public',
        })
      }
    }

    // Update the original Slack message to remove buttons and confirm receipt
    if (meta.response_url) {
      const sentimentLabel = meta.satisfied ? '👍 Satisfied' : '👎 Not satisfied'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const ticketUrl = `${appUrl}/tickets/${meta.ticketId}`
      fetch(meta.response_url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          replace_original: true,
          text:             '✅ Feedback received. Thank you!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: *Feedback received* — ${sentimentLabel}\n\nThank you for taking a moment to respond. Your input helps us improve.`,
              },
              accessory: {
                type:  'button',
                text:  { type: 'plain_text', text: 'View Ticket' },
                url:   ticketUrl,
              },
            },
          ],
        }),
      }).catch(console.error)
    }

    return new NextResponse(JSON.stringify({ response_action: 'clear' }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new NextResponse('', { status: 200 })
}
