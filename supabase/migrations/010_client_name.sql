-- Migration 010: Add client_name column to tickets
-- Stores the name of the mortgage applicant (person_id.name from Pipedrive)

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS client_name TEXT;

COMMENT ON COLUMN tickets.client_name IS 'Name of the mortgage applicant, auto-filled from Pipedrive person_id.name';
