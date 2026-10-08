import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * OAuth callback for the "Request Hub Bancos" private Pipedrive app.
 *
 * Pipedrive redirects here after a user approves the app installation.
 * The installation is only completed once the authorization `code` is
 * exchanged for tokens, so we do the exchange here. The app only exposes
 * a Link action (deal → /tickets/new), so the tokens are NOT stored.
 *
 * Required env vars (server-only): PIPEDRIVE_CLIENT_ID, PIPEDRIVE_CLIENT_SECRET
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (searchParams.get('error') || !code) {
    console.warn('[pipedrive/oauth/callback] Installation not completed:', searchParams.get('error') ?? 'no code')
    return NextResponse.redirect(`${origin}/home?pipedrive=error`)
  }

  const clientId     = process.env.PIPEDRIVE_CLIENT_ID
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('[pipedrive/oauth/callback] Missing PIPEDRIVE_CLIENT_ID / PIPEDRIVE_CLIENT_SECRET')
    return NextResponse.redirect(`${origin}/home?pipedrive=error`)
  }

  try {
    const res = await fetch('https://oauth.pipedrive.com/oauth/token', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:  `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: `${origin}/api/pipedrive/oauth/callback`,
      }),
    })

    if (!res.ok) {
      console.error('[pipedrive/oauth/callback] Token exchange failed:', res.status, await res.text())
      return NextResponse.redirect(`${origin}/home?pipedrive=error`)
    }
  } catch (err) {
    console.error('[pipedrive/oauth/callback] Token exchange error:', err)
    return NextResponse.redirect(`${origin}/home?pipedrive=error`)
  }

  return NextResponse.redirect(`${origin}/home?pipedrive=installed`)
}
