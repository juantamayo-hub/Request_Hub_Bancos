import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root page: redirect to /tickets if logged in, else /login.
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/tickets' : '/login')
}
