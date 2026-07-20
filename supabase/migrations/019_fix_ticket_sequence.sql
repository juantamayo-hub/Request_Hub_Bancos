-- Migration 019: Resync global_ticket_seq to current max
-- Fixes "duplicate key value violates unique constraint tickets_display_id_key"
-- caused by the sequence being reset below the maximum already-used value.

SELECT setval(
  'global_ticket_seq',
  COALESCE(
    (
      SELECT MAX(CAST(SPLIT_PART(display_id, '-', 3) AS INTEGER))
      FROM tickets
      WHERE display_id LIKE 'BAN-%'
        AND display_id ~ '^BAN-[0-9]{4}-[0-9]+$'
    ),
    0
  )
);
