-- ============================================================
-- People Hub — Seed Data
-- Categories + routing rules.  Replace owner emails with real
-- addresses before running in production.
-- ============================================================

-- Categories (matching the original GAS app)
INSERT INTO categories (id, name, description, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'IT',         'IT support, hardware, software, VPN, access', TRUE),
  ('11111111-0000-0000-0000-000000000002', 'HR',          'HR queries, payroll, contracts, benefits',    TRUE),
  ('11111111-0000-0000-0000-000000000003', 'Facilities',  'Office maintenance, supplies, seating',       TRUE),
  ('11111111-0000-0000-0000-000000000004', 'Parking',     'Parking permits, access cards',               TRUE),
  ('11111111-0000-0000-0000-000000000005', 'General',     'General enquiries',                           TRUE)
ON CONFLICT (name) DO NOTHING;

-- Routing rules — one row per category.
-- owner_email should match the profile email of a People Hub admin.
-- sla_hours:  IT=24h, HR=72h, Facilities=48h, Parking=48h, General=72h
INSERT INTO routing_rules (category_id, owner_email, backup_owner_email, default_priority, sla_hours) VALUES
  ('11111111-0000-0000-0000-000000000001', 'it-support@huspy.io',  'people-team@huspy.io', 'high',   24),
  ('11111111-0000-0000-0000-000000000002', 'hr@huspy.io',          'people-team@huspy.io', 'medium', 72),
  ('11111111-0000-0000-0000-000000000003', 'facilities@huspy.io',  'people-team@huspy.io', 'medium', 48),
  ('11111111-0000-0000-0000-000000000004', 'facilities@huspy.io',  'people-team@huspy.io', 'low',    48),
  ('11111111-0000-0000-0000-000000000005', 'people-team@huspy.io', NULL,                   'low',    72)
ON CONFLICT (category_id) DO NOTHING;

-- ─── Make the first admin ─────────────────────────────────────
-- After you sign in for the first time with your Google account,
-- run this UPDATE to grant yourself the admin role.
-- Replace the email with your actual @huspy.io address.
--
-- UPDATE profiles SET role = 'admin' WHERE email = 'juan.tamayo@huspy.io';
