import type { Metadata } from 'next'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { AdminFilters } from '@/components/admin/AdminFilters'
import { TicketList } from '@/components/tickets/TicketList'
import type { TicketWithRelations, TicketPriority } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Admin — Todas las Solicitudes' }

interface Props {
  searchParams: Promise<{
    statuses?:      string  // comma-separated
    priority?:      TicketPriority
    q?:             string
    assignee?:      string
    category_ids?:  string  // comma-separated
    from?:          string
    to?:            string
    source?:        string  // '' | 'system' | 'manual'
    deal_id?:       string  // Pipedrive deal ID (exact match)
    client_name?:   string  // partial text search
  }>
}

export default async function AdminTicketsPage({ searchParams }: Props) {
  const sp       = await searchParams
  const profile  = await requireProfile()
  const supabase = await createClient()

  // Base query — RLS admin policy returns all tickets.
  // Explicit columns only (avoids fetching large fields like description).
  let query = supabase
    .from('tickets')
    .select(`
      id, display_id, subject, status, priority,
      created_at, updated_at, client_name, sla_deadline,
      assignee_id, created_by,
      categories(id, name),
      profiles!tickets_created_by_fkey(email),
      assignee:profiles!tickets_assignee_id_fkey(first_name, email)
    `)

  if (sp.statuses) {
    const vals = sp.statuses.split(',').filter(Boolean)
    if (vals.length > 0) query = query.in('status', vals)
  }
  if (sp.priority)     query = query.eq('priority', sp.priority)
  if (sp.assignee)     query = query.eq('assignee_id', sp.assignee)
  if (sp.category_ids) {
    const ids = sp.category_ids.split(',').filter(Boolean)
    if (ids.length > 0) query = query.in('category_id', ids)
  }
  if (sp.from)         query = query.gte('created_at', sp.from)
  if (sp.to)           query = query.lte('created_at', `${sp.to}T23:59:59`)
  if (sp.source === 'system') query = query.is('created_by', null)
  if (sp.source === 'manual') query = query.not('created_by', 'is', null)
  if (sp.q) {
    // Also searches client_name so gestores can find tickets by applicant name
    query = query.or(
      `subject.ilike.%${sp.q}%,display_id.ilike.%${sp.q}%,client_name.ilike.%${sp.q}%`,
    )
  }
  if (sp.deal_id) {
    const parsed = parseInt(sp.deal_id, 10)
    if (!isNaN(parsed) && parsed > 0) query = query.eq('pipedrive_deal_id', parsed)
  }
  if (sp.client_name?.trim()) query = query.ilike('client_name', `%${sp.client_name.trim()}%`)

  const PAGE_SIZE = 200

  const [{ data: tickets }, { data: admins }, { data: categories }, { data: unreadNotifs }] = await Promise.all([
    query.order('created_at', { ascending: false }).limit(PAGE_SIZE),
    supabase.from('profiles').select('id, email, first_name, last_name').eq('role', 'admin').order('first_name'),
    supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
    supabase.from('notifications').select('ticket_id').eq('is_read', false),
  ])
  const unreadTicketIds = new Set((unreadNotifs ?? []).map(n => n.ticket_id as string))

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Todas las Solicitudes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tickets?.length ?? 0} solicitud{tickets?.length !== 1 ? 'es' : ''}
              {(tickets?.length ?? 0) >= PAGE_SIZE && ' · usa filtros para acotar'}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline">
            Dashboard →
          </Link>
        </div>

        <AdminFilters current={sp} admins={admins ?? []} categories={categories ?? []} />


        <div className="mt-4">
          <TicketList
            tickets={(tickets ?? []) as unknown as TicketWithRelations[]}
            isAdmin
            unreadTicketIds={unreadTicketIds}
          />
        </div>
      </main>
    </div>
  )
}
