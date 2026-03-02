export interface EmailMessage {
  to:      string
  subject: string
  text:    string
}

/**
 * Sends an email via Resend.
 *
 * Setup:
 *   1. npm install resend
 *   2. In Vercel (or .env.local) set:
 *        EMAIL_PROVIDER=resend
 *        RESEND_API_KEY=re_xxxxxxxxxxxx
 *        EMAIL_FROM=noreply@huspy.io   (or a verified sender domain)
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER

  if (!provider) {
    console.log(`[Email stub] To: ${message.to} | Subject: ${message.subject}`)
    return false
  }

  if (provider === 'resend') {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from   = process.env.EMAIL_FROM || 'noreply@huspy.io'
      const { error } = await resend.emails.send({
        from,
        to:      message.to,
        subject: message.subject,
        text:    message.text,
      })
      if (error) {
        console.error('[Email] Resend error:', error)
        return false
      }
      return true
    } catch (err) {
      console.error('[Email] Resend send failed:', err)
      return false
    }
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
  const ticketUrl = `${p.appUrl}/tickets/${p.ticketId}`
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
      `Track your ticket: ${ticketUrl}`,
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
  const ticketUrl = `${p.appUrl}/tickets/${p.ticketId}`
  return {
    to:      p.to,
    subject: `People Hub – Ticket ${p.displayId} status update`,
    text: [
      `Your ticket status has been updated.`,
      ``,
      `ID:     ${p.displayId}`,
      `Status: ${p.newStatus}`,
      ``,
      `View ticket: ${ticketUrl}`,
    ].join('\n'),
  }
}
