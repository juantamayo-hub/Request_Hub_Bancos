-- ============================================================
-- Migration 005: Banking Schema — Request Hub Bancos
-- Adds bank_name and bank_email columns to tickets table.
-- Updates generate_ticket_display_id() to use 'BAN' prefix.
-- ============================================================

-- Add banking columns to tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS bank_name  TEXT,
  ADD COLUMN IF NOT EXISTS bank_email TEXT;

-- Replace the display-ID generator: HSPY-YYYY-NNNN → BAN-YYYY-NNNN
-- Using the same global_ticket_seq sequence defined in migration 001.
CREATE OR REPLACE FUNCTION generate_ticket_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq_num BIGINT;
BEGIN
  seq_num        := nextval('global_ticket_seq');
  NEW.display_id := 'BAN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;
