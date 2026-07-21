-- ============================================================
-- Migration 021: Allow NULL actor for system-generated audit entries
-- ============================================================
-- The cron uses a fake UUID (00000000-...) that does not exist in
-- auth.users / profiles, causing FK violations and silent failures
-- when writing audit_log and ticket_status_history rows.
-- Making these columns nullable lets system actions be recorded
-- without a human actor.

ALTER TABLE audit_log
  ALTER COLUMN actor_id DROP NOT NULL;

ALTER TABLE ticket_status_history
  ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE ticket_comments
  ALTER COLUMN author_id DROP NOT NULL;
