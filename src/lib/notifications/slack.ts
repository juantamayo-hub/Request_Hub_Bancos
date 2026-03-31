export interface SlackBlock {
  type: string
  [key: string]: unknown
}

export interface SlackMessage {
  text: string
  blocks?: SlackBlock[]
}

// ─── DM via Bot Token ─────────────────────────────────────────

/**
 * Sends a Slack DM to a user identified by email.
 *
 * Required Bot Token scopes:
 *   users:read, users:read.email, chat:write
 *
 * Set SLACK_BOT_TOKEN=xoxb-... in your environment variables.
 */
export async function postSlackDM(email: string, message: SlackMessage): Promise<boolean> {
  const botToken = process.env.SLACK_BOT_TOKEN

  if (!botToken) {
    console.log(`[Slack DM stub] To: ${email} | ${message.text}`)
    return false
  }

  try {
    // 1. Resolve email → Slack user ID
    const lookupRes = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${botToken}` } },
    )
    const lookup = await lookupRes.json() as { ok: boolean; user?: { id: string }; error?: string }

    if (!lookup.ok || !lookup.user?.id) {
      console.warn(`[Slack DM] Could not find user for ${email}: ${lookup.error ?? 'not_found'}`)
      return false
    }

    // 2. Send DM — using the user ID as channel opens a DM automatically
    const sendRes = await fetch('https://slack.com/api/chat.postMessage', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel: lookup.user.id,
        text:    message.text,
        blocks:  message.blocks,
      }),
    })
    const send = await sendRes.json() as { ok: boolean; error?: string }

    if (!send.ok) console.error(`[Slack DM] Failed to send to ${email}: ${send.error}`)
    return send.ok
  } catch (err) {
    console.error('[Slack DM] Error:', err)
    return false
  }
}

// ─── Message builders ─────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new:                 'Nuevo',
  in_progress:         'En Proceso',
  waiting_on_employee: 'Esperando',
  resolved:            'Cancelado',
  closed:              'Cerrado',
}

/**
 * DM sent to the requester when their ticket is created.
 * Link points to the employee-facing view.
 */
export function buildTicketCreatedRequesterMessage(p: {
  displayId: string
  subject:   string
  category:  string
  ticketId:  string
  appUrl:    string
}): SlackMessage {
  const url = `${p.appUrl}/tickets/${p.ticketId}`
  return {
    text: `Your ticket ${p.displayId} has been created`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: *Your ticket has been created*\n*${p.displayId}* — ${p.subject}\nCategory: *${p.category}*\n\nThe People Team will get back to you soon.`,
        },
        accessory: {
          type:  'button',
          style: 'primary',
          text:  { type: 'plain_text', text: 'View Ticket' },
          url,
        },
      },
    ],
  }
}

/**
 * DM sent to the assignee (HR / ops person) when a ticket lands in their queue.
 * Link points to the admin view.
 */
export function buildTicketAssignedMessage(p: {
  displayId:      string
  subject:        string
  category:       string
  requesterEmail: string
  ticketId:       string
  appUrl:         string
}): SlackMessage {
  const url = `${p.appUrl}/admin/tickets/${p.ticketId}`
  return {
    text: `New ticket assigned to you: ${p.displayId} — ${p.subject}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `New Ticket: ${p.displayId}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Subject:*\n${p.subject}` },
          { type: 'mrkdwn', text: `*Category:*\n${p.category}` },
          { type: 'mrkdwn', text: `*From:*\n${p.requesterEmail}` },
          { type: 'mrkdwn', text: `*Status:*\nNew` },
        ],
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', style: 'primary', text: { type: 'plain_text', text: 'View Ticket' }, url },
        ],
      },
    ],
  }
}

/**
 * DM sent to a user when they are promoted to the admin role.
 */
export function buildAdminPromotedMessage(p: {
  firstName: string
  appUrl:    string
}): SlackMessage {
  return {
    text: `You now have admin access to People Hub`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:star: *You've been granted admin access to People Hub, ${p.firstName}!*\n\nYou can now manage tickets, users, and category ownership from the admin panel.`,
        },
        accessory: {
          type: 'button',
          style: 'primary',
          text: { type: 'plain_text', text: 'Go to Admin' },
          url: `${p.appUrl}/admin/tickets`,
        },
      },
    ],
  }
}

/**
 * DM sent to the requester when their ticket is closed.
 * Includes interactive 👍/👎 buttons to collect satisfaction feedback.
 *
 * Requires Slack app to have Interactivity enabled with Request URL:
 *   https://<app-url>/api/slack/interactions
 */
export function buildTicketClosedFeedbackMessage(p: {
  displayId: string
  subject:   string
  ticketId:  string
  appUrl:    string
}): SlackMessage {
  const url = `${p.appUrl}/tickets/${p.ticketId}`
  return {
    text: `Your ticket ${p.displayId} has been closed. Are you satisfied with the resolution?`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: *Your ticket has been closed*\n*${p.displayId}* — ${p.subject}\n\nAre you satisfied with the resolution?`,
        },
      },
      {
        type: 'actions',
        block_id: `feedback_${p.ticketId}`,
        elements: [
          {
            type:      'button',
            style:     'primary',
            text:      { type: 'plain_text', text: '👍 Satisfied', emoji: true },
            action_id: 'feedback_satisfied',
            value:     p.ticketId,
          },
          {
            type:      'button',
            style:     'danger',
            text:      { type: 'plain_text', text: '👎 Not satisfied', emoji: true },
            action_id: 'feedback_unsatisfied',
            value:     p.ticketId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔗 Ver Ticket', emoji: true },
            url,
          },
        ],
      },
    ],
  }
}

/**
 * DM sent to the requester when an admin adds a public comment on their ticket.
 */
export function buildNewCommentMessage(p: {
  displayId:     string
  subject:       string
  commentPreview: string
  ticketId:      string
  appUrl:        string
}): SlackMessage {
  const url     = `${p.appUrl}/tickets/${p.ticketId}`
  const preview = p.commentPreview.length > 200
    ? p.commentPreview.slice(0, 200) + '…'
    : p.commentPreview
  return {
    text: `New comment on ticket ${p.displayId}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:speech_balloon: *New comment on your ticket*\n*${p.displayId}* — ${p.subject}\n\n>${preview}`,
        },
        accessory: {
          type:  'button',
          style: 'primary',
          text:  { type: 'plain_text', text: 'View Ticket' },
          url,
        },
      },
    ],
  }
}

/**
 * DM sent to the requester when their ticket status changes.
 */
export function buildStatusChangedRequesterMessage(p: {
  displayId: string
  subject:   string
  newStatus: string
  ticketId:  string
  appUrl:    string
}): SlackMessage {
  const url   = `${p.appUrl}/tickets/${p.ticketId}`
  const label = STATUS_LABELS[p.newStatus] ?? p.newStatus
  return {
    text: `Ticket ${p.displayId} update: ${label}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:bell: *Ticket Update* — ${p.displayId}\n_${p.subject}_\n\nNew status: *${label}*`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View Ticket' },
          url,
        },
      },
    ],
  }
}

/**
 * DM sent to the requester when their ticket is cancelled.
 * Includes the cancellation reason provided by the admin.
 */
export function buildTicketCancelledMessage(p: {
  displayId:    string
  subject:      string
  cancelReason: string
  ticketId:     string
  appUrl:       string
}): SlackMessage {
  const url = `${p.appUrl}/tickets/${p.ticketId}`
  return {
    text: `Tu solicitud ${p.displayId} ha sido cancelada`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:x: *Tu solicitud ha sido cancelada*\n*${p.displayId}* — ${p.subject}\n\n*Motivo:* ${p.cancelReason}`,
        },
        accessory: {
          type:  'button',
          text:  { type: 'plain_text', text: 'Ver Solicitud' },
          url,
        },
      },
    ],
  }
}
