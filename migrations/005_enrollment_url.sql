-- Migration 005: Add enrollment_url column for Vertical B (Instant QR Enrollment)
-- Purpose: Store PassKit SmartPass URLs for QR code enrollment at business locations
-- Run this in Supabase Studio > SQL Editor

-- ============================================================================
-- PROGRAMS TABLE: Add enrollment_url column
-- ============================================================================
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS enrollment_url TEXT;

COMMENT ON COLUMN programs.enrollment_url IS 'PassKit SmartPass enrollment URL for Vertical B QR code enrollment (e.g., https://pub2.pskt.io/c/{shortcode})';

-- ============================================================================
-- PASSES_MASTER TABLE: Add columns for Vertical B enrollment tracking
-- ============================================================================

-- Add enrollment_source column to track how the pass was acquired
ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS enrollment_source TEXT DEFAULT 'CLAIM_CODE';

-- Add member info columns if they don't exist
ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS member_email TEXT;

ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS member_first_name TEXT;

ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS member_last_name TEXT;

-- Add points_balance column if it doesn't exist
ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0;

-- Add protocol column if it doesn't exist
ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS protocol TEXT DEFAULT 'MEMBERSHIP';

-- Add last_updated column if it doesn't exist
ALTER TABLE passes_master 
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN passes_master.enrollment_source IS 'How the pass was acquired: QR_SCAN (Vertical B), CLAIM_CODE (Vertical A direct mail), API (direct enrollment)';
COMMENT ON COLUMN passes_master.member_email IS 'Member email address for notifications and identification';
COMMENT ON COLUMN passes_master.member_first_name IS 'Member first name';
COMMENT ON COLUMN passes_master.member_last_name IS 'Member last name';

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'programs' as table_name, column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'programs' 
AND column_name = 'enrollment_url'

UNION ALL

SELECT 'passes_master' as table_name, column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'passes_master' 
AND column_name IN ('enrollment_source', 'member_email', 'member_first_name', 'member_last_name', 'points_balance', 'protocol')
ORDER BY table_name, column_name;
