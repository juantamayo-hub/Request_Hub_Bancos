import type { Metadata } from 'next'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TicketList } from '@/components/tickets/TicketList'
import { TicketFilters } from '@/components/tickets/TicketFilters'
import type { TicketWithRelations } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Mis Solicitudes' }

interface Props {
  searchParams: Promise<{
    category_id?: string
    from?:        string
    to?:          string
  }>
}

export default async function MyTicketsPage({ searchParams }: Props) {
  const sp      = await searchParams
  const profile = await requireProfile()
  const supabase = await createClient()

  let query = supabase
    .from('tickets')
    .select(`
      *,
      categories(id, name),
      profiles!tickets_created_by_fkey(id, email, first_name, last_name, avatar_url),
      assignee:profiles!tickets_assignee_id_fkey(id, email, first_name, last_name, avatar_url)
    `)

  if (sp.category_id) query = query.eq('category_id', sp.category_id)
  if (sp.from)        query = query.gte('created_at', sp.from)
  if (sp.to)          query = query.lte('created_at', `${sp.to}T23:59:59`)

  const [{ data: tickets }, { data: categories }] = await Promise.all([
    query.order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name').eq('is_active', true).eq('is_system', false).order('name'),
  ])

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

        <TicketFilters
          current={{ category_id: sp.category_id, from: sp.from, to: sp.to }}
          categories={categories ?? []}
        />

        <TicketList tickets={(tickets ?? []) as TicketWithRelations[]} />
      </main>
    </div>
  )
}
