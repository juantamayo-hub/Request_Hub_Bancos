-- ============================================================
-- 013_performance_indexes.sql
-- Performance indexes + touch-ticket-on-comment trigger
-- Run AFTER 012_follower_comment_access.sql
-- ============================================================

-- ─── Performance indexes ──────────────────────────────────────

-- Critical: pipedrive_deal_id had no index and is filtered by:
--   • cron Pass 1.5 (lost deal check)
--   • cron Pass 2 (auto-close)
--   • cron Pass 3 (deduplication per overdue rule)
--   • POST /api/tickets (duplicate check on creation)
--   • GET /api/tickets/deal/[dealId] (duplicate warning in form)
CREATE INDEX IF NOT EXISTS idx_tickets_pipedrive_deal_id
  ON tickets(pipedrive_deal_id);

-- Composite partial: most common cron filter pattern
-- (pipedrive_deal_id, status) WHERE pipedrive_deal_id IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_tickets_pipedrive_deal_status
  ON tickets(pipedrive_deal_id, status)
  WHERE pipedrive_deal_id IS NOT NULL;

-- Cron Pass 1: snooze reopen filters status='closed' AND snoozed_until <= now()
-- Partial index covers only rows where snooze is set (minority of tickets)
CREATE INDEX IF NOT EXISTS idx_tickets_status_snoozed
  ON tickets(status, snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- RLS follower policy does EXISTS on ticket_followers(user_id)
CREATE INDEX IF NOT EXISTS idx_ticket_followers_user_id
  ON ticket_followers(user_id);

-- Cron loads system categories with is_system = true
CREATE INDEX IF NOT EXISTS idx_categories_is_system
  ON categories(is_system);

-- ─── Touch ticket updated_at on comment insert ────────────────
-- When a comment is inserted, bump the parent ticket's updated_at.
-- This makes tickets.updated_at reflect "last activity" (including
-- comments, not just status/assignee changes).
--
-- SECURITY DEFINER is required: employees can INSERT into ticket_comments
-- but cannot UPDATE tickets (RLS policy tickets_update_admin is admin-only).
-- The function bypasses RLS for the single targeted UPDATE on updated_at.

CREATE OR REPLACE FUNCTION touch_ticket_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE tickets SET updated_at = NOW() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

-- Drop first in case this migration is re-run
DROP TRIGGER IF EXISTS trg_touch_ticket_on_comment ON ticket_comments;

CREATE TRIGGER trg_touch_ticket_on_comment
  AFTER INSERT ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION touch_ticket_on_comment();
