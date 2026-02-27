import type { Metadata } from 'next'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TicketList } from '@/components/tickets/TicketList'
import type { TicketWithRelations } from '@/lib/database.types'

export const metadata: Metadata = { title: 'My Tickets' }

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
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} isAdmin={profile.role === 'admin'} />
      <main className="page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track all your support requests</p>
          </div>
          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            + New Ticket
          </Link>
        </div>

        <TicketList tickets={(tickets ?? []) as TicketWithRelations[]} />
      </main>
    </div>
  )
}
