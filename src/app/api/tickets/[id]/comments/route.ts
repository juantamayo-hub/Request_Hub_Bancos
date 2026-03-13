import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
])
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB

/**
 * POST /api/tickets/[id]/comments
 * - Accepts multipart/form-data: body (string), visibility (string), files[] (File, admin only)
 * - Employees: public comments on their own tickets (enforced by RLS).
 * - Admins: any visibility on any ticket; can also attach files.
 * Audit log written via service-role client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Parse multipart or JSON
  let commentBody: string
  let visibility: 'public' | 'internal' = 'public'
  let files: File[] = []

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    commentBody  = (formData.get('body') as string | null) ?? ''
    visibility   = ((formData.get('visibility') as string | null) ?? 'public') as 'public' | 'internal'
    files        = formData.getAll('files') as File[]
  } else {
    let json: { body?: string; visibility?: string }
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    commentBody = json.body ?? ''
    visibility  = (json.visibility ?? 'public') as 'public' | 'internal'
  }

  if (!commentBody?.trim()) {
    return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
  }

  // Non-admins can only post public comments; files are admin-only
  const effectiveVisibility = profile.role === 'admin' ? visibility : 'public'
  if (profile.role !== 'admin') files = []

  // Insert comment via regular client — RLS enforces ownership for employees
  const { data: comment, error: insertErr } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id:  id,
      author_id:  profile.id,
      body:       commentBody.trim(),
      visibility: effectiveVisibility,
    })
    .select(`*, profiles(id, email, first_name, last_name, avatar_url)`)
    .single()

  if (insertErr || !comment) {
    console.error('Comment insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }

  const admin = createAdminClient()

  // Audit log
  await admin.from('audit_log').insert({
    ticket_id:  id,
    actor_id:   profile.id,
    action:     'comment_added',
    from_value: null,
    to_value:   effectiveVisibility,
    metadata:   { preview: commentBody.substring(0, 100) },
  })

  // Upload attachments (admin only)
  const attachments = []
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) continue
    if (file.size > MAX_FILE_SIZE) continue

    const ext      = file.name.split('.').pop() ?? 'bin'
    const filePath = `${id}/${comment.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadErr } = await admin.storage
      .from('comment-attachments')
      .upload(filePath, await file.arrayBuffer(), { contentType: file.type })

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      continue
    }

    const { data: attachmentRecord, error: attachErr } = await admin
      .from('comment_attachments')
      .insert({
        comment_id:  comment.id,
        ticket_id:   id,
        file_name:   file.name,
        file_path:   filePath,
        file_size:   file.size,
        mime_type:   file.type,
        uploaded_by: profile.id,
      })
      .select('*')
      .single()

    if (!attachErr && attachmentRecord) {
      attachments.push(attachmentRecord)
    }
  }

  return NextResponse.json({ comment: { ...comment, attachments } }, { status: 201 })
}
