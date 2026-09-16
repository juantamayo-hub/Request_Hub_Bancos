import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { requireProfile } from '@/lib/auth'
import { Navbar } from '@/components/layout/Navbar'
import { Avatar } from '@/components/shared/Avatar'

export const metadata: Metadata = { title: 'Inicio — Request Hub' }

export default async function HomePage() {
  const profile = await requireProfile()
  const isAdmin = profile.role === 'admin'
  const greeting = getGreeting()

  return (
    <>
      <Navbar profile={profile} isAdmin={isAdmin} />

      <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#FAFAF8] px-4">
        <div className="max-w-xl w-full text-center py-16">
          {/* User greeting */}
          <div className="flex flex-col items-center mb-10">
            <Avatar
              name={profile.first_name}
              email={profile.email}
              avatarUrl={profile.avatar_url}
              size="lg"
            />
            <h1 className="text-2xl font-bold text-gray-900 mt-4">
              {greeting}, {profile.first_name ?? profile.email.split('@')[0]}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Selecciona a dónde quieres ir
            </p>
          </div>

          {/* Two options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ticket System */}
            <Link
              href="/tickets"
              className="group flex flex-col items-center gap-4 p-8 bg-white border border-gray-200 rounded-2xl hover:border-[#083D20] hover:shadow-lg transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-[#E8F2EC] flex items-center justify-center group-hover:bg-[#083D20] transition-colors">
                <svg className="w-7 h-7 text-[#083D20] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#083D20] transition-colors">
                  Ticket System
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Crear y gestionar solicitudes bancarias
                </p>
              </div>
            </Link>

            {/* Command Center */}
            <a
              href="https://banks-command-center.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-4 p-8 bg-white border border-gray-200 rounded-2xl hover:border-[#1F3657] hover:shadow-lg transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-[#EEF3FA] flex items-center justify-center group-hover:bg-[#1F3657] transition-colors">
                <svg className="w-7 h-7 text-[#1F3657] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#1F3657] transition-colors">
                  Command Center
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Panel de control y operaciones
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abre en nueva pestaña
              </span>
            </a>
          </div>

          {/* Footer logos */}
          <div className="mt-12 flex items-center justify-center gap-3 opacity-40">
            <Image src="/logo-bayteca.svg" alt="Bayteca" width={72} height={20} className="h-4 w-auto" />
            <span className="text-gray-300 font-light">·</span>
            <Image src="/logo-md-black.svg" alt="Mortgage Direct" width={72} height={20} className="h-3.5 w-auto" />
          </div>
        </div>
      </main>
    </>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
