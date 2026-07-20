-- Migration 019: Resync global_ticket_seq + resilient display_id trigger
-- Fixes "duplicate key value violates unique constraint tickets_display_id_key"

-- 1. Resync sequence to the max across ALL display_id prefixes (HSPY + BAN)
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

-- 2. Replace trigger function with a retry loop so it auto-skips collisions
CREATE OR REPLACE FUNCTION generate_ticket_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq_num BIGINT;
  new_id  TEXT;
BEGIN
  LOOP
    seq_num := nextval('global_ticket_seq');
    new_id  := 'BAN-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM tickets WHERE display_id = new_id);
  END LOOP;
  NEW.display_id := new_id;
  RETURN NEW;
END;
$$;
