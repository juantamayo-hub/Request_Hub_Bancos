-- ============================================================
-- People Hub — Initial Schema
-- Run this against your Supabase project via the Dashboard SQL
-- editor or `supabase db push`.
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ────────────────────────────────────────────────────
CREATE TYPE ticket_status   AS ENUM ('new','in_progress','waiting_on_employee','resolved','closed');
CREATE TYPE ticket_priority AS ENUM ('low','medium','high');
CREATE TYPE user_role       AS ENUM ('employee','admin');
CREATE TYPE comment_visibility AS ENUM ('public','internal');
CREATE TYPE audit_action    AS ENUM (
  'created','status_changed','assigned','priority_changed','comment_added','updated'
);

-- ─── Sequence for human-readable display IDs ─────────────────
-- Produces IDs like HSPY-2025-0001, HSPY-2025-0002, …
CREATE SEQUENCE IF NOT EXISTS global_ticket_seq START 1;

-- ─── profiles ─────────────────────────────────────────────────
-- Extends auth.users. Row is auto-created by trigger.
CREATE TABLE profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  first_name  TEXT,
  last_name   TEXT,
  role        user_role   NOT NULL DEFAULT 'employee',
  department  TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── categories ───────────────────────────────────────────────
CREATE TABLE categories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── routing_rules ────────────────────────────────────────────
-- One rule per category: who owns it, SLA, default priority.
CREATE TABLE routing_rules (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id         UUID            NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  owner_email         TEXT            NOT NULL,
  backup_owner_email  TEXT,
  default_priority    ticket_priority NOT NULL DEFAULT 'medium',
  sla_hours           INTEGER         NOT NULL DEFAULT 72,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (category_id)
);

-- ─── tickets ──────────────────────────────────────────────────
CREATE TABLE tickets (
  id           UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id   TEXT            UNIQUE,               -- set by trigger below
  created_by   UUID            NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assignee_id  UUID            REFERENCES profiles(id) ON DELETE SET NULL,
  category_id  UUID            NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory  TEXT,
  subject      TEXT            NOT NULL,
  description  TEXT            NOT NULL,
  priority     ticket_priority NOT NULL DEFAULT 'medium',
  status       ticket_status   NOT NULL DEFAULT 'new',
  sla_hours    INTEGER,
  sla_deadline TIMESTAMPTZ,
  tags         TEXT[],
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

-- ─── ticket_comments ──────────────────────────────────────────
CREATE TABLE ticket_comments (
  id          UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID               NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   UUID               NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body        TEXT               NOT NULL,
  visibility  comment_visibility NOT NULL DEFAULT 'public',
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ─── audit_log ────────────────────────────────────────────────
-- Written server-side only via service-role client. No RLS INSERT.
CREATE TABLE audit_log (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id  UUID         NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id   UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action     audit_action NOT NULL,
  from_value TEXT,
  to_value   TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── ticket_status_history ────────────────────────────────────
-- Full log of every status transition. Written server-side only.
CREATE TABLE ticket_status_history (
  id         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id  UUID          NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status     ticket_status NOT NULL,
  changed_by UUID          NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_tickets_created_by     ON tickets(created_by);
CREATE INDEX idx_tickets_status         ON tickets(status);
CREATE INDEX idx_tickets_priority       ON tickets(priority);
CREATE INDEX idx_tickets_category_id    ON tickets(category_id);
CREATE INDEX idx_tickets_assignee_id    ON tickets(assignee_id);
CREATE INDEX idx_tickets_created_at     ON tickets(created_at DESC);
CREATE INDEX idx_tickets_sla_deadline   ON tickets(sla_deadline);
CREATE INDEX idx_comments_ticket_id     ON ticket_comments(ticket_id);
CREATE INDEX idx_audit_ticket_id        ON audit_log(ticket_id);
CREATE INDEX idx_audit_actor_id         ON audit_log(actor_id);
CREATE INDEX idx_status_hist_ticket_id  ON ticket_status_history(ticket_id);

-- ─── updated_at trigger function ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_routing_rules_updated_at
  BEFORE UPDATE ON routing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Display-ID generator ─────────────────────────────────────
-- Format: HSPY-YYYY-NNNN (zero-padded 4-digit global sequence)
CREATE OR REPLACE FUNCTION generate_ticket_display_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq_num BIGINT;
BEGIN
  seq_num      := nextval('global_ticket_seq');
  NEW.display_id := 'HSPY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_ticket_display_id
  BEFORE INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_display_id();

-- ─── Auto set resolved_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION set_resolved_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('resolved','closed') AND OLD.status NOT IN ('resolved','closed') THEN
    NEW.resolved_at = NOW();
  ELSIF NEW.status NOT IN ('resolved','closed') AND OLD.status IN ('resolved','closed') THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_resolved_at
  BEFORE UPDATE OF status ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_resolved_at();

-- ─── Auto-create profile on Google OAuth sign-up ──────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'given_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Helper: is current user an admin? ───────────────────────
-- SECURITY DEFINER so it bypasses RLS when reading profiles,
-- preventing infinite recursion.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;
