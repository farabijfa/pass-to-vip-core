-- Migration 025: External POS Webhook with Spend-Based Tiers (v2.6.0)
-- 
-- This migration adds support for external POS systems (e.g., Levi's) to integrate
-- with Pass To VIP for spend-based tier calculation and automatic discount assignment.
--
-- Run this in Supabase SQL Editor

-- ============================================================================
-- 1. Add spend tier thresholds and discount percentages to programs table
-- ============================================================================

-- Spend-based tier thresholds (in cents)
-- Example: $300 = 30000 cents for Silver tier
ALTER TABLE programs ADD COLUMN IF NOT EXISTS spend_tier_2_threshold_cents INTEGER DEFAULT 30000;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS spend_tier_3_threshold_cents INTEGER DEFAULT 100000;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS spend_tier_4_threshold_cents INTEGER DEFAULT 250000;

-- Discount percentages per tier (0-100)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS tier_1_discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS tier_2_discount_percent NUMERIC(5,2) DEFAULT 5;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS tier_3_discount_percent NUMERIC(5,2) DEFAULT 10;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS tier_4_discount_percent NUMERIC(5,2) DEFAULT 15;

COMMENT ON COLUMN programs.spend_tier_2_threshold_cents IS 'Cumulative spend (in cents) required for Tier 2 (Silver)';
COMMENT ON COLUMN programs.spend_tier_3_threshold_cents IS 'Cumulative spend (in cents) required for Tier 3 (Gold)';
COMMENT ON COLUMN programs.spend_tier_4_threshold_cents IS 'Cumulative spend (in cents) required for Tier 4 (Platinum)';
COMMENT ON COLUMN programs.tier_1_discount_percent IS 'Discount percentage for Tier 1 members (Bronze)';
COMMENT ON COLUMN programs.tier_2_discount_percent IS 'Discount percentage for Tier 2 members (Silver)';
COMMENT ON COLUMN programs.tier_3_discount_percent IS 'Discount percentage for Tier 3 members (Gold)';
COMMENT ON COLUMN programs.tier_4_discount_percent IS 'Discount percentage for Tier 4 members (Platinum)';

-- ============================================================================
-- 2. Add spend tracking columns to passes_master table
-- ============================================================================

-- External ID for POS system reference (e.g., Levi's customer ID)
ALTER TABLE passes_master ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Cumulative spend tracking (in cents)
ALTER TABLE passes_master ADD COLUMN IF NOT EXISTS spend_total_cents INTEGER DEFAULT 0;

-- Current spend-based tier level
ALTER TABLE passes_master ADD COLUMN IF NOT EXISTS spend_tier_level TEXT DEFAULT 'TIER_1';

-- Index for fast lookups by external ID
CREATE INDEX IF NOT EXISTS idx_passes_master_external_id 
ON passes_master(external_id) 
WHERE external_id IS NOT NULL;

-- Compound index for program + external_id lookups
CREATE INDEX IF NOT EXISTS idx_passes_master_program_external 
ON passes_master(program_id, external_id) 
WHERE external_id IS NOT NULL;

COMMENT ON COLUMN passes_master.external_id IS 'External customer ID from POS system (e.g., Levi''s customer ID)';
COMMENT ON COLUMN passes_master.spend_total_cents IS 'Total cumulative spend in cents';
COMMENT ON COLUMN passes_master.spend_tier_level IS 'Current tier level based on spend (TIER_1, TIER_2, TIER_3, TIER_4)';

-- ============================================================================
-- 3. Create spend_ledger table for transaction audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS spend_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES passes_master(id) ON DELETE CASCADE,
    external_transaction_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    store_id TEXT,
    idempotency_key TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_spend_ledger_program_member 
ON spend_ledger(program_id, member_id);

CREATE INDEX IF NOT EXISTS idx_spend_ledger_idempotency 
ON spend_ledger(program_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spend_ledger_created 
ON spend_ledger(created_at DESC);

COMMENT ON TABLE spend_ledger IS 'Audit trail for spend transactions from external POS systems';
COMMENT ON COLUMN spend_ledger.external_transaction_id IS 'Transaction ID from external POS system';
COMMENT ON COLUMN spend_ledger.idempotency_key IS 'Key to prevent duplicate transaction processing';

-- ============================================================================
-- 4. Ensure pos_api_keys table exists (may already exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pos_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    key_prefix TEXT,
    label TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add key_prefix column if table already exists
ALTER TABLE pos_api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_api_keys_hash 
ON pos_api_keys(key_hash) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pos_api_keys_program 
ON pos_api_keys(program_id);

COMMENT ON TABLE pos_api_keys IS 'API keys for external POS system authentication';

-- ============================================================================
-- 5. Row Level Security (if not already enabled)
-- ============================================================================

ALTER TABLE spend_ledger ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend operations)
CREATE POLICY IF NOT EXISTS "Service role has full access to spend_ledger" 
ON spend_ledger 
FOR ALL 
USING (auth.role() = 'service_role');

-- ============================================================================
-- Example: Configure Levi's program with spend thresholds
-- ============================================================================
-- 
-- UPDATE programs 
-- SET 
--     spend_tier_2_threshold_cents = 30000,  -- $300 for Silver
--     spend_tier_3_threshold_cents = 100000, -- $1000 for Gold
--     spend_tier_4_threshold_cents = 250000, -- $2500 for Platinum
--     tier_1_discount_percent = 0,           -- 0% for Bronze
--     tier_2_discount_percent = 5,           -- 5% for Silver
--     tier_3_discount_percent = 10,          -- 10% for Gold
--     tier_4_discount_percent = 15           -- 15% for Platinum
-- WHERE id = 'your-program-id';

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Check programs columns
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'programs' 
-- AND column_name LIKE '%tier%' OR column_name LIKE '%spend%';

-- Check passes_master columns
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'passes_master' 
-- AND column_name IN ('external_id', 'spend_total_cents', 'spend_tier_level');

-- Check spend_ledger table
-- SELECT * FROM information_schema.tables WHERE table_name = 'spend_ledger';
