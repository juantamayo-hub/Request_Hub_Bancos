import type { Metadata } from 'next'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { AdminFilters } from '@/components/admin/AdminFilters'
import { TicketList } from '@/components/tickets/TicketList'
import type { TicketWithRelations, TicketStatus, TicketPriority } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Admin — Todas las Solicitudes' }

interface Props {
  searchParams: Promise<{
    status?:   TicketStatus
    priority?: TicketPriority
    q?:        string
  }>
}

export default async function AdminTicketsPage({ searchParams }: Props) {
  const sp       = await searchParams
  const profile  = await requireProfile()
  const supabase = await createClient()

  // Base query — RLS admin policy returns all tickets.
  let query = supabase
    .from('tickets')
    .select(`
      *,
      categories(id, name),
      profiles!tickets_created_by_fkey(id, email, first_name, last_name, avatar_url),
      assignee:profiles!tickets_assignee_id_fkey(id, email, first_name, last_name, avatar_url)
    `)

  if (sp.status)   query = query.eq('status', sp.status)
  if (sp.priority) query = query.eq('priority', sp.priority)
  if (sp.q) {
    query = query.or(
      `subject.ilike.%${sp.q}%,display_id.ilike.%${sp.q}%`,
    )
  }

  const { data: tickets } = await query.order('created_at', { ascending: false })

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Todas las Solicitudes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tickets?.length ?? 0} solicitud{tickets?.length !== 1 ? 'es' : ''}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline">
            Dashboard →
          </Link>
        </div>

        <AdminFilters current={sp} />

        <div className="mt-4">
          <TicketList
            tickets={(tickets ?? []) as TicketWithRelations[]}
            isAdmin
          />
        </div>
      </main>
    </div>
  )
}
