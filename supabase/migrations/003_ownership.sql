-- ============================================================
-- People Hub — Migration 003: Category Ownership + Round-Robin
-- ============================================================

-- ─── 1. Profile availability flag ─────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 2. Support type on tickets ───────────────────────────────
-- Values mirror the wizard support types:
-- documents | visa | health_insurance | parking | time_off | revolut | other
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS support_type TEXT;

-- ─── 3. Support-type owners ───────────────────────────────────
-- Multiple owners per support type; sort_order drives round-robin order.
CREATE TABLE IF NOT EXISTS support_type_owners (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  support_type TEXT        NOT NULL,
  owner_email  TEXT        NOT NULL,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (support_type, owner_email)
);

-- ─── 4. Round-robin counter per support type ──────────────────
CREATE TABLE IF NOT EXISTS round_robin_counters (
  support_type TEXT        PRIMARY KEY,
  counter      INTEGER     NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. Atomic assign-owner function ─────────────────────────
-- Returns the email of the next owner for a given support_type.
-- Uses INSERT ON CONFLICT to atomically increment the counter.
-- Falls back to maryam.mesforoush@huspy.io when no active owner found.
CREATE OR REPLACE FUNCTION assign_ticket_owner(p_support_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owners      TEXT[];
  v_counter     INTEGER;
  v_num_owners  INTEGER;
  v_fallback    TEXT := 'maryam.mesforoush@huspy.io';
BEGIN
  -- Collect active owners for this support type.
  -- LEFT JOIN profiles so owners not yet signed-in (no profile row) are treated as available.
  SELECT ARRAY_AGG(sto.owner_email ORDER BY sto.sort_order, sto.created_at)
  INTO v_owners
  FROM support_type_owners sto
  LEFT JOIN profiles p ON p.email = sto.owner_email
  WHERE sto.support_type = p_support_type
    AND COALESCE(p.is_available, TRUE) = TRUE;

  -- No active owners → fallback
  IF v_owners IS NULL OR array_length(v_owners, 1) = 0 THEN
    RETURN v_fallback;
  END IF;

  v_num_owners := array_length(v_owners, 1);

  -- Atomically increment counter; RETURNING gives the NEW value.
  INSERT INTO round_robin_counters (support_type, counter, updated_at)
  VALUES (p_support_type, 1, NOW())
  ON CONFLICT (support_type) DO UPDATE
    SET counter    = round_robin_counters.counter + 1,
        updated_at = NOW()
  RETURNING counter INTO v_counter;

  -- 1-indexed PG array; use (counter-1) % n to get 0-based index.
  RETURN v_owners[1 + ((v_counter - 1) % v_num_owners)];
END;
$$;

-- ─── 6. RLS ───────────────────────────────────────────────────

ALTER TABLE support_type_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_robin_counters ENABLE ROW LEVEL SECURITY;

-- Admins can read/write ownership config
CREATE POLICY "Admins manage support_type_owners"
  ON support_type_owners
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admins can read/write round-robin counters
CREATE POLICY "Admins manage round_robin_counters"
  ON round_robin_counters
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── 7. Seed: initial counters ────────────────────────────────
INSERT INTO round_robin_counters (support_type, counter) VALUES
  ('documents',       0),
  ('visa',            0),
  ('health_insurance',0),
  ('parking',         0),
  ('time_off',        0),
  ('revolut',         0),
  ('other',           0)
ON CONFLICT (support_type) DO NOTHING;

-- ─── 8. Seed: initial ownership ───────────────────────────────
-- These owners will be resolved to profile rows once they sign in.
-- sort_order drives round-robin sequence within each support type.
INSERT INTO support_type_owners (support_type, owner_email, sort_order) VALUES
  -- Documents: lama first, then kaira
  ('documents',       'lama.rahma@huspy.io',         0),
  ('documents',       'kaira.poladia@huspy.io',       1),
  -- Visa: mareeha first, then nourah
  ('visa',            'mareeha.ahmed@huspy.io',       0),
  ('visa',            'nourah.ali@huspy.io',          1),
  -- Health Insurance: lama only
  ('health_insurance','lama.rahma@huspy.io',          0),
  -- Parking: kaira only
  ('parking',         'kaira.poladia@huspy.io',       0),
  -- Time Off: mareeha only
  ('time_off',        'mareeha.ahmed@huspy.io',       0),
  -- Revolut: mareeha only
  ('revolut',         'mareeha.ahmed@huspy.io',       0),
  -- Other: maryam only
  ('other',           'maryam.mesforoush@huspy.io',   0)
ON CONFLICT (support_type, owner_email) DO NOTHING;
