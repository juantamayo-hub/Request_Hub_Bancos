import { forwardToCommandCenter } from '@/lib/alma'

export const dynamic = 'force-dynamic'

/** "Enviar reporte a Juanjo" desde Request Hub: reenvía al Command Center. */
export async function POST(req: Request) {
  return forwardToCommandCenter('report', req)
}
