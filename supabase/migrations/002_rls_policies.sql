-- ============================================================
-- People Hub — Row Level Security Policies
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- Enable RLS on every table
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;

-- ─── profiles ─────────────────────────────────────────────────
-- Multiple SELECT policies are OR'd automatically by Postgres.

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (is_admin());

-- Users may update only their own row.
-- Role escalation is blocked in the API layer; the DB doesn't
-- need column-level security for MVP.
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── categories ───────────────────────────────────────────────

CREATE POLICY "categories_select_authenticated"
  ON categories FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "categories_all_admin"
  ON categories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── routing_rules ────────────────────────────────────────────

CREATE POLICY "routing_rules_select_authenticated"
  ON routing_rules FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "routing_rules_all_admin"
  ON routing_rules FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── tickets ──────────────────────────────────────────────────

CREATE POLICY "tickets_select_own"
  ON tickets FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "tickets_select_admin"
  ON tickets FOR SELECT
  USING (is_admin());

-- Any authenticated user may open a ticket; created_by must be self.
CREATE POLICY "tickets_insert_authenticated"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only admins may update tickets (status, priority, assignee, etc.)
CREATE POLICY "tickets_update_admin"
  ON tickets FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── ticket_comments ──────────────────────────────────────────

-- Employees may read public comments on their own tickets.
CREATE POLICY "comments_select_own_public"
  ON ticket_comments FOR SELECT
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
        AND tickets.created_by = auth.uid()
    )
  );

-- Admins may read all comments (public + internal).
CREATE POLICY "comments_select_admin"
  ON ticket_comments FOR SELECT
  USING (is_admin());

-- Employees may add public comments to their own tickets.
CREATE POLICY "comments_insert_employee"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
        AND tickets.created_by = auth.uid()
    )
  );

-- Admins may add comments (any visibility) to any ticket.
CREATE POLICY "comments_insert_admin"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() AND author_id = auth.uid());

-- ─── audit_log ────────────────────────────────────────────────
-- No INSERT policy — only the service-role client (server-side)
-- may write to this table.

CREATE POLICY "audit_select_own"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = audit_log.ticket_id
        AND tickets.created_by = auth.uid()
    )
  );

CREATE POLICY "audit_select_admin"
  ON audit_log FOR SELECT
  USING (is_admin());

-- ─── ticket_status_history ────────────────────────────────────
-- No INSERT policy — service-role only.

CREATE POLICY "status_hist_select_own"
  ON ticket_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_status_history.ticket_id
        AND tickets.created_by = auth.uid()
    )
  );

CREATE POLICY "status_hist_select_admin"
  ON ticket_status_history FOR SELECT
  USING (is_admin());
