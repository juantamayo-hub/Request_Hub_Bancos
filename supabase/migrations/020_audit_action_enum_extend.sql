-- Migration 020: Add comment_edited and comment_deleted to audit_action enum
-- Fixes "invalid input value for enum audit_action: comment_edited"

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'comment_edited';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'comment_deleted';
