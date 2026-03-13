import {
  postSlackDM,
  buildTicketCreatedRequesterMessage,
  buildTicketAssignedMessage,
  buildStatusChangedRequesterMessage,
  buildTicketClosedFeedbackMessage,
  buildAdminPromotedMessage,
} from './slack'
import {
  sendEmail,
  buildTicketCreatedEmail,
  buildStatusChangedEmail,
} from './email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Fires when a ticket is created.
 * - DM to the requester: "your ticket was created"
 * - DM to the assignee: "new ticket in your queue"
 * - Email to the requester (if EMAIL_PROVIDER is configured)
 */
export async function notifyTicketCreated(p: {
  ticketId:       string
  displayId:      string
  subject:        string
  category:       string
  requesterEmail: string
  assigneeEmail?: string
}) {
  const tasks = [
    // DM → requester
    postSlackDM(
      p.requesterEmail,
      buildTicketCreatedRequesterMessage({
        displayId: p.displayId,
        subject:   p.subject,
        category:  p.category,
        ticketId:  p.ticketId,
        appUrl:    APP_URL,
      }),
    ),
    // Email → requester
    sendEmail(buildTicketCreatedEmail({ to: p.requesterEmail, ...p, appUrl: APP_URL })),
  ]

  // DM → assignee (only if different from requester)
  if (p.assigneeEmail && p.assigneeEmail !== p.requesterEmail) {
    tasks.push(
      postSlackDM(
        p.assigneeEmail,
        buildTicketAssignedMessage({
          displayId:      p.displayId,
          subject:        p.subject,
          category:       p.category,
          requesterEmail: p.requesterEmail,
          ticketId:       p.ticketId,
          appUrl:         APP_URL,
        }),
      ),
    )
  }

  await Promise.allSettled(tasks)
}

/**
 * Fires when a user is promoted to admin.
 * Sends a Slack DM to the new admin.
 */
export async function notifyAdminPromoted(p: {
  email:     string
  firstName: string
}) {
  await postSlackDM(
    p.email,
    buildAdminPromotedMessage({ firstName: p.firstName, appUrl: APP_URL }),
  )
}

/**
 * Fires when a ticket status changes.
 * - DM to the requester: status update
 * - Email to the requester (if EMAIL_PROVIDER is configured)
 */
export async function notifyStatusChanged(p: {
  ticketId:       string
  displayId:      string
  subject:        string
  oldStatus:      string
  newStatus:      string
  updatedBy:      string
  requesterEmail: string
}) {
  // When closing a ticket, send a separate feedback DM instead of (or in addition to) the status update
  const slackMessage = p.newStatus === 'closed'
    ? buildTicketClosedFeedbackMessage({
        displayId: p.displayId,
        subject:   p.subject,
        ticketId:  p.ticketId,
      })
    : buildStatusChangedRequesterMessage({
        displayId: p.displayId,
        subject:   p.subject,
        newStatus: p.newStatus,
        ticketId:  p.ticketId,
        appUrl:    APP_URL,
      })

  await Promise.allSettled([
    postSlackDM(p.requesterEmail, slackMessage),
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
