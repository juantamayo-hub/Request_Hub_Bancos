import { forwardToCommandCenter } from '@/lib/alma'

export const dynamic = 'force-dynamic'

/** 👍/👎 sobre una respuesta de Alma: reenvía al Command Center. */
export async function POST(req: Request) {
  return forwardToCommandCenter('feedback', req)
}
