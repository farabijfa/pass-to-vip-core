-- Migration 020: Add PassKit Tier ID columns to programs table
-- These columns allow different PassKit template designs per tier level
-- PassKit tier IDs are optional - if not set, the default pass design is used

ALTER TABLE programs
ADD COLUMN IF NOT EXISTS passkit_tier_bronze_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS passkit_tier_silver_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS passkit_tier_gold_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS passkit_tier_platinum_id TEXT DEFAULT NULL;

COMMENT ON COLUMN programs.passkit_tier_bronze_id IS 'Optional PassKit template ID for Bronze tier pass design';
COMMENT ON COLUMN programs.passkit_tier_silver_id IS 'Optional PassKit template ID for Silver tier pass design';
COMMENT ON COLUMN programs.passkit_tier_gold_id IS 'Optional PassKit template ID for Gold tier pass design';
COMMENT ON COLUMN programs.passkit_tier_platinum_id IS 'Optional PassKit template ID for Platinum tier pass design';
