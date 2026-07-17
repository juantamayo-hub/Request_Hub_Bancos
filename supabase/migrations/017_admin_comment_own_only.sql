-- Migration 017: Restrict admin comment edit/delete to their own comments only

DROP POLICY IF EXISTS "comments_update_admin" ON ticket_comments;
DROP POLICY IF EXISTS "comments_delete_admin" ON ticket_comments;

CREATE POLICY "comments_update_admin" ON ticket_comments
  FOR UPDATE
  TO authenticated
  USING (is_admin() AND author_id = auth.uid())
  WITH CHECK (is_admin() AND author_id = auth.uid());

CREATE POLICY "comments_delete_admin" ON ticket_comments
  FOR DELETE
  TO authenticated
  USING (is_admin() AND author_id = auth.uid());
