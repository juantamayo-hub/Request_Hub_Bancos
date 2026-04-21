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
import { formatDate, displayName, isSlaBreaching } from '@/lib/utils'
import type { TicketWithRelations, TicketCommentWithAuthor } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Ticket Detail' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: Props) {
  const { id }   = await params
  const profile  = await requireProfile()
  const supabase = await createClient()

  // RLS ensures users only see their own tickets; admins see all.
  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      categories(id, name),
      profiles!tickets_created_by_fkey(id, email, first_name, last_name, avatar_url),
      assignee:profiles!tickets_assignee_id_fkey(id, email, first_name, last_name, avatar_url)
    `)
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  // RLS also filters internal comments for non-admins.
  const { data: rawComments } = await supabase
    .from('ticket_comments')
    .select(`*, profiles(id, email, first_name, last_name, avatar_url)`)
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  // Fetch attachments and generate signed URLs (service-role bypasses RLS)
  const adminClient = createAdminClient()
  const commentIds = (rawComments ?? []).map(c => c.id)
  const rawAttachments = commentIds.length > 0
    ? (await adminClient.from('comment_attachments').select('*').in('comment_id', commentIds)).data ?? []
    : []

  const attachmentsByComment: Record<string, typeof rawAttachments> = {}
  for (const att of rawAttachments) {
    if (!attachmentsByComment[att.comment_id]) attachmentsByComment[att.comment_id] = []
    attachmentsByComment[att.comment_id]!.push(att)
  }

  // Generate signed URLs for all attachments
  const comments: TicketCommentWithAuthor[] = await Promise.all(
    (rawComments ?? []).map(async comment => {
      const atts = attachmentsByComment[comment.id] ?? []
      const withUrls = await Promise.all(atts.map(async att => {
        const { data } = await adminClient.storage
          .from('comment-attachments')
          .createSignedUrl(att.file_path, 3600)  // 1 hour
        return { ...att, signedUrl: data?.signedUrl ?? '' }
      }))
      return { ...comment, attachments: withUrls } as TicketCommentWithAuthor
    })
  )

  const t = ticket as TicketWithRelations

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <Navbar profile={profile} isAdmin={profile.role === 'admin'} />
      <main className="page-container">
        <div className="max-w-3xl">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <a href="/tickets" className="hover:text-gray-700">Mis Solicitudes</a>
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
                  SLA Vencido
                </span>
              )}
            </div>
          </div>

          {/* Details card */}
          <div className="card p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm mb-5">
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
              {t.assignee && (
                <div>
                  <p className="text-gray-500 mb-0.5">Asignado a</p>
                  <p className="font-medium">{displayName(t.assignee)}</p>
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

            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {t.description}
            </div>
          </div>

          {/* Comments */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Actividad</h2>
            <CommentThread
              comments={comments}
              currentProfileId={profile.id}
            />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <AddCommentForm ticketId={id} isAdmin={profile.role === 'admin'} />
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
