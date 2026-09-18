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

      <main className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center overflow-hidden px-4"
        style={{ background: 'linear-gradient(145deg, #FAFAF8 0%, #f0f4f1 40%, #e8efe9 100%)' }}
      >
        {/* Animated background mesh blobs */}
        <div className="home-mesh-1 pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(8,61,32,0.04) 0%, transparent 70%)' }}
        />
        <div className="home-mesh-2 pointer-events-none absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(31,54,87,0.04) 0%, transparent 70%)' }}
        />
        <div className="home-mesh-1 pointer-events-none absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(82,151,110,0.03) 0%, transparent 65%)', animationDelay: '-7s' }}
        />

        <div className="relative z-10 max-w-xl w-full text-center py-16">

          {/* User greeting — staggered entrance */}
          <div className="flex flex-col items-center mb-12">
            <div className="home-hero-in" style={{ animationDelay: '0.1s' }}>
              <div className="relative">
                <Avatar
                  name={profile.first_name}
                  email={profile.email}
                  avatarUrl={profile.avatar_url}
                  size="lg"
                />
                {/* Glow ring behind avatar */}
                <div className="absolute inset-0 rounded-full -z-10"
                  style={{
                    background: 'radial-gradient(circle, rgba(8,61,32,0.12) 0%, transparent 70%)',
                    transform: 'scale(1.8)',
                  }}
                />
              </div>
            </div>
            <h1 className="home-hero-in text-2xl font-bold text-gray-900 mt-5"
              style={{ animationDelay: '0.25s' }}
            >
              {greeting}, {profile.first_name ?? profile.email.split('@')[0]}
            </h1>
            <p className="home-hero-in text-sm text-gray-500 mt-1.5"
              style={{ animationDelay: '0.35s' }}
            >
              Selecciona a dónde quieres ir
            </p>
          </div>

          {/* Animated cards */}
          <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : ''} gap-5 ${isAdmin ? 'max-w-xl' : 'max-w-xs'} mx-auto`}>

            {/* Ticket System */}
            <Link href="/tickets"
              className="home-card home-card-green group flex flex-col items-center gap-5 p-9 home-card-in"
              style={{ animationDelay: '0.5s' }}
            >
              {/* Icon container with glow */}
              <div className="relative">
                <div className="home-icon-glow" style={{ background: 'rgba(8,61,32,0.2)' }} />
                <div className="home-icon relative w-14 h-14 rounded-xl bg-gradient-to-br from-[#E8F2EC] to-[#d4e8db] flex items-center justify-center group-hover:from-[#083D20] group-hover:to-[#0a5c30] transition-all duration-500">
                  <svg className="w-7 h-7 text-[#083D20] group-hover:text-white transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#083D20] transition-colors duration-300">
                  Ticket System
                </h2>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Crear y gestionar solicitudes bancarias
                </p>
              </div>
              {/* Arrow indicator */}
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 group-hover:text-[#083D20] transition-all duration-300 group-hover:gap-2.5">
                Entrar
                <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>

            {/* Command Center — admin only */}
            {isAdmin && (
              <a
                href="https://banks-command-center.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="home-card home-card-navy group flex flex-col items-center gap-5 p-9 home-card-in"
                style={{ animationDelay: '0.65s' }}
              >
                {/* Icon container with glow */}
                <div className="relative">
                  <div className="home-icon-glow" style={{ background: 'rgba(31,54,87,0.2)' }} />
                  <div className="home-icon relative w-14 h-14 rounded-xl bg-gradient-to-br from-[#EEF3FA] to-[#dbe4f0] flex items-center justify-center group-hover:from-[#1F3657] group-hover:to-[#2a4a73] transition-all duration-500">
                    <svg className="w-7 h-7 text-[#1F3657] group-hover:text-white transition-colors duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#1F3657] transition-colors duration-300">
                    Command Center
                  </h2>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                    Panel de control y operaciones
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 group-hover:text-[#1F3657] transition-all duration-300 group-hover:gap-2.5">
                  Abrir
                  <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              </a>
            )}
          </div>

          {/* Footer logos */}
          <div className="home-footer-in mt-14 flex items-center justify-center gap-3"
            style={{ animationDelay: '0.9s' }}
          >
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
