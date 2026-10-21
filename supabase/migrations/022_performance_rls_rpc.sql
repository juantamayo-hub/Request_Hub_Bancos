-- ============================================================
-- 022_performance_rls_rpc.sql
-- Performance: RLS initPlan rewrite + dashboard aggregate RPCs
--              + trigram indexes for ticket text search
-- Run AFTER 021_nullable_system_actor.sql
--
-- Safety notes
--   • Policies keep their exact names and semantics. The only change is
--     wrapping auth.uid() / is_admin() in (SELECT …) so Postgres evaluates
--     them ONCE per query (initPlan) instead of once per row.
--     See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--   • RPCs are SECURITY INVOKER (default): they run with the caller's
--     permissions, so RLS on tickets still applies exactly as before.
--   • The app falls back to the previous queries if the RPCs don't exist,
--     so deploying the code before running this migration is safe.
--   • Before running in production, compare current policies with:
--       SELECT policyname, cmd, qual, with_check
--       FROM pg_policies WHERE tablename IN ('tickets', 'notifications');
--     They should match 002 / 011 / 014. If they differ, STOP and review.
-- ============================================================

BEGIN;

-- ─── 1. RLS: evaluate auth functions once per query ───────────

-- tickets (002)
DROP POLICY IF EXISTS "tickets_select_own" ON tickets;
CREATE POLICY "tickets_select_own"
  ON tickets FOR SELECT
  USING ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "tickets_select_admin" ON tickets;
CREATE POLICY "tickets_select_admin"
  ON tickets FOR SELECT
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS "tickets_insert_authenticated" ON tickets;
CREATE POLICY "tickets_insert_authenticated"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "tickets_update_admin" ON tickets;
CREATE POLICY "tickets_update_admin"
  ON tickets FOR UPDATE
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- tickets (011): own OR followed
DROP POLICY IF EXISTS "employees_view_own" ON tickets;
CREATE POLICY "employees_view_own" ON tickets FOR SELECT USING (
  (SELECT auth.uid()) = created_by
  OR EXISTS (
    SELECT 1 FROM ticket_followers
    WHERE ticket_id = tickets.id AND user_id = (SELECT auth.uid())
  )
);

-- notifications (014): lets the planner use idx_notifications_user_unread
DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- ─── 2. Dashboard aggregate RPCs ──────────────────────────────
-- Return a single JSONB value, so PostgREST's max-rows limit (1000)
-- can never truncate the result, and only counts travel over the wire.

-- Operations in the selected period (mirrors the dashboard's opsQuery).
-- Groups are kept at the raw-id level; the app maps ids → names exactly as
-- before (unknown category → 'Otra', null bank → 'Sin banco', etc.).
CREATE OR REPLACE FUNCTION dashboard_ops_summary(
  p_from     TIMESTAMPTZ,
  p_to       TIMESTAMPTZ,
  p_bank     TEXT,
  p_category UUID,
  p_now      TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ops AS (
    SELECT category_id, bank_name, status::text AS status,
           priority::text AS priority, assignee_id, created_at
    FROM tickets
    WHERE created_at >= p_from
      AND created_at <= p_to
      AND (p_bank     IS NULL OR bank_name   = p_bank)
      AND (p_category IS NULL OR category_id = p_category)
  )
  SELECT jsonb_build_object(
    -- category × bank × status (status kept raw; app decides open/closed)
    'cat_bank_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'category_id', category_id, 'bank_name', bank_name,
        'status', status, 'n', n))
      FROM (SELECT category_id, bank_name, status, COUNT(*) AS n
            FROM ops GROUP BY 1, 2, 3) g
    ), '[]'::jsonb),
    -- assignee × status
    'assignee_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'assignee_id', assignee_id, 'status', status, 'n', n))
      FROM (SELECT assignee_id, status, COUNT(*) AS n
            FROM ops WHERE assignee_id IS NOT NULL GROUP BY 1, 2) g
    ), '[]'::jsonb),
    -- open tickets: priority × age bucket (same thresholds as the app)
    'open_priority_age', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'priority', priority, 'age_bucket', age_bucket, 'n', n))
      FROM (
        SELECT priority,
               CASE
                 WHEN p_now - created_at < INTERVAL '3 days' THEN '1-3d'
                 WHEN p_now - created_at < INTERVAL '7 days' THEN '3-7d'
                 ELSE '7d+'
               END AS age_bucket,
               COUNT(*) AS n
        FROM ops
        WHERE status NOT IN ('resolved', 'closed')
        GROUP BY 1, 2
      ) g
    ), '[]'::jsonb)
  );
$$;

-- All-time figures that don't depend on the dashboard filters.
CREATE OR REPLACE FUNCTION dashboard_global_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'avg_resolution_days', (
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) / 86400.0, 0)
      FROM tickets
      WHERE status IN ('resolved', 'closed') AND resolved_at IS NOT NULL
    ),
    'banks', COALESCE((
      SELECT jsonb_agg(DISTINCT bank_name)
      FROM tickets
      WHERE bank_name IS NOT NULL AND bank_name <> ''
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION dashboard_ops_summary(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION dashboard_global_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dashboard_ops_summary(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION dashboard_global_stats() TO authenticated;

-- ─── 3. Trigram indexes for ilike '%…%' search ────────────────
-- Used by /admin/tickets (q → subject, display_id, client_name) and the
-- client_name filter on both ticket lists.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_tickets_subject_trgm
  ON tickets USING gin (subject extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tickets_display_id_trgm
  ON tickets USING gin (display_id extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tickets_client_name_trgm
  ON tickets USING gin (client_name extensions.gin_trgm_ops);

COMMIT;
