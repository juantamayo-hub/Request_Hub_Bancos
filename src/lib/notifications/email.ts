export interface EmailMessage {
  to:      string
  subject: string
  text:    string
}

/**
 * Sends an email.
 * Stubs gracefully if EMAIL_PROVIDER is not set.
 *
 * To activate Resend:
 *   1. npm install resend
 *   2. Set EMAIL_PROVIDER=resend and RESEND_API_KEY in .env.local
 *   3. Uncomment the block below.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER

  if (!provider) {
    console.log(`[Email stub] To: ${message.to} | Subject: ${message.subject}`)
    return false
  }

  if (provider === 'resend') {
    // const { Resend } = await import('resend')
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // const from = process.env.EMAIL_FROM || 'noreply@huspy.io'
    // const { error } = await resend.emails.send({ from, to: message.to, subject: message.subject, text: message.text })
    // return !error
    console.warn('[Email] Resend integration: uncomment the code in src/lib/notifications/email.ts')
  }

  return false
}

// ─── Message builders ─────────────────────────────────────────

export function buildTicketCreatedEmail(p: {
  to:        string
  displayId: string
  subject:   string
  category:  string
  ticketId:  string
  appUrl:    string
}): EmailMessage {
  return {
    to:      p.to,
    subject: `People Hub – Ticket created: ${p.displayId}`,
    text: [
      `Your ticket has been created successfully.`,
      ``,
      `ID:       ${p.displayId}`,
      `Subject:  ${p.subject}`,
      `Category: ${p.category}`,
      ``,
      `Track status: ${p.appUrl}/tickets/${p.ticketId}`,
    ].join('\n'),
  }
}

export function buildStatusChangedEmail(p: {
  to:        string
  displayId: string
  subject:   string
  newStatus: string
  ticketId:  string
  appUrl:    string
}): EmailMessage {
  return {
    to:      p.to,
    subject: `People Hub – Ticket ${p.displayId} status update`,
    text: [
      `Your ticket status has been updated.`,
      ``,
      `ID:     ${p.displayId}`,
      `Status: ${p.newStatus}`,
      ``,
      `View ticket: ${p.appUrl}/tickets/${p.ticketId}`,
    ].join('\n'),
  }
}
