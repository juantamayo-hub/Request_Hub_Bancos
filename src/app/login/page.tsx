'use client'

import { Suspense } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const params    = useSearchParams()
  const errorCode = params.get('error')

  const handleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #083D20 0%, #0b4f29 45%, #1F3657 100%)' }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
        <div
          className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
        <div
          className="absolute top-1/2 right-8 w-48 h-48 rounded-full"
          style={{ background: 'rgba(255,255,255,0.03)', transform: 'translateY(-50%)' }}
        />

        {/* Top: logos */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-tight">Bayteca</span>
          <span className="text-white/30 font-light text-xl">·</span>
          <span className="text-white/70 font-semibold text-xs tracking-[0.2em] uppercase">Mortgage Direct</span>
        </div>

        {/* Center: headline */}
        <div className="relative z-10">
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest mb-4">
            Plataforma bancaria
          </p>
          <h1 className="text-white text-5xl font-bold tracking-tight leading-tight mb-6">
            Request<br />Hub · Bancos
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-xs">
            Gestión centralizada de solicitudes entre el equipo de hipotecas y los bancos.
          </p>

          <div className="mt-10 space-y-3">
            {[
              'Seguimiento en tiempo real de solicitudes',
              'Comunicación directa con bancos',
              'Historial y auditoría completos',
            ].map(item => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.4)' }} />
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: legal */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Bayteca · Mortgage Direct. Uso interno.
          </p>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center bg-white px-8 py-12">

        {/* Mobile-only brand header */}
        <div className="lg:hidden flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-1">
            <Image src="/logo-bayteca.svg" alt="Bayteca" width={88} height={22} className="h-5 w-auto" quality={100} priority />
            <span className="text-gray-300 text-xl font-light">·</span>
            <Image src="/logo-md-black.svg" alt="Mortgage Direct" width={152} height={22} className="h-4 w-auto" quality={100} priority />
          </div>
          <p className="text-xs text-gray-400 tracking-wide mt-1">Request Hub · Bancos</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Heading */}
          <div className="mb-8">
            <div className="hidden lg:flex items-center gap-3 mb-6">
              <Image src="/logo-bayteca.svg" alt="Bayteca" width={88} height={22} className="h-5 w-auto" quality={100} priority />
              <span className="text-gray-200 text-xl font-light">·</span>
              <Image src="/logo-md-black.svg" alt="Mortgage Direct" width={152} height={22} className="h-4 w-auto" quality={100} priority />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Bienvenido</h2>
            <p className="text-sm text-gray-500">
              Inicia sesión para continuar a Request Hub
            </p>
          </div>

          {/* Error banners */}
          {errorCode === 'domain' && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              Solo cuentas <strong>@huspy.io</strong> o <strong>@bayteca.com</strong> pueden acceder.
            </div>
          )}
          {errorCode === 'auth' && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              Error de autenticación. Por favor, inténtalo de nuevo.
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <GoogleIcon />
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-center text-xs text-gray-400">
              Acceso restringido a cuentas{' '}
              <span className="font-medium text-gray-500">@huspy.io</span>
              {' '}y{' '}
              <span className="font-medium text-gray-500">@bayteca.com</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
