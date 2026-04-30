import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Navbar } from '@/components/layout/Navbar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { CommentThread } from '@/components/tickets/CommentThread'
import { AddCommentForm } from '@/components/tickets/AddCommentForm'
import { SnoozeButton } from '@/components/tickets/SnoozeButton'
import { AdminTicketActions } from '@/components/admin/AdminTicketActions'
import { formatDate, displayName, isSlaBreaching } from '@/lib/utils'
import type { TicketWithRelations, TicketCommentWithAuthor, AuditLogWithActor, Profile } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Admin — Detalle de Solicitud' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminTicketDetailPage({ params }: Props) {
  const { id }   = await params
  const profile  = await requireProfile()
  const supabase = await createClient()

  const [ticketRes, commentsRes, auditRes, adminsRes, feedbackRes] = await Promise.all([
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

    createAdminClient()
      .from('ticket_feedback')
      .select('satisfied, comment, created_at')
      .eq('ticket_id', id)
      .maybeSingle(),
  ])

  if (!ticketRes.data) notFound()

  const t        = ticketRes.data as TicketWithRelations
  const audit    = (auditRes.data ?? []) as AuditLogWithActor[]
  const admins   = (adminsRes.data ?? []) as Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>[]
  const feedback = feedbackRes.data as { satisfied: boolean; comment: string | null; created_at: string } | null

  // Fetch attachments + batch-sign all URLs in one storage call
  const adminClient = createAdminClient()
  const commentIds = (commentsRes.data ?? []).map((c: { id: string }) => c.id)
  const rawAttachments = commentIds.length > 0
    ? (await adminClient.from('comment_attachments').select('*').in('comment_id', commentIds)).data ?? []
    : []

  const allPaths = rawAttachments.map(a => a.file_path)
  const { data: signedEntries } = allPaths.length > 0
    ? await adminClient.storage.from('comment-attachments').createSignedUrls(allPaths, 3600)
    : { data: [] }

  const signedMap = Object.fromEntries(
    (signedEntries ?? []).map(e => [e.path, e.signedUrl ?? '']),
  )

  const attachmentsByComment: Record<string, (typeof rawAttachments[number] & { signedUrl: string })[]> = {}
  for (const att of rawAttachments) {
    if (!attachmentsByComment[att.comment_id]) attachmentsByComment[att.comment_id] = []
    attachmentsByComment[att.comment_id]!.push({ ...att, signedUrl: signedMap[att.file_path] ?? '' })
  }

  const comments: TicketCommentWithAuthor[] = (commentsRes.data ?? []).map(
    (comment: Record<string, unknown>) => ({
      ...comment,
      attachments: attachmentsByComment[comment.id as string] ?? [],
    }),
  ) as TicketCommentWithAuthor[]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin />
      <main className="page-container">
        <div className="flex gap-6 items-start">

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb + title */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <a href="/admin/tickets" className="hover:text-gray-700">Todas las Solicitudes</a>
                <span>/</span>
                <span className="font-mono text-gray-700">{t.display_id}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">{t.subject}</h1>
                <div className="shrink-0 mt-1">
                  <SnoozeButton ticketId={id} currentStatus={t.status} />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <span className="text-sm text-gray-500">{t.categories.name}</span>
                {isSlaBreaching(t.sla_deadline) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    SLA Vencido
                  </span>
                )}
              </div>
            </div>

            {/* Ticket details */}
            <div className="card p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <p className="text-gray-500 mb-0.5">Solicitante</p>
                  <p className="font-medium">{displayName(t.profiles)}</p>
                  <p className="text-gray-400 text-xs">{t.profiles?.email ?? 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Creado</p>
                  <p className="font-medium">{formatDate(t.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-0.5">Última actualización</p>
                  <p className="font-medium">{formatDate(t.updated_at)}</p>
                </div>
                {(t as typeof t & { client_name?: string | null }).client_name && (
                  <div>
                    <p className="text-gray-500 mb-0.5">Cliente</p>
                    <p className="font-medium">{(t as typeof t & { client_name?: string | null }).client_name}</p>
                  </div>
                )}
                {(t as typeof t & { bank_name?: string | null }).bank_name && (
                  <div>
                    <p className="text-gray-500 mb-0.5">Banco</p>
                    <p className="font-medium">{(t as typeof t & { bank_name?: string | null }).bank_name}</p>
                  </div>
                )}
                {(t as typeof t & { bank_email?: string | null }).bank_email && (
                  <div>
                    <p className="text-gray-500 mb-0.5">Email bancario</p>
                    <p className="font-medium">{(t as typeof t & { bank_email?: string | null }).bank_email}</p>
                  </div>
                )}
                {(t as typeof t & { pipedrive_deal_id?: number | null }).pipedrive_deal_id && (
                  <div>
                    <p className="text-gray-500 mb-0.5">Deal Pipedrive</p>
                    <a
                      href={`https://app.pipedrive.com/deal/${(t as typeof t & { pipedrive_deal_id?: number | null }).pipedrive_deal_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#083D20] hover:underline"
                    >
                      #{(t as typeof t & { pipedrive_deal_id?: number | null }).pipedrive_deal_id} →
                    </a>
                  </div>
                )}
                {t.sla_deadline && (
                  <div>
                    <p className="text-gray-500 mb-0.5">Fecha límite SLA</p>
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
              <h2 className="font-semibold text-gray-900 mb-4">Comentarios</h2>
              <CommentThread comments={comments} currentProfileId={profile.id} isAdmin />
              <div className="mt-4 pt-4 border-t border-gray-100">
                <AddCommentForm
                ticketId={id}
                isAdmin
                pipedriveDealId={(t as typeof t & { pipedrive_deal_id?: number | null }).pipedrive_deal_id ?? undefined}
              />
              </div>
            </div>

            {/* Satisfaction feedback */}
            {feedback && (
              <div className="card p-6 mb-6">
                <h2 className="font-semibold text-gray-900 mb-3">Satisfaction Feedback</h2>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl`}>{feedback.satisfied ? '👍' : '👎'}</span>
                  <div>
                    <p className="font-medium text-sm">{feedback.satisfied ? 'Satisfecho' : 'No satisfecho'}</p>
                    <p className="text-xs text-gray-400">{formatDate(feedback.created_at)}</p>
                  </div>
                </div>
                {feedback.comment && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-3 italic">
                    &ldquo;{feedback.comment}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Audit log */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Registro de Auditoría</h2>
              {audit.length === 0 ? (
                <p className="text-sm text-gray-400">Sin eventos todavía.</p>
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
