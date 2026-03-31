import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/database.types'

/** Returns the Supabase Auth user, or null if not signed in. */
export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

/** Redirects to /login if not authenticated. */
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/** Returns the profiles row for the current user, or null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.warn('[getProfile] No auth user:', userError?.message)
    return null
  }

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.warn('[getProfile] Profile query error:', profileError.message, 'uid:', user.id)
  }

  return data ?? null
}

/** Redirects to /login if not authenticated; returns Profile. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

/** Redirects to /tickets if authenticated but not an admin. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== 'admin') redirect('/tickets')
  return profile
}
