import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Navbar } from '@/components/layout/Navbar'
import { UserManagementClient } from '@/components/admin/UserManagementClient'
import type { Profile } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Admin — Gestión de Usuarios' }

export type CategoryWithRule = {
  id:   string
  name: string
  routing_rules: {
    id:                 string
    owner_email:        string
    backup_owner_email: string | null
    assignee_emails:    string[] | null
    sla_hours:          number
    default_priority:   string
  }[]
}

export default async function UsersPage() {
  const profile = await requireProfile()
  const admin   = createAdminClient()

  const [{ data: profiles }, { data: categories }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, first_name, last_name, role, department, avatar_url, is_available, created_at, updated_at')
      .order('first_name', { ascending: true }),
    admin
      .from('categories')
      .select('id, name, routing_rules(id, owner_email, backup_owner_email, assignee_emails, sla_hours, default_priority)')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona usuarios, roles, disponibilidad y responsables por categoría.
          </p>
        </div>

        <UserManagementClient
          profiles={(profiles ?? []) as Profile[]}
          currentUserId={profile.id}
          categories={(categories ?? []) as CategoryWithRule[]}
        />
      </main>
    </div>
  )
}
