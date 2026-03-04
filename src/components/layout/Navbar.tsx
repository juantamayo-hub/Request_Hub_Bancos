'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { displayName } from '@/lib/utils'
import type { Profile } from '@/lib/database.types'

interface Props {
  profile: Profile
  isAdmin?: boolean
}

export function Navbar({ profile, isAdmin = false }: Props) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo + nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/tickets"
            className="flex items-center gap-2.5 text-gray-900 no-underline hover:opacity-90 transition-opacity"
          >
            <Image
              src="/logo-huspy.png"
              alt="Huspy"
              width={192}
              height={56}
              className="h-7 w-auto object-contain"
              quality={100}
              priority
            />
            <span className="text-sm font-medium text-gray-500 hidden sm:inline">People Hub</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/tickets"
              className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              My Tickets
            </Link>

            {isAdmin && (
              <>
                <Link
                  href="/admin/tickets"
                  className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  All Tickets
                </Link>
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  Users
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-900 text-white font-medium">
              Admin
            </span>
          )}

          <div className="flex items-center gap-2">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName(profile)}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {(profile.first_name?.[0] ?? profile.email[0]).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-700 hidden sm:block">
              {displayName(profile)}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
