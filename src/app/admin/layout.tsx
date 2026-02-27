import { requireAdmin } from '@/lib/auth'

/**
 * Admin layout guard: redirects to /tickets if the
 * signed-in user is not an admin. Server-side check.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin() // redirects non-admins
  return <>{children}</>
}
