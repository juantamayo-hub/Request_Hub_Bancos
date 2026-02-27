import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { TicketForm } from '@/components/tickets/TicketForm'

export const metadata: Metadata = { title: 'New Ticket' }

export default async function NewTicketPage() {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} isAdmin={profile.role === 'admin'} />
      <main className="page-container">
        <div className="max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">New Ticket</h1>
            <p className="text-sm text-gray-500 mt-0.5">Describe your issue and we'll route it to the right team.</p>
          </div>
          <TicketForm categories={categories ?? []} />
        </div>
      </main>
    </div>
  )
}
