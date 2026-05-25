-- Migration 014: in-app notifications

CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id  UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id UUID        REFERENCES ticket_comments(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'new_comment',
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id     ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_ticket_id   ON notifications(ticket_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users only see and manage their own notifications
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;
