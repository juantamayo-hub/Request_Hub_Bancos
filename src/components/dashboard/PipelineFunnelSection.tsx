import { fetchFunnelConversions } from '@/lib/pipedrive'
import { PipelineFunnelStrip }   from './PipelineFunnelStrip'

interface Props {
  from:      Date
  to:        Date
  fromLabel: string
  toLabel:   string
}

export async function PipelineFunnelSection({ from, to, fromLabel, toLabel }: Props) {
  let data = null
  try {
    data = await fetchFunnelConversions(from, to)
  } catch (err) {
    console.error('Pipedrive funnel fetch failed:', err)
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Funnel de Conversión · Bayteca Bank Area
        </p>
        <p className="text-sm text-gray-400 mt-2">No se pudo cargar el funnel desde Pipedrive.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
      <div className="px-6 pt-4 pb-0 border-b border-gray-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pb-3">
          Funnel de Conversión · Bayteca Bank Area
        </p>
      </div>
      <PipelineFunnelStrip
        data={data}
        dateRange={{ from: fromLabel, to: toLabel }}
      />
    </div>
  )
}
