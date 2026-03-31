-- ============================================================
-- Migration 007: Add pipedrive_deal_id to tickets
-- ============================================================

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pipedrive_deal_id BIGINT;
