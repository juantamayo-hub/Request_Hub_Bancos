-- Migration 016: Allow admins to edit and delete any ticket comment

-- UPDATE policy: admins can edit comment body
CREATE POLICY "comments_update_admin" ON ticket_comments
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE policy: admins can delete any comment
CREATE POLICY "comments_delete_admin" ON ticket_comments
  FOR DELETE
  TO authenticated
  USING (is_admin());
