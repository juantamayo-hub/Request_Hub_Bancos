import {
  postSlackMessage,
  buildTicketCreatedMessage,
  buildStatusChangedMessage,
} from './slack'
import {
  sendEmail,
  buildTicketCreatedEmail,
  buildStatusChangedEmail,
} from './email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function notifyTicketCreated(p: {
  ticketId:       string
  displayId:      string
  subject:        string
  category:       string
  requesterEmail: string
}) {
  await Promise.allSettled([
    postSlackMessage(buildTicketCreatedMessage({ ...p, appUrl: APP_URL })),
    sendEmail(buildTicketCreatedEmail({ to: p.requesterEmail, ...p, appUrl: APP_URL })),
  ])
}

export async function notifyStatusChanged(p: {
  ticketId:       string
  displayId:      string
  subject:        string
  oldStatus:      string
  newStatus:      string
  updatedBy:      string
  requesterEmail: string
}) {
  await Promise.allSettled([
    postSlackMessage(buildStatusChangedMessage({ ...p, appUrl: APP_URL })),
    sendEmail(buildStatusChangedEmail({
      to:        p.requesterEmail,
      displayId: p.displayId,
      subject:   p.subject,
      newStatus: p.newStatus,
      ticketId:  p.ticketId,
      appUrl:    APP_URL,
    })),
  ])
}
