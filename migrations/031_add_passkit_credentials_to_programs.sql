-- Migration 031: Add PassKit API credentials columns to programs table
-- Purpose: Enable per-program PassKit credentials for multi-tenant sync
-- This allows each program (like Manali Bakes) to use its own PassKit API keys
-- instead of relying on global environment variable credentials

-- Add passkit_api_key column
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS passkit_api_key TEXT DEFAULT NULL;

-- Add passkit_api_secret column
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS passkit_api_secret TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN programs.passkit_api_key IS 'Per-program PassKit API Key (uid) for authentication. If NULL, uses global env credentials.';
COMMENT ON COLUMN programs.passkit_api_secret IS 'Per-program PassKit API Secret for JWT signing. If NULL, uses global env credentials.';

-- Note: These columns intentionally allow NULL
-- When NULL, the sync service falls back to global PASSKIT_API_KEY and PASSKIT_API_SECRET env vars
-- This maintains backward compatibility with programs that use global credentials

-- Security note: These credentials should only be accessible to authenticated admin users
-- The Supabase RLS policies should restrict access appropriately
