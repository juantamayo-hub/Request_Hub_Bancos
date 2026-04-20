-- ============================================================
-- Request Hub Bancos — Migration 009: Round-Robin Routing
-- Adds multi-assignee round-robin support to routing_rules.
-- ============================================================

ALTER TABLE routing_rules
  ADD COLUMN IF NOT EXISTS assignee_emails    TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS round_robin_index  INTEGER NOT NULL DEFAULT 0;

-- ── Atomic round-robin picker ─────────────────────────────────
-- Increments the counter and returns the next assignee email.
-- Caller resolves the email → profile id.
CREATE OR REPLACE FUNCTION pick_next_assignee_email(p_category_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emails TEXT[];
  v_index  INTEGER;
BEGIN
  UPDATE routing_rules
  SET    round_robin_index = round_robin_index + 1
  WHERE  category_id = p_category_id
  RETURNING assignee_emails, round_robin_index - 1
  INTO v_emails, v_index;

  IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- PostgreSQL arrays are 1-indexed
  RETURN v_emails[(v_index % array_length(v_emails, 1)) + 1];
END;
$$;

-- ── Populate assignee_emails for all categories ───────────────

-- Acelerar aprobación área riesgos
UPDATE routing_rules SET assignee_emails = ARRAY[
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Acelerar aprobación área riesgos');

-- Acelerar emisión de FEIN
UPDATE routing_rules SET assignee_emails = ARRAY[
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Acelerar emisión de FEIN');

-- Contactar con el cliente (Banco)
UPDATE routing_rules SET assignee_emails = ARRAY[
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Contactar con el cliente (Banco)');

-- Nuevo envío
UPDATE routing_rules SET assignee_emails = ARRAY[
  'oscar.sastre@bayteca.com',
  'florencia.fernandez@bayteca.com',
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Nuevo envío');

-- Solicitar mejoras oferta inicial
UPDATE routing_rules SET assignee_emails = ARRAY[
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Solicitar mejoras oferta inicial');

-- Solicitar oferta
UPDATE routing_rules SET assignee_emails = ARRAY[
  'florencia.fernandez@bayteca.com',
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Solicitar oferta');

-- Otra
UPDATE routing_rules SET assignee_emails = ARRAY[
  'oscar.sastre@bayteca.com',
  'florencia.fernandez@bayteca.com',
  'cecilia.parent@bayteca.com',
  'silvia.amigo@bayteca.com',
  'ana.rodriguez@bayteca.com'
] WHERE category_id = (SELECT id FROM categories WHERE name = 'Otra');

-- System categories (single assignee)
UPDATE routing_rules SET assignee_emails = ARRAY['cecilia.parent@bayteca.com']
WHERE category_id IN (SELECT id FROM categories WHERE is_system = TRUE);

-- ── Batch round-robin picker (used by cron for bulk inserts) ──
-- Returns an array of N emails advancing the counter atomically.
CREATE OR REPLACE FUNCTION pick_assignees_batch(p_category_id UUID, p_count INTEGER)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emails TEXT[];
  v_start  INTEGER;
  v_len    INTEGER;
  v_result TEXT[] := '{}';
BEGIN
  UPDATE routing_rules
  SET    round_robin_index = round_robin_index + p_count
  WHERE  category_id = p_category_id
  RETURNING assignee_emails, round_robin_index - p_count
  INTO v_emails, v_start;

  IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
    RETURN '{}';
  END IF;

  v_len := array_length(v_emails, 1);
  FOR i IN 0..p_count - 1 LOOP
    v_result := array_append(v_result, v_emails[((v_start + i) % v_len) + 1]);
  END LOOP;
  RETURN v_result;
END;
$$;
