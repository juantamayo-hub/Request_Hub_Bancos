import { forwardToCommandCenter } from '@/lib/alma'

export const dynamic = 'force-dynamic'

/** Vídeo «Cómo usarme» de Alma: lo sirve el Command Center (con login; tiene datos reales). */
export async function GET(req: Request) {
  return forwardToCommandCenter('tutorial', req)
}
