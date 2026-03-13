-- ============================================================
-- Migration 003: Comment attachments + Ticket feedback
-- ============================================================

-- ─── comment_attachments ─────────────────────────────────────

CREATE TABLE comment_attachments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id  uuid NOT NULL REFERENCES ticket_comments(id) ON DELETE CASCADE,
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_path   text NOT NULL,      -- storage path: {ticketId}/{commentId}/{uuid}.{ext}
  file_size   bigint NOT NULL,    -- bytes
  mime_type   text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE comment_attachments ENABLE ROW LEVEL SECURITY;

-- Admins can insert/select/delete
CREATE POLICY "admins_manage_attachments" ON comment_attachments
  USING    (is_admin())
  WITH CHECK (is_admin());

-- Ticket owners can view attachments on their own tickets
CREATE POLICY "employee_view_own_ticket_attachments" ON comment_attachments
  FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM tickets WHERE created_by = auth.uid()
    )
  );

-- ─── Supabase Storage bucket ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-attachments',
  'comment-attachments',
  false,
  10485760,   -- 10 MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── ticket_feedback ─────────────────────────────────────────

CREATE TABLE ticket_feedback (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  satisfied       boolean NOT NULL,
  comment         text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(ticket_id)   -- one feedback per ticket
);

ALTER TABLE ticket_feedback ENABLE ROW LEVEL SECURITY;

-- Only admins can read feedback
CREATE POLICY "admins_view_feedback" ON ticket_feedback
  FOR SELECT
  USING (is_admin());

-- Insert is done via service-role client (no auth user policy needed)
