import { createClient } from '@supabase/supabase-js'

/**
 * Admin (service-role) Supabase client.
 *
 * IMPORTANT:
 * - Only import this in Route Handlers (server-side).
 * - NEVER use in Client Components or expose to the browser.
 * - Bypasses all Row Level Security — validate manually in code.
 * - Requires SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local (server-side only, no NEXT_PUBLIC_ prefix).',
    )
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
