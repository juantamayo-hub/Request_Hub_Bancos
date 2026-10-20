import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postSlackDMWithResult, buildAssignmentIssueMessage } from '@/lib/notifications/slack'

function checkAuth(request: NextRequest): boolean {
  const auth   = request.headers.get('authorization') ?? ''
  const secret = process.env.EXTERNAL_API_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

const ALLOWED_DOMAINS = ['bayteca.com', 'huspy.io']

/**
 * POST /api/external/notify/assignment-issue
 *
 * Called by the Command Center when a bank gestor assignment can't be applied automatically
 * (Santander sends a gestor that is not in the list, or no single bank deal matches the DNI).
 * Sends a Slack DM — like the new-ticket notifications — to the person who handles that bank's tickets
 * (routing_rules.bank_overrides, e.g. Santander → Florencia). For agent_missing the DM has a
 * "Añadir correo del gestor" button (see /api/slack/interactions, action_id 'add_bank_agent').
 *
 * Body: { type: 'agent_missing'|'deal_not_found', bank, client_name, dni, agent_name, deal_id, detail,
 *         notify_email? }   ← notify_email only for testing (must be @bayteca.com / @huspy.io)
 * Protected by Authorization: Bearer EXTERNAL_API_SECRET
 */
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    type?: string; bank?: string; client_name?: string | null; dni?: string
    agent_name?: string; deal_id?: number | null; detail?: string; notify_email?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = body.type === 'deal_not_found' ? 'deal_not_found' : body.type === 'agent_missing' ? 'agent_missing' : null
  const bank = (body.bank ?? '').trim()
  if (!type || !bank || !body.dni || !body.agent_name) {
    return NextResponse.json({ error: 'type, bank, dni and agent_name are required' }, { status: 400 })
  }

  // Recipients: explicit test address, or the bank override of the routing rules
  let recipients: string[] = []
  const testEmail = (body.notify_email ?? '').trim().toLowerCase()
  if (testEmail) {
    if (!ALLOWED_DOMAINS.includes(testEmail.split('@')[1] ?? '')) {
      return NextResponse.json({ error: 'notify_email must be @bayteca.com or @huspy.io' }, { status: 400 })
    }
    recipients = [testEmail]
  } else {
    const admin = createAdminClient()
    const { data: rules, error } = await admin.from('routing_rules').select('bank_overrides')
    if (error) {
      console.error('notify/assignment-issue routing_rules error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    for (const r of rules ?? []) {
      for (const o of (r.bank_overrides ?? []) as { bank?: string; assignee_email?: string }[]) {
        if (o.bank?.trim().toLowerCase() === bank.toLowerCase() && o.assignee_email) recipients.push(o.assignee_email.toLowerCase())
      }
    }
    recipients = Array.from(new Set(recipients))
  }
  if (!recipients.length) {
    return NextResponse.json({ error: `No one handles tickets for bank ${bank} (routing_rules.bank_overrides)` }, { status: 422 })
  }

  const ccBase = process.env.COMMAND_CENTER_URL?.replace(/\/$/, '') ?? null
  const message = buildAssignmentIssueMessage({
    type,
    bank,
    clientName: body.client_name ?? null,
    dni:        body.dni,
    agentName:  body.agent_name,
    dealId:     body.deal_id ?? null,
    detail:     body.detail ?? '',
    ccUrl:      ccBase ? `${ccBase}/dashboard/configuracion/${encodeURIComponent(bank.toLowerCase())}?tab=asignaciones` : null,
  })

  const sent = await Promise.all(recipients.map((email) => postSlackDMWithResult(email, message)))
  return NextResponse.json({
    notified: recipients.filter((_, i) => sent[i].ok),
    failed:   recipients.filter((_, i) => !sent[i].ok).map((e) => `${e} [${sent[recipients.indexOf(e)].error}]`),
  })
}
