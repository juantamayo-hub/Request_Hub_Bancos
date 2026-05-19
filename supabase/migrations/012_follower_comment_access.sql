-- Migration 012: Allow ticket followers to read and write public comments
-- Run after 011_snooze_and_followers.sql

-- ── ticket_comments — extend to include followers ──────────────

DROP POLICY IF EXISTS "comments_select_own_public" ON ticket_comments;
DROP POLICY IF EXISTS "comments_insert_employee"   ON ticket_comments;

-- Employees can read public comments on tickets they created OR follow
CREATE POLICY "comments_select_own_public" ON ticket_comments FOR SELECT
  USING (
    visibility = 'public'
    AND (
      EXISTS (
        SELECT 1 FROM tickets
        WHERE tickets.id = ticket_comments.ticket_id
          AND tickets.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM ticket_followers
        WHERE ticket_id = ticket_comments.ticket_id
          AND user_id = auth.uid()
      )
    )
  );

-- Employees can add public comments to tickets they created OR follow
CREATE POLICY "comments_insert_employee" ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND visibility = 'public'
    AND (
      EXISTS (
        SELECT 1 FROM tickets
        WHERE tickets.id = ticket_comments.ticket_id
          AND tickets.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM ticket_followers
        WHERE ticket_id = ticket_comments.ticket_id
          AND user_id = auth.uid()
      )
    )
  );
