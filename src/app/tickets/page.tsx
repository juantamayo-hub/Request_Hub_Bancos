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
    category_ids?: string  // comma-separated
    from?:         string
    to?:           string
    deal_id?:      string  // Pipedrive deal ID (exact match)
    client_name?:  string  // partial text search
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

  if (sp.category_ids) {
    const ids = sp.category_ids.split(',').filter(Boolean)
    if (ids.length > 0) query = query.in('category_id', ids)
  }
  if (sp.from) query = query.gte('created_at', sp.from)
  if (sp.to)   query = query.lte('created_at', `${sp.to}T23:59:59`)
  if (sp.deal_id) {
    const parsed = parseInt(sp.deal_id, 10)
    if (!isNaN(parsed) && parsed > 0) query = query.eq('pipedrive_deal_id', parsed)
  }
  if (sp.client_name?.trim()) query = query.ilike('client_name', `%${sp.client_name.trim()}%`)

  const [{ data: tickets }, { data: categories }, { data: unreadNotifs }] = await Promise.all([
    query.order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name').eq('is_active', true).eq('is_system', false).order('name'),
    supabase.from('notifications').select('ticket_id').eq('is_read', false),
  ])
  const unreadTicketIds = new Set((unreadNotifs ?? []).map(n => n.ticket_id as string))

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
          current={{ category_ids: sp.category_ids, from: sp.from, to: sp.to, deal_id: sp.deal_id, client_name: sp.client_name }}
          categories={categories ?? []}
        />

        <TicketList tickets={(tickets ?? []) as TicketWithRelations[]} unreadTicketIds={unreadTicketIds} />
      </main>
    </div>
  )
}
