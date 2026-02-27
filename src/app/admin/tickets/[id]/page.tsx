import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { CommentThread } from '@/components/tickets/CommentThread'
import { AddCommentForm } from '@/components/tickets/AddCommentForm'
import { AdminTicketActions } from '@/components/admin/AdminTicketActions'
import { formatDate, displayName, isSlaBreaching } from '@/lib/utils'
import type { TicketWithRelations, TicketCommentWithAuthor, AuditLogWithActor, Profile } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Admin — Ticket Detail' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminTicketDetailPage({ params }: Props) {
  const { id }   = await params
  const profile  = await requireProfile()
  const supabase = await createClient()

  const [ticketRes, commentsRes, auditRes, adminsRes] = await Promise.all([
    supabase
      .from('tickets')
      .select(`
        *,
        categories(id, name),
        profiles!tickets_created_by_fkey(id, email, first_name, last_name, avatar_url),
        assignee:profiles!tickets_assignee_id_fkey(id, email, first_name, last_name, avatar_url)
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('ticket_comments')
      .select(`*, profiles(id, email, first_name, last_name, avatar_url)`)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),

    supabase
      .from('audit_log')
      .select(`*, profiles(id, email, first_name, last_name)`)
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('role', 'admin'),
  ])

  if (!ticketRes.data) notFound()

  const t       = ticketRes.data as TicketWithRelations
  const comments = (commentsRes.data ?? []) as TicketCommentWithAuthor[]
  const audit    = (auditRes.data ?? []) as AuditLogWithActor[]
  const admins   = (adminsRes.data ?? []) as Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>[]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="flex gap-6 items-start">

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb + title */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <a href="/admin/tickets" className="hover:text-gray-700">All Tickets</a>
                <span>/</span>
                <span className="font-mono text-gray-700">{t.display_id}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{t.subject}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <span className="text-sm text-gray-500">{t.categories.name}</span>
                {isSlaBreaching(t.sla_deadline) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    SLA Breached
                  </span>
                )}
              </div>
            </div>

            {/* Ticket details */}
            <div className="card p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <p className="text-gray-500 mb-0.5">Requester</p>
                  <p className="font-medium">{displayName(t.profiles)}</p>
                  <p className="text-gray-400 text-xs">{t.profiles.email}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Opened</p>
                  <p className="font-medium">{formatDate(t.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Last updated</p>
                  <p className="font-medium">{formatDate(t.updated_at)}</p>
                </div>
                {t.sla_deadline && (
                  <div>
                    <p className="text-gray-500 mb-0.5">SLA deadline</p>
                    <p className={`font-medium ${isSlaBreaching(t.sla_deadline) ? 'text-red-600' : ''}`}>
                      {formatDate(t.sla_deadline)}
                    </p>
                  </div>
                )}
              </div>
              <hr className="border-gray-100 mb-4" />
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</div>
            </div>

            {/* Comments */}
            <div className="card p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Comments</h2>
              <CommentThread comments={comments} currentProfileId={profile.id} isAdmin />
              <div className="mt-4 pt-4 border-t border-gray-100">
                <AddCommentForm ticketId={id} isAdmin />
              </div>
            </div>

            {/* Audit log */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Audit Log</h2>
              {audit.length === 0 ? (
                <p className="text-sm text-gray-400">No events yet.</p>
              ) : (
                <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                  {audit.map(entry => (
                    <li key={entry.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-gray-300 border-2 border-white" />
                      <time className="text-xs text-gray-400">{formatDate(entry.created_at)}</time>
                      <p className="text-sm mt-0.5">
                        <span className="font-medium">{displayName(entry.profiles)}</span>
                        {' — '}
                        <span className="text-gray-600 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                        {entry.from_value && entry.to_value && (
                          <span className="text-gray-500"> ({entry.from_value} → {entry.to_value})</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* ── Sidebar: admin actions ── */}
          <div className="w-64 shrink-0">
            <AdminTicketActions
              ticket={t}
              admins={admins}
            />
          </div>

        </div>
      </main>
    </div>
  )
}
