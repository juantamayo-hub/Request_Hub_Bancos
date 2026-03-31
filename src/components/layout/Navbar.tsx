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
            className="flex items-center gap-2.5 no-underline hover:opacity-90 transition-opacity"
          >
            {/* Co-brand lockup: Bayteca + MD */}
            <div className="flex items-center gap-2">
              <Image
                src="/logo-bayteca.svg"
                alt="Bayteca"
                width={96}
                height={28}
                className="h-6 w-auto object-contain"
                quality={100}
                priority
              />
              <span className="text-gray-300 font-light text-lg leading-none">·</span>
              <Image
                src="/logo-md-black.svg"
                alt="Mortgage Direct"
                width={96}
                height={28}
                className="h-6 w-auto object-contain"
                quality={100}
                priority
              />
            </div>
            <span className="text-sm font-medium text-gray-500 hidden sm:inline">Request Hub</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/tickets"
              className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-[#E8F2EC] hover:text-[#083D20] transition-colors"
            >
              Mis Solicitudes
            </Link>

            {isAdmin && (
              <>
                <Link
                  href="/admin/tickets"
                  className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-[#E8F2EC] hover:text-[#083D20] transition-colors"
                >
                  Todos los Tickets
                </Link>
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-[#E8F2EC] hover:text-[#083D20] transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className="px-3 py-1.5 rounded-md text-gray-600 hover:bg-[#E8F2EC] hover:text-[#083D20] transition-colors"
                >
                  Usuarios
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1F3657] text-white font-medium">
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
              <div className="w-7 h-7 rounded-full bg-[#E8F2EC] flex items-center justify-center text-xs font-medium text-[#083D20]">
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
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
