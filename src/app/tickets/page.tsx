import type { Metadata } from 'next'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TicketList } from '@/components/tickets/TicketList'
import type { TicketWithRelations } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Mis Solicitudes' }

export default async function MyTicketsPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      categories(id, name),
      profiles!tickets_created_by_fkey(id, email, first_name, last_name, avatar_url),
      assignee:profiles!tickets_assignee_id_fkey(id, email, first_name, last_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin={profile.role === 'admin'} />
      <main className="page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Solicitudes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestiona todas tus solicitudes bancarias</p>
          </div>
          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#083D20] text-white text-sm font-medium rounded-lg hover:bg-[#0a4d28] transition-colors"
          >
            + Nueva Solicitud
          </Link>
        </div>

        <TicketList tickets={(tickets ?? []) as TicketWithRelations[]} />
      </main>
    </div>
  )
}
