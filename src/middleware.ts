import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_DOMAIN ?? 'huspy.io'

// Paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/auth/callback', '/unauthorized']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session. IMPORTANT: do not remove this call.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // Not authenticated → redirect to login (except public paths)
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }

  if (user) {
    // ─── Domain enforcement (server-side, belt-and-suspenders) ───
    const email = user.email ?? ''
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'domain')
      return NextResponse.redirect(url)
    }

    // Authenticated users visiting /login → redirect to /tickets
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/tickets'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
