-- Migration 018: Fix missing table-level grants on ticket_followers
-- ticket_followers was created in migration 011, after migration 006 ran
-- its blanket GRANT ON ALL TABLES. New tables created after 006 need
-- explicit grants to be accessible by the authenticated role.

GRANT SELECT, INSERT, DELETE ON ticket_followers TO authenticated;
GRANT ALL ON ticket_followers TO service_role;
