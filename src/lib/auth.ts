import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/database.types'

/**
 * Returns the Supabase Auth user, or null if not signed in.
 * Wrapped in React `cache` so layout + page + helpers share a single
 * Auth round-trip per server request (no cross-request caching).
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
})

/** Redirects to /login if not authenticated. */
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Returns the profiles row for the current user, or null.
 * Memoized per server request (see `getUser`).
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser()
  if (!user) {
    console.warn('[getProfile] No auth user')
    return null
  }

  const supabase = await createClient()

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.warn('[getProfile] Profile query error:', profileError.message, 'uid:', user.id)
  }

  return data ?? null
})

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
