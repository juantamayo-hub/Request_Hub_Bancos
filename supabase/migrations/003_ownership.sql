-- ============================================================
-- Request Hub Bancos — Migration 003: Profile Availability
-- ============================================================

-- Profile availability flag (used by admin UI to mark users unavailable)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
