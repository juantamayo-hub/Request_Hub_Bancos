import { forwardToCommandCenter } from '@/lib/alma'

export const dynamic = 'force-dynamic'

/** Mensaje de Slack que Alma preparó y la persona confirmó: reenvía al Command Center. */
export async function POST(req: Request) {
  return forwardToCommandCenter('slack', req)
}
