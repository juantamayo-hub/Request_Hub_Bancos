'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { Profile } from '@/lib/database.types'
import type { CategoryWithRule } from '@/app/admin/users/page'

// ─── Helper ───────────────────────────────────────────────────

function displayName(p: Pick<Profile, 'first_name' | 'last_name' | 'email'>) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
  return name || p.email
}

function initials(p: Pick<Profile, 'first_name' | 'last_name' | 'email'>) {
  if (p.first_name) return (p.first_name[0] + (p.last_name?.[0] ?? '')).toUpperCase()
  return p.email[0].toUpperCase()
}

// ─── Disable modal ────────────────────────────────────────────

interface OpenTicket {
  id:         string
  display_id: string
  subject:    string
  status:     string
}

interface DisableModalProps {
  user:        Profile
  openTickets: OpenTicket[]
  admins:      Profile[]
  onConfirm:   (reassignToId: string | null) => void
  onCancel:    () => void
}

function DisableModal({ user, openTickets, admins, onConfirm, onCancel }: DisableModalProps) {
  const [reassignTo, setReassignTo] = useState<string>('keep')

  const otherAdmins = admins.filter(a => a.id !== user.id && a.is_available)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Marcar a {user.first_name ?? user.email} como no disponible
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Este usuario tiene <strong>{openTickets.length}</strong> solicitud{openTickets.length !== 1 ? 'es' : ''} abiertas asignadas.
            Las nuevas solicitudes de sus categorías se enrutarán a otros responsables activos.
          </p>
        </div>

        {openTickets.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">¿Qué debe ocurrir con sus solicitudes abiertas?</p>

            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 has-[:checked]:border-[#083D20] has-[:checked]:bg-[#E8F2EC]/40">
              <input
                type="radio"
                name="reassign"
                value="keep"
                checked={reassignTo === 'keep'}
                onChange={() => setReassignTo('keep')}
                className="mt-0.5 shrink-0 accent-[#083D20]"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Mantener asignadas</span>
                <p className="text-xs text-gray-500 mt-0.5">Las gestionará cuando vuelva a estar disponible.</p>
              </div>
            </label>

            {otherAdmins.map(admin => (
              <label key={admin.id} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 has-[:checked]:border-[#083D20] has-[:checked]:bg-[#E8F2EC]/40">
                <input
                  type="radio"
                  name="reassign"
                  value={admin.id}
                  checked={reassignTo === admin.id}
                  onChange={() => setReassignTo(admin.id)}
                  className="mt-0.5 shrink-0 accent-[#083D20]"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Reasignar a {displayName(admin)}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{admin.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            onClick={() => onConfirm(reassignTo === 'keep' ? null : reassignTo)}
            className="flex-1 bg-[#083D20] hover:bg-[#0a4d28] text-white"
          >
            Confirmar
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────

interface UsersTabProps {
  profiles:      Profile[]
  currentUserId: string
}

function UsersTab({ profiles, currentUserId }: UsersTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [disableTarget, setDisableTarget] = useState<Profile | null>(null)
  const [disableTickets, setDisableTickets] = useState<OpenTicket[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const admins = profiles.filter(p => p.role === 'admin')

  async function handleToggleAvailability(user: Profile) {
    if (user.is_available) {
      setLoadingId(user.id)
      try {
        const res = await fetch(`/api/admin/users/${user.id}`)
        const data = await res.json() as { openTickets: OpenTicket[] }
        setDisableTickets(data.openTickets ?? [])
        setDisableTarget(user)
      } catch {
        toast.error('Error al cargar las solicitudes del usuario')
      } finally {
        setLoadingId(null)
      }
      return
    }
    await patchUser(user.id, { action: 'toggle_availability' })
  }

  async function confirmDisable(reassignToId: string | null) {
    if (!disableTarget) return

    setLoadingId(disableTarget.id)
    setDisableTarget(null)

    try {
      if (reassignToId && disableTickets.length > 0) {
        const res = await fetch(`/api/admin/users/${disableTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reassign_tickets', reassign_to_id: reassignToId }),
        })
        const data = await res.json() as { reassigned: number }
        if (res.ok) toast.success(`${data.reassigned} solicitud${data.reassigned !== 1 ? 'es' : ''} reasignada${data.reassigned !== 1 ? 's' : ''}`)
      }
      await patchUser(disableTarget.id, { action: 'toggle_availability' })
    } finally {
      setLoadingId(null)
    }
  }

  async function patchUser(id: string, body: object) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? 'Error al actualizar el usuario')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      toast.error('Error de red')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      {disableTarget && (
        <DisableModal
          user={disableTarget}
          openTickets={disableTickets}
          admins={admins}
          onConfirm={confirmDisable}
          onCancel={() => setDisableTarget(null)}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Usuario</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Rol</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles.map(user => {
              const isLoading = loadingId === user.id || isPending
              const isSelf = user.id === currentUserId

              return (
                <tr key={user.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E8F2EC] flex items-center justify-center text-xs font-medium text-[#083D20] shrink-0 overflow-hidden">
                        {user.avatar_url
                          ? <Image src={user.avatar_url} alt="" width={32} height={32} className="rounded-full object-cover" />
                          : initials(user)
                        }
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{displayName(user)}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-[#1F3657] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Usuario'}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      user.is_available ? 'text-green-700' : 'text-amber-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_available ? 'bg-green-500' : 'bg-amber-500'}`} />
                      {user.is_available ? 'Disponible' : 'No disponible'}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleAvailability(user)}
                        disabled={isLoading}
                        className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40"
                      >
                        {user.is_available ? 'Marcar no disponible' : 'Marcar disponible'}
                      </button>

                      {!isSelf && (
                        <button
                          onClick={() => patchUser(user.id, {
                            action: 'set_role',
                            role: user.role === 'admin' ? 'employee' : 'admin',
                          })}
                          disabled={isLoading}
                          className={`text-xs px-2.5 py-1 rounded-md border transition-colors disabled:opacity-40 ${
                            user.role === 'admin'
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-[#083D20] text-[#083D20] hover:bg-[#083D20] hover:text-white'
                          }`}
                        >
                          {user.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Ownership section ─────────────────────────────────────────

interface OwnershipSectionProps {
  categories: CategoryWithRule[]
  admins:     Profile[]
}

type RowState = { owner_email: string; backup_owner_email: string }

function OwnershipSection({ categories, admins }: OwnershipSectionProps) {
  const router = useRouter()

  // Per-row state keyed by category id
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const cat of categories) {
      const rule = Array.isArray(cat.routing_rules)
        ? cat.routing_rules[0] ?? null
        : cat.routing_rules
      init[cat.id] = {
        owner_email:        rule?.owner_email        ?? '',
        backup_owner_email: rule?.backup_owner_email ?? '',
      }
    }
    return init
  })

  const [savingId, setSavingId] = useState<string | null>(null)

  const adminOptions = [
    { value: '', label: 'Sin asignar' },
    ...admins.map(a => ({ value: a.email, label: `${displayName(a)} (${a.email})` })),
  ]

  function setRow(catId: string, patch: Partial<RowState>) {
    setRows(prev => ({ ...prev, [catId]: { ...prev[catId], ...patch } }))
  }

  function isDirty(cat: CategoryWithRule) {
    const rule = Array.isArray(cat.routing_rules)
      ? cat.routing_rules[0] ?? null
      : cat.routing_rules
    const saved: RowState = {
      owner_email:        rule?.owner_email        ?? '',
      backup_owner_email: rule?.backup_owner_email ?? '',
    }
    const current = rows[cat.id]
    return current.owner_email !== saved.owner_email ||
           current.backup_owner_email !== saved.backup_owner_email
  }

  async function handleSave(cat: CategoryWithRule) {
    const row = rows[cat.id]
    if (!row.owner_email) {
      toast.error('Selecciona un responsable principal')
      return
    }
    setSavingId(cat.id)
    try {
      const res = await fetch('/api/admin/ownership', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          category_id:        cat.id,
          owner_email:        row.owner_email,
          backup_owner_email: row.backup_owner_email || null,
        }),
        credentials: 'include',
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); return }
      toast.success(`Responsable de "${cat.name}" actualizado`)
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Responsables por Categoría
      </h3>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Responsable principal</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Responsable de respaldo</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map(cat => {
                const row     = rows[cat.id]
                const saving  = savingId === cat.id
                const dirty   = isDirty(cat)
                return (
                  <tr key={cat.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{cat.name}</td>
                    <td className="py-3 px-4 min-w-[240px]">
                      <Select
                        options={adminOptions}
                        value={row.owner_email}
                        onChange={e => setRow(cat.id, { owner_email: e.target.value })}
                      />
                    </td>
                    <td className="py-3 px-4 min-w-[240px]">
                      <Select
                        options={adminOptions}
                        value={row.backup_owner_email}
                        onChange={e => setRow(cat.id, { backup_owner_email: e.target.value })}
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        onClick={() => handleSave(cat)}
                        isLoading={saving}
                        disabled={!dirty || saving}
                        className="bg-[#083D20] hover:bg-[#0a4d28] text-white text-xs px-3 py-1.5 h-auto"
                      >
                        Guardar
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  profiles:      Profile[]
  currentUserId: string
  categories:    CategoryWithRule[]
}

export function UserManagementClient({ profiles, currentUserId, categories }: Props) {
  const admins    = profiles.filter(p => p.role === 'admin')
  const employees = profiles.filter(p => p.role === 'employee')

  return (
    <div className="space-y-6">
      {/* Admins */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Administradores ({admins.length})
        </h3>
        <div className="card overflow-hidden">
          <UsersTab profiles={admins} currentUserId={currentUserId} />
        </div>
      </section>

      {employees.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Usuarios ({employees.length})
          </h3>
          <div className="card overflow-hidden">
            <UsersTab profiles={employees} currentUserId={currentUserId} />
          </div>
        </section>
      )}

      {/* Ownership */}
      <OwnershipSection categories={categories} admins={admins} />
    </div>
  )
}
