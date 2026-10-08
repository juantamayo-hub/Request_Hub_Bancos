import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TicketForm } from '@/components/tickets/TicketForm'

export const metadata: Metadata = { title: 'Nueva Solicitud' }

interface Props {
  // selectedIds: sent by the Pipedrive Link action; dealId: manual links
  searchParams: Promise<{ selectedIds?: string; dealId?: string }>
}

export default async function NewTicketPage({ searchParams }: Props) {
  const sp            = await searchParams
  const rawDealId     = (sp.selectedIds ?? sp.dealId ?? '').split(',')[0].trim()
  const initialDealId = /^\d+$/.test(rawDealId) ? rawDealId : undefined

  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin={profile.role === 'admin'} />
      <main className="page-container">
        <div className="max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Nueva Solicitud</h1>
            <p className="text-sm text-gray-500 mt-0.5">Rellena el formulario y asignaremos la solicitud al equipo bancario.</p>
          </div>
          <TicketForm categories={categories ?? []} initialDealId={initialDealId} />
        </div>
      </main>
    </div>
  )
}
