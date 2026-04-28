-- Migration 011: Snooze columns + ticket_followers table
-- Run after 010_client_name.sql

-- ── Snooze columns on tickets ─────────────────────────────────
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS snoozed_until          TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS snooze_previous_status TEXT;

-- ── Ticket followers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_followers (
  ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticket_id, user_id)
);

ALTER TABLE ticket_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followers_self"  ON ticket_followers FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "followers_admin" ON ticket_followers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Grant access for authenticated users
GRANT SELECT, INSERT, DELETE ON ticket_followers TO authenticated;

-- ── Update tickets RLS to include followed tickets ────────────
-- Employees can see their own tickets OR tickets they follow

DROP POLICY IF EXISTS "employees_view_own" ON tickets;

CREATE POLICY "employees_view_own" ON tickets FOR SELECT USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1 FROM ticket_followers
    WHERE ticket_id = tickets.id AND user_id = auth.uid()
  )
);
