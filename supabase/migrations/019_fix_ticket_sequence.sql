-- Migration 019: Resync global_ticket_seq to current max
-- Fixes "duplicate key value violates unique constraint tickets_display_id_key"
-- caused by the sequence being reset below the maximum already-used value.

-- Restore the simple trigger (no retry loop — loop + RLS causes statement timeout)
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

-- Resync sequence to the max across ALL display_id prefixes (HSPY + BAN)
-- and never go backwards from the current sequence value.
SELECT setval(
  'global_ticket_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(CAST(regexp_replace(display_id, '.*-', '') AS INTEGER))
       FROM tickets
       WHERE display_id IS NOT NULL
         AND display_id ~ '-[0-9]+$'),
      0
    ),
    (SELECT last_value FROM global_ticket_seq)
  )
);
