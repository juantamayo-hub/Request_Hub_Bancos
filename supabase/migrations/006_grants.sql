-- ============================================================
-- Request Hub Bancos — Role Grants
-- Run AFTER all other migrations.
-- ============================================================

-- authenticated: users logged in via Supabase Auth (RLS applies)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- service_role: server-side admin client (bypasses RLS, needs table privileges)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
