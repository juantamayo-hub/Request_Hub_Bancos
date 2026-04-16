-- ============================================================
-- Migration 008: System auto-generated categories
--
-- 1. Makes tickets.created_by nullable so the cron job can
--    insert tickets without a human author.
-- 2. Adds is_system flag to categories (hidden from the ticket
--    creation form but visible in User Management).
-- 3. Inserts 3 overdue-alert categories with Cecilia as owner.
-- ============================================================

-- Allow cron-generated tickets (no human author)
ALTER TABLE tickets ALTER COLUMN created_by DROP NOT NULL;

-- Mark categories that are managed by automation, not users
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── System categories ────────────────────────────────────────
INSERT INTO categories (name, description, is_system, is_active) VALUES
  (
    'FEIN Overdue',
    'Auto: deal bancario en stage FEIN (73) con más de 5 días sin avance',
    TRUE, TRUE
  ),
  (
    'Bank Submission Overdue',
    'Auto: deal bancario en stage Bank Submission (70) con más de 48h sin oferta bancaria',
    TRUE, TRUE
  ),
  (
    'Valuation Overdue',
    'Auto: deal bancario en stage Valuation (72) con más de 5 días sin avance a FEIN',
    TRUE, TRUE
  )
ON CONFLICT (name) DO NOTHING;

-- ─── Routing rules (Cecilia as owner) ────────────────────────
-- Uses high priority and 48-hour SLA for all overdue alerts.
INSERT INTO routing_rules (category_id, owner_email, default_priority, sla_hours)
SELECT id, 'cecilia.parent@bayteca.com', 'high'::ticket_priority, 48
FROM categories
WHERE name IN ('FEIN Overdue', 'Bank Submission Overdue', 'Valuation Overdue')
ON CONFLICT (category_id) DO NOTHING;
