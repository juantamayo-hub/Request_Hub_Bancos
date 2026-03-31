import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_DOMAINS = ['huspy.io', 'bayteca.com']

/**
 * OAuth callback handler.
 * Uses cookies() from next/headers so session tokens are correctly
 * persisted and available to Server Components on the next request.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tickets'

  if (!code) {
    console.error('[auth/callback] No code in URL')
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const email = data.user?.email ?? ''
  console.log('[auth/callback] Authenticated:', email)

  if (!ALLOWED_DOMAINS.some(domain => email.endsWith(`@${domain}`))) {
    console.warn('[auth/callback] Domain not allowed:', email)
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=domain`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
