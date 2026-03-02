import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? 'huspy.io'

/**
 * OAuth callback handler.
 * 1. Exchanges the PKCE code for a session.
 * 2. Attaches session cookies directly to the redirect response.
 * 3. Enforces domain restriction — redirects to login error if invalid.
 *
 * NOTE: cookies are written onto `successResponse` (not via next/headers)
 * so they travel with the redirect and are available on the next request.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tickets'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Build the success redirect upfront so session cookies can be attached to it.
  const successResponse = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // getUser() works because the session is cached in-memory on this client instance.
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? ''

  // ─── Server-side domain enforcement ──────────────────────────
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    // Session cookies were NOT sent to the browser (we return a new response
    // without them), so the user effectively has no session.
    // Middleware will sign out any residual token on the next request.
    return NextResponse.redirect(`${origin}/login?error=domain`)
  }

  return successResponse
}
