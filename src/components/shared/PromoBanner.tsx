'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'promo-metrics-dashboard-dismissed'
// Only show until end of 2026-09-18
const EXPIRY_DATE = '2026-09-18'

export function PromoBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (today > EXPIRY_DATE) return
    if (localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header accent */}
          <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-[#083D20] to-[#0a4d28]" />

          <div className="px-6 pt-5 pb-6">
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F2EC]">
              <svg className="h-6 w-6 text-[#083D20]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>

            {/* Content */}
            <h3 className="text-center text-lg font-semibold text-gray-900">
              Nuevo Dashboard de Metricas
            </h3>
            <p className="mt-2 text-center text-sm text-gray-600 leading-relaxed">
              Hemos lanzado un nuevo panel de metricas en el Command Center.
              Consulta el rendimiento del equipo, tiempos de resolucion y
              tendencias en un solo lugar.
            </p>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2">
              <a
                href="https://banks-command-center.vercel.app/dashboard/metricas"
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismiss}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#083D20] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a4d28] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#083D20] focus-visible:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Ver Dashboard de Metricas
              </a>
              <button
                onClick={dismiss}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Ahora no, gracias
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
