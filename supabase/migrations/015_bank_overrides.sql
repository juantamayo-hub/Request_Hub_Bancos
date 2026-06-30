-- 015_bank_overrides.sql
-- Adds per-bank assignee overrides to routing_rules.
-- Format: [{ "bank": "Santander", "assignee_email": "user@bayteca.com" }]

ALTER TABLE routing_rules
  ADD COLUMN IF NOT EXISTS bank_overrides JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: Santander → florencia.fernandez@bayteca.com for "Contactar con el cliente (Banco)"
UPDATE routing_rules r
SET bank_overrides = '[{"bank":"Santander","assignee_email":"florencia.fernandez@bayteca.com"}]'::jsonb
FROM categories c
WHERE c.id = r.category_id
  AND c.name = 'Contactar con el cliente (Banco)';
