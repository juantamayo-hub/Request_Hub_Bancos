import { forwardToCommandCenter } from '@/lib/alma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Chat con Alma: valida la sesión de Request Hub y reenvía (streaming) al Command Center. */
export async function POST(req: Request) {
  return forwardToCommandCenter('chat', req)
}
