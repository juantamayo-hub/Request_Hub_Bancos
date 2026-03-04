'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Profile, SupportTypeOwner, SupportType } from '@/lib/database.types'

// ─── Constants ────────────────────────────────────────────────

const SUPPORT_TYPES: { key: SupportType; label: string }[] = [
  { key: 'documents',        label: 'Documents' },
  { key: 'visa',             label: 'Visa' },
  { key: 'health_insurance', label: 'Health Insurance' },
  { key: 'parking',          label: 'Parking' },
  { key: 'time_off',         label: 'Time Off' },
  { key: 'revolut',          label: 'Revolut Adjustments' },
  { key: 'other',            label: 'Other' },
]

const FALLBACK_EMAIL = 'maryam.mesforoush@huspy.io'

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
            Mark {user.first_name ?? user.email} as unavailable
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            This user has <strong>{openTickets.length}</strong> open ticket{openTickets.length !== 1 ? 's' : ''} assigned to them.
            New tickets for their categories will be routed to other active owners (or the fallback).
          </p>
        </div>

        {openTickets.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">What should happen to their open tickets?</p>

            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
              <input
                type="radio"
                name="reassign"
                value="keep"
                checked={reassignTo === 'keep'}
                onChange={() => setReassignTo('keep')}
                className="mt-0.5 accent-gray-900 shrink-0"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Keep assigned to them</span>
                <p className="text-xs text-gray-500 mt-0.5">They&apos;ll handle the tickets when they return.</p>
              </div>
            </label>

            {otherAdmins.map(admin => (
              <label key={admin.id} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
                <input
                  type="radio"
                  name="reassign"
                  value={admin.id}
                  checked={reassignTo === admin.id}
                  onChange={() => setReassignTo(admin.id)}
                  className="mt-0.5 accent-gray-900 shrink-0"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Reassign to {displayName(admin)}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{admin.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            onClick={() => onConfirm(reassignTo === 'keep' ? null : reassignTo)}
            className="flex-1"
          >
            Confirm
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────

interface UsersTabProps {
  profiles: Profile[]
  currentUserId: string
}

function UsersTab({ profiles, currentUserId }: UsersTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [disableTarget, setDisableTarget] = useState<Profile | null>(null)
  const [disableTickets, setDisableTickets] = useState<OpenTicket[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const admins = profiles.filter(p => p.role === 'admin')

  // ── Toggle availability ─────────────────────────────────────
  async function handleToggleAvailability(user: Profile) {
    // When disabling, show modal to handle open tickets
    if (user.is_available) {
      setLoadingId(user.id)
      try {
        const res = await fetch(`/api/admin/users/${user.id}`)
        const data = await res.json() as { openTickets: OpenTicket[] }
        setDisableTickets(data.openTickets ?? [])
        setDisableTarget(user)
      } catch {
        toast.error('Failed to load user tickets')
      } finally {
        setLoadingId(null)
      }
      return
    }

    // Re-enabling: no modal needed
    await patchUser(user.id, { action: 'toggle_availability' })
  }

  async function confirmDisable(reassignToId: string | null) {
    if (!disableTarget) return

    setLoadingId(disableTarget.id)
    setDisableTarget(null)

    try {
      // If reassigning, do that first
      if (reassignToId && disableTickets.length > 0) {
        const res = await fetch(`/api/admin/users/${disableTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reassign_tickets', reassign_to_id: reassignToId }),
        })
        const data = await res.json() as { reassigned: number }
        if (res.ok) toast.success(`${data.reassigned} ticket${data.reassigned !== 1 ? 's' : ''} reassigned`)
      }

      // Then toggle availability
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
        toast.error(data.error ?? 'Failed to update user')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      toast.error('Network error')
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
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles.map(user => {
              const isLoading = loadingId === user.id || isPending
              const isSelf = user.id === currentUserId

              return (
                <tr key={user.id} className="hover:bg-gray-50/50">
                  {/* User */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                        {user.avatar_url
                          ? <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : initials(user)
                        }
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{displayName(user)}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Employee'}
                    </span>
                  </td>

                  {/* Availability */}
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      user.is_available ? 'text-green-700' : 'text-amber-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_available ? 'bg-green-500' : 'bg-amber-500'}`} />
                      {user.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* Availability toggle */}
                      <button
                        onClick={() => handleToggleAvailability(user)}
                        disabled={isLoading}
                        className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40"
                      >
                        {user.is_available ? 'Mark Unavailable' : 'Mark Available'}
                      </button>

                      {/* Promote / Demote (not self) */}
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
                              : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                          }`}
                        >
                          {user.role === 'admin' ? 'Demote' : 'Make Admin'}
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

// ─── Ownership tab ────────────────────────────────────────────

interface OwnershipTabProps {
  owners:   SupportTypeOwner[]
  admins:   Profile[]
}

function OwnershipTab({ owners, admins }: OwnershipTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState<SupportType | null>(null)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const ownersByType = Object.fromEntries(
    SUPPORT_TYPES.map(({ key }) => [
      key,
      owners.filter(o => o.support_type === key).sort((a, b) => a.sort_order - b.sort_order),
    ]),
  ) as Record<SupportType, SupportTypeOwner[]>

  // Admin users available to assign as owners
  const adminUsers = admins.filter(a => a.role === 'admin')

  async function addOwner(supportType: SupportType) {
    if (!selectedEmail) { toast.error('Please select a user'); return }
    setLoadingKey(`add-${supportType}`)
    try {
      const res = await fetch('/api/admin/ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support_type: supportType, owner_email: selectedEmail }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to add owner'); return }
      toast.success('Owner added')
      setAdding(null)
      setSelectedEmail('')
      startTransition(() => router.refresh())
    } catch {
      toast.error('Network error')
    } finally {
      setLoadingKey(null)
    }
  }

  async function removeOwner(supportType: SupportType, ownerEmail: string) {
    setLoadingKey(`remove-${supportType}-${ownerEmail}`)
    try {
      const res = await fetch('/api/admin/ownership', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support_type: supportType, owner_email: ownerEmail }),
      })
      if (!res.ok) { toast.error('Failed to remove owner'); return }
      toast.success('Owner removed')
      startTransition(() => router.refresh())
    } catch {
      toast.error('Network error')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Tickets are assigned using <strong>round-robin</strong> among active owners for each category.
        If no active owner is available, tickets fall back to{' '}
        <span className="font-medium text-gray-900">{FALLBACK_EMAIL}</span>.
        Only admin users can be assigned as owners.
      </p>

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {SUPPORT_TYPES.map(({ key, label }) => {
          const typeOwners = ownersByType[key] ?? []
          const isAdding   = adding === key

          // Filter admins not already owning this type
          const availableToAdd = adminUsers.filter(
            a => !typeOwners.some(o => o.owner_email === a.email),
          )

          return (
            <div key={key} className="p-4 bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>

                  {typeOwners.length === 0 ? (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <span>⚠</span> No owners — fallback applies ({FALLBACK_EMAIL})
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {typeOwners.map((owner, idx) => {
                        const profile = admins.find(a => a.email === owner.owner_email)
                        const isRemoving = loadingKey === `remove-${key}-${owner.owner_email}`

                        return (
                          <span
                            key={owner.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                              profile?.is_available === false
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                          >
                            <span className="text-gray-400 font-mono text-[10px]">#{idx + 1}</span>
                            {profile ? displayName(profile) : owner.owner_email}
                            {profile?.is_available === false && (
                              <span className="text-amber-500 text-[10px] font-medium">(unavailable)</span>
                            )}
                            <button
                              onClick={() => removeOwner(key, owner.owner_email)}
                              disabled={isRemoving || isPending}
                              className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                              title="Remove owner"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {isAdding && (
                    <div className="mt-3 flex items-center gap-2">
                      <select
                        value={selectedEmail}
                        onChange={e => setSelectedEmail(e.target.value)}
                        className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        <option value="">Select an admin user…</option>
                        {availableToAdd.map(a => (
                          <option key={a.id} value={a.email}>
                            {displayName(a)} ({a.email})
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={() => addOwner(key)}
                        disabled={loadingKey === `add-${key}` || isPending}
                        className="shrink-0"
                      >
                        Add
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => { setAdding(null); setSelectedEmail('') }}
                        className="shrink-0"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {!isAdding && (
                  <button
                    onClick={() => { setAdding(key); setSelectedEmail('') }}
                    disabled={availableToAdd.length === 0 || isPending}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40"
                    title={availableToAdd.length === 0 ? 'All admins already assigned' : undefined}
                  >
                    + Add owner
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  profiles:      Profile[]
  owners:        SupportTypeOwner[]
  currentUserId: string
}

export function UserManagementClient({ profiles, owners, currentUserId }: Props) {
  const [tab, setTab] = useState<'users' | 'ownership'>('users')

  const admins = profiles.filter(p => p.role === 'admin')
  const employees = profiles.filter(p => p.role === 'employee')

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['users', 'ownership'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'users' ? `Users (${profiles.length})` : 'Category Ownership'}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-6">
          {/* Admins */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Administrators ({admins.length})
            </h3>
            <div className="card overflow-hidden">
              <UsersTab profiles={admins} currentUserId={currentUserId} />
            </div>
          </section>

          {/* Employees */}
          {employees.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Employees ({employees.length})
              </h3>
              <div className="card overflow-hidden">
                <UsersTab profiles={employees} currentUserId={currentUserId} />
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'ownership' && (
        <OwnershipTab owners={owners} admins={profiles} />
      )}
    </div>
  )
}
