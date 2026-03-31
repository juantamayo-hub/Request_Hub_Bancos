-- ============================================================
-- Banking Seed: Categories & Routing Rules for Request Hub Bancos
-- Run after 007_pipedrive_deal_id.sql migration.
-- Replace owner emails with real team emails post-deploy.
-- ============================================================

-- Deactivate any existing non-banking categories (optional — comment out if you want to keep them)
-- UPDATE categories SET is_active = false WHERE is_active = true;

-- Deactivate removed categories
UPDATE categories SET is_active = false WHERE name = 'Reclamación Bancaria';

-- Insert banking categories (idempotent)
INSERT INTO categories (name, description, is_active) VALUES
  ('Acelerar aprobación área riesgos', 'Solicitud para acelerar la aprobación por el área de riesgos del banco', true),
  ('Acelerar emisión de FEIN',          'Solicitud para acelerar la emisión de la Ficha Europea de Información Normalizada', true),
  ('Contactar con el cliente (Banco)',  'Coordinación de contacto entre el banco y el cliente', true),
  ('Solicitar mejoras oferta inicial',  'Solicitud de mejora de condiciones sobre la oferta inicial del banco', true),
  ('Solicitar oferta',                  'Solicitud de nueva oferta hipotecaria a una entidad bancaria', true),
  ('Nuevo envío',                       'Nuevo envío de documentación o solicitud bancaria', true),
  ('Otra',                              'Otras gestiones bancarias no contempladas en las categorías anteriores', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- Routing rules (replace emails with real team emails post-deploy)
INSERT INTO routing_rules (category_id, owner_email, default_priority, sla_hours)
SELECT id, 'bancos@huspy.io', 'medium', 48
FROM categories
WHERE name IN (
  'Acelerar aprobación área riesgos',
  'Acelerar emisión de FEIN',
  'Contactar con el cliente (Banco)',
  'Solicitar mejoras oferta inicial',
  'Solicitar oferta',
  'Otra'
)
ON CONFLICT DO NOTHING;

-- "Nuevo envío" routes to Oscar Sastre
INSERT INTO routing_rules (category_id, owner_email, default_priority, sla_hours)
SELECT id, 'oscar.sastre@bayteca.com', 'medium', 48
FROM categories
WHERE name = 'Nuevo envío'
ON CONFLICT DO NOTHING;
