-- Migration 019: Fix display_id generation
--
-- Problem: global_ticket_seq was out of sync, generating display_ids
-- that already exist → unique constraint violation on every INSERT.
-- Retry loops timed out even with SECURITY DEFINER due to massive
-- gaps in the sequence vs existing display_ids.
--
-- Fix: abandon the sequence entirely. The trigger now computes the
-- next display_id from MAX(existing) + 1 for the current year.
-- SECURITY DEFINER bypasses RLS for a fast unique-index scan.
-- Note: LPAD uses 5 digits because we exceeded 9,999 tickets and
-- PostgreSQL's LPAD truncates strings longer than the target width.

CREATE OR REPLACE FUNCTION generate_ticket_display_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_num BIGINT;
  prefix   TEXT;
BEGIN
  prefix := 'BAN-' || TO_CHAR(NOW(), 'YYYY') || '-';

  SELECT COALESCE(MAX(CAST(regexp_replace(display_id, '.*-', '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM tickets
  WHERE display_id LIKE prefix || '%';

  NEW.display_id := prefix || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;
