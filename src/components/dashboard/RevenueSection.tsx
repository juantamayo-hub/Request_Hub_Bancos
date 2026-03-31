import { fetchRevenue } from '@/lib/pipedrive'
import { RevenueStrip } from './RevenueStrip'

interface Props {
  from:      Date
  to:        Date
  fromLabel: string
  toLabel:   string
}

export async function RevenueSection({ from, to, fromLabel, toLabel }: Props) {
  let revenue = null
  try {
    const raw = await fetchRevenue(from, to)
    revenue = {
      bayteca:   raw.bayteca.total,
      md:        raw.md.total,
      total:     raw.total,
      dealCount: { bayteca: raw.bayteca.dealCount, md: raw.md.dealCount },
    }
  } catch (err) {
    console.error('Pipedrive revenue fetch failed:', err)
  }

  if (!revenue) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Revenue · Operaciones Ganadas
        </p>
        <p className="text-sm text-gray-400 mt-2">No se pudo cargar el revenue desde Pipedrive.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
      <div className="px-6 pt-4 pb-0 border-b border-gray-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
          Revenue · Operaciones Ganadas
        </p>
      </div>
      <RevenueStrip
        revenue={revenue}
        dateRange={{ from: fromLabel, to: toLabel }}
      />
    </div>
  )
}
