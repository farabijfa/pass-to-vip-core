-- Migration: 012_secure_public_access.sql
-- Purpose: Secure public access by restricting anon role to RPC functions only
-- Critical Security: This migration prevents direct table access via the anon key
-- 
-- IMPORTANT: Run this migration in Supabase Studio SQL Editor
-- After running, the anon key can ONLY call approved RPC functions

-- ============================================================================
-- STEP 1: Create secure RPC function for public program info lookup
-- ============================================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS get_public_program_info(text);

-- Create the secure public lookup function
-- This returns ONLY the minimal fields needed for public enrollment
CREATE OR REPLACE FUNCTION get_public_program_info(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  protocol text,
  enrollment_url text,
  is_suspended boolean
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with definer's privileges, not caller's
SET search_path = public
AS $$
BEGIN
  -- Validate input
  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RAISE EXCEPTION 'Invalid slug parameter';
  END IF;

  -- Return only public-safe fields
  RETURN QUERY
  SELECT 
    p.id,
    p.name::text,
    COALESCE(p.protocol, 'MEMBERSHIP')::text,
    p.enrollment_url::text,
    COALESCE(p.is_suspended, false)
  FROM programs p
  WHERE p.dashboard_slug = lower(trim(p_slug))
  LIMIT 1;
END;
$$;

-- Add function comment for documentation
COMMENT ON FUNCTION get_public_program_info(text) IS 
  'Public-safe lookup of program info by dashboard slug. Returns minimal fields only.';

-- ============================================================================
-- STEP 2: Enable Row Level Security on all sensitive tables
-- ============================================================================

-- Enable RLS on all tables (only if they exist - fully idempotent)
DO $$
BEGIN
  -- Core tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programs') THEN
    EXECUTE 'ALTER TABLE programs ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'passes_master') THEN
    EXECUTE 'ALTER TABLE passes_master ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_profiles') THEN
    EXECUTE 'ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    EXECUTE 'ALTER TABLE transactions ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claim_codes') THEN
    EXECUTE 'ALTER TABLE claim_codes ENABLE ROW LEVEL SECURITY';
  END IF;
  
  -- Optional tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_logs') THEN
    EXECUTE 'ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_logs') THEN
    EXECUTE 'ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_api_keys') THEN
    EXECUTE 'ALTER TABLE pos_api_keys ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_transactions') THEN
    EXECUTE 'ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'birthday_logs') THEN
    EXECUTE 'ALTER TABLE birthday_logs ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Revoke ALL direct table permissions from anon role
-- ============================================================================

-- Revoke all privileges on tables from anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Revoke sequence usage (prevents auto-increment manipulation)
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Revoke function execution by default (we'll grant specific ones back)
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- ============================================================================
-- STEP 4: Create deny-by-default RLS policies for anon role
-- ============================================================================

-- Create deny-by-default RLS policies for anon role on ALL tables (fully idempotent)
DO $$
BEGIN
  -- Core tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_programs" ON programs';
    EXECUTE 'CREATE POLICY "anon_deny_programs" ON programs FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'passes_master') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_passes_master" ON passes_master';
    EXECUTE 'CREATE POLICY "anon_deny_passes_master" ON passes_master FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_users" ON users';
    EXECUTE 'CREATE POLICY "anon_deny_users" ON users FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_profiles') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_admin_profiles" ON admin_profiles';
    EXECUTE 'CREATE POLICY "anon_deny_admin_profiles" ON admin_profiles FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_transactions" ON transactions';
    EXECUTE 'CREATE POLICY "anon_deny_transactions" ON transactions FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claim_codes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_claim_codes" ON claim_codes';
    EXECUTE 'CREATE POLICY "anon_deny_claim_codes" ON claim_codes FOR ALL TO anon USING (false)';
  END IF;

  -- Optional tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_notification_logs" ON notification_logs';
    EXECUTE 'CREATE POLICY "anon_deny_notification_logs" ON notification_logs FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_campaign_logs" ON campaign_logs';
    EXECUTE 'CREATE POLICY "anon_deny_campaign_logs" ON campaign_logs FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_api_keys') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_pos_api_keys" ON pos_api_keys';
    EXECUTE 'CREATE POLICY "anon_deny_pos_api_keys" ON pos_api_keys FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_transactions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_pos_transactions" ON pos_transactions';
    EXECUTE 'CREATE POLICY "anon_deny_pos_transactions" ON pos_transactions FOR ALL TO anon USING (false)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'birthday_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_deny_birthday_logs" ON birthday_logs';
    EXECUTE 'CREATE POLICY "anon_deny_birthday_logs" ON birthday_logs FOR ALL TO anon USING (false)';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Grant EXECUTE only on approved public RPC functions
-- ============================================================================

-- Grant execute permission on the public program info function
GRANT EXECUTE ON FUNCTION get_public_program_info(text) TO anon;

-- Also grant to authenticated role for consistency
GRANT EXECUTE ON FUNCTION get_public_program_info(text) TO authenticated;

-- ============================================================================
-- STEP 6: Ensure service_role retains full access (for backend operations)
-- ============================================================================

-- The service_role should bypass RLS by default, but ensure it has permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================================
-- STEP 7: Ensure authenticated role has appropriate access
-- ============================================================================

-- Authenticated users need proper RLS policies (not included here - 
-- those should be program-scoped policies that check admin_profiles)

-- Grant basic permissions that will be filtered by RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration worked)
-- ============================================================================

-- Verify the function exists and returns expected structure:
-- SELECT * FROM get_public_program_info('your-test-slug');

-- Verify anon cannot access tables directly:
-- SET ROLE anon;
-- SELECT * FROM programs; -- Should return empty or error
-- SELECT * FROM get_public_program_info('your-test-slug'); -- Should work
-- RESET ROLE;

-- List all policies on programs table:
-- SELECT * FROM pg_policies WHERE tablename = 'programs';

-- ============================================================================
-- ROLLBACK (If needed, run these to undo the migration)
-- ============================================================================

-- To rollback this migration:
-- DROP POLICY IF EXISTS "anon_deny_programs" ON programs;
-- DROP POLICY IF EXISTS "anon_deny_passes_master" ON passes_master;
-- DROP POLICY IF EXISTS "anon_deny_users" ON users;
-- DROP POLICY IF EXISTS "anon_deny_admin_profiles" ON admin_profiles;
-- DROP POLICY IF EXISTS "anon_deny_transactions" ON transactions;
-- DROP POLICY IF EXISTS "anon_deny_claim_codes" ON claim_codes;
-- DROP POLICY IF EXISTS "anon_deny_notification_logs" ON notification_logs;
-- DROP POLICY IF EXISTS "anon_deny_campaign_logs" ON campaign_logs;
-- DROP POLICY IF EXISTS "anon_deny_pos_api_keys" ON pos_api_keys;
-- DROP POLICY IF EXISTS "anon_deny_pos_transactions" ON pos_transactions;
-- DROP POLICY IF EXISTS "anon_deny_birthday_logs" ON birthday_logs;
-- GRANT SELECT ON programs TO anon; -- Restore if needed
-- DROP FUNCTION IF EXISTS get_public_program_info(text);
