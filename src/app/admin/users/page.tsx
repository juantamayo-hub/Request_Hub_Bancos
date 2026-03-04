import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Navbar } from '@/components/layout/Navbar'
import { UserManagementClient } from '@/components/admin/UserManagementClient'
import type { Profile, SupportTypeOwner } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Admin — User Management' }

export default async function UsersPage() {
  const profile = await requireProfile()
  const admin   = createAdminClient()

  const [{ data: profiles }, { data: owners }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, first_name, last_name, role, department, avatar_url, is_available, created_at, updated_at')
      .order('first_name', { ascending: true }),
    admin
      .from('support_type_owners')
      .select('*')
      .order('support_type')
      .order('sort_order'),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage users, roles, availability, and category ownership.
          </p>
        </div>

        <UserManagementClient
          profiles={(profiles ?? []) as Profile[]}
          owners={(owners ?? []) as SupportTypeOwner[]}
          currentUserId={profile.id}
        />
      </main>
    </div>
  )
}
