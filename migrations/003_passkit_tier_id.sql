-- Migration 003: Add passkit_tier_id column to programs table
-- Purpose: Support per-client PassKit tier configuration instead of hardcoded 'base'
-- Run this in Supabase Studio > SQL Editor

-- Add passkit_tier_id column with default value
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS passkit_tier_id TEXT DEFAULT 'base';

-- Add postgrid_template_id column for physical mail templates
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS postgrid_template_id TEXT;

-- Add protocol column for routing logic (MEMBERSHIP, EVENT_TICKET, COUPON)
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS protocol TEXT DEFAULT 'MEMBERSHIP';

-- Comment for documentation
COMMENT ON COLUMN programs.passkit_tier_id IS 'PassKit Tier ID for this program (e.g., base, tier_bronze, tier_gold)';
COMMENT ON COLUMN programs.postgrid_template_id IS 'PostGrid template ID for physical mail campaigns';
COMMENT ON COLUMN programs.protocol IS 'Protocol type: MEMBERSHIP, EVENT_TICKET, or COUPON';

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'programs' 
AND column_name IN ('passkit_tier_id', 'postgrid_template_id', 'protocol');
