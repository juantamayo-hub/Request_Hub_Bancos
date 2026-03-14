import { NextResponse, type NextRequest } from 'next/server'
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
    if (!action || !['feedback_satisfied', 'feedback_unsatisfied'].includes(action.action_id)) {
      return new NextResponse('', { status: 200 })
    }

    const satisfied     = action.action_id === 'feedback_satisfied'
    const ticketId      = action.value
    const requesterEmail = await getUserEmail(payload.user.id) ?? ''

    const sentimentText = satisfied
      ? ':thumbsup: *Satisfecho*\n¿Tienes algún comentario adicional? (opcional)'
      : ':thumbsdown: *No satisfecho*\n¿Qué podría haber sido mejor? (opcional)'

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
        title:  { type: 'plain_text', text: 'Tu feedback' },
        submit: { type: 'plain_text', text: 'Enviar' },
        close:  { type: 'plain_text', text: 'Cancelar' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: sentimentText },
          },
          {
            type:      'input',
            block_id:  'comment_block',
            optional:  true,
            label:     { type: 'plain_text', text: 'Comentario' },
            element: {
              type:        'plain_text_input',
              action_id:   'comment_input',
              multiline:   true,
              placeholder: { type: 'plain_text', text: 'Escribe tu comentario aquí...' },
            },
          },
        ],
      },
    })

    return new NextResponse('', { status: 200 })
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

    // Update the original Slack message to remove buttons and confirm receipt
    if (meta.response_url) {
      const sentimentLabel = meta.satisfied ? '👍 Satisfecho' : '👎 No satisfecho'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const ticketUrl = `${appUrl}/tickets/${meta.ticketId}`
      fetch(meta.response_url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          replace_original: true,
          text:             '✅ Feedback recibido. ¡Gracias!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: *Feedback recibido* — ${sentimentLabel}\n\nGracias por tomarte un momento para responder. Tu opinión nos ayuda a mejorar.`,
              },
              accessory: {
                type:  'button',
                text:  { type: 'plain_text', text: 'Ver Ticket' },
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
