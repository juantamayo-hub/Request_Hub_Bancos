import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * OAuth callback for the "Request Hub Bancos" private Pipedrive app.
 *
 * Pipedrive redirects here after an admin approves the app installation.
 * The app only exposes a Link action (deal → /tickets/new), so we don't
 * need Pipedrive OAuth tokens: we just acknowledge the install and send
 * the user into Request Hub. The `code` is intentionally not exchanged.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  if (searchParams.get('error')) {
    console.warn('[pipedrive/oauth/callback] Installation not completed:', searchParams.get('error'))
    return NextResponse.redirect(`${origin}/home?pipedrive=error`)
  }

  return NextResponse.redirect(`${origin}/home?pipedrive=installed`)
}
