export interface SlackBlock {
  type: string
  [key: string]: unknown
}

export interface SlackMessage {
  text: string
  blocks?: SlackBlock[]
}

/**
 * Sends a message to Slack via Incoming Webhook or Bot Token.
 * Stubs gracefully (console.log) if neither env var is set.
 */
export async function postSlackMessage(message: SlackMessage): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  const botToken   = process.env.SLACK_BOT_TOKEN
  const channelId  = process.env.SLACK_CHANNEL_ID

  if (!webhookUrl && !botToken) {
    console.log('[Slack stub]', message.text)
    return false
  }

  try {
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: message.text, blocks: message.blocks }),
      })
      return res.ok
    }

    if (botToken && channelId) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${botToken}`,
        },
        body: JSON.stringify({ channel: channelId, text: message.text, blocks: message.blocks }),
      })
      const data = (await res.json()) as { ok: boolean }
      return data.ok
    }
  } catch (err) {
    console.error('[Slack] Error sending message:', err)
  }

  return false
}

// ─── Message builders ─────────────────────────────────────────

export function buildTicketCreatedMessage(p: {
  ticketId:       string
  displayId:      string
  subject:        string
  category:       string
  requesterEmail: string
  appUrl:         string
}): SlackMessage {
  const url = `${p.appUrl}/admin/tickets/${p.ticketId}`
  return {
    text: `New ticket: ${p.displayId} — ${p.subject}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `New Ticket: ${p.displayId}` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Subject:*\n${p.subject}` },
          { type: 'mrkdwn', text: `*Category:*\n${p.category}` },
          { type: 'mrkdwn', text: `*Requester:*\n${p.requesterEmail}` },
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

export function buildStatusChangedMessage(p: {
  ticketId:   string
  displayId:  string
  subject:    string
  oldStatus:  string
  newStatus:  string
  updatedBy:  string
  appUrl:     string
}): SlackMessage {
  const url = `${p.appUrl}/admin/tickets/${p.ticketId}`
  return {
    text: `${p.displayId} status: ${p.oldStatus} → ${p.newStatus}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${p.displayId} — status updated*\n_${p.subject}_\n\n${p.oldStatus} → *${p.newStatus}*\nUpdated by: ${p.updatedBy}`,
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
