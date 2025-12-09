-- ============================================================================
-- Migration 027: PassKit Sync System - Phase 0 Foundation
-- ============================================================================
-- Purpose: Create database foundation for robust PassKit-to-Database sync
-- This ensures all passes created in PassKit are synced to our database
-- 
-- Tables created:
-- 1. passkit_sync_state - Track sync cursors and timestamps per program
-- 2. passkit_event_journal - Audit trail for all sync operations
-- 
-- Indexes added:
-- 1. Unique constraint on passes_master(program_id, passkit_internal_id)
-- 
-- Functions created:
-- 1. upsert_membership_pass_from_passkit - Idempotent pass import
-- ============================================================================

-- =============================================================================
-- Table: passkit_sync_state
-- Tracks sync progress and cursors for each program
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkit_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  last_full_sync_at TIMESTAMPTZ,
  last_delta_sync_at TIMESTAMPTZ,
  last_sync_cursor TEXT,
  total_passes_synced INTEGER DEFAULT 0,
  last_sync_status VARCHAR(20) DEFAULT 'PENDING' CHECK (last_sync_status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'PARTIAL')),
  last_sync_error TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id)
);

-- Idempotent: Drop if exists before creating to avoid conflicts
DROP INDEX IF EXISTS idx_passkit_sync_state_program;
DROP INDEX IF EXISTS idx_passkit_sync_state_status;
CREATE INDEX IF NOT EXISTS idx_passkit_sync_state_program ON passkit_sync_state(program_id);
CREATE INDEX IF NOT EXISTS idx_passkit_sync_state_status ON passkit_sync_state(last_sync_status) WHERE sync_enabled = true;

ALTER TABLE passkit_sync_state ENABLE ROW LEVEL SECURITY;

-- Idempotent: Drop policy if exists before creating
DROP POLICY IF EXISTS "Service role can manage passkit_sync_state" ON passkit_sync_state;
CREATE POLICY "Service role can manage passkit_sync_state" ON passkit_sync_state
  FOR ALL USING (true);

COMMENT ON TABLE passkit_sync_state IS 'Tracks PassKit sync progress and cursors per program';
COMMENT ON COLUMN passkit_sync_state.last_sync_cursor IS 'Pagination cursor for incremental sync from PassKit API';
COMMENT ON COLUMN passkit_sync_state.total_passes_synced IS 'Running count of passes synced for this program';

-- =============================================================================
-- Table: passkit_event_journal
-- Audit trail for all sync operations
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkit_event_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'FULL_SYNC_START', 'FULL_SYNC_COMPLETE', 'FULL_SYNC_FAILED',
    'DELTA_SYNC_START', 'DELTA_SYNC_COMPLETE', 'DELTA_SYNC_FAILED',
    'PASS_CREATED', 'PASS_UPDATED', 'PASS_DEACTIVATED',
    'WEBHOOK_RECEIVED', 'MANUAL_SYNC_TRIGGERED',
    'CONFLICT_DETECTED', 'CONFLICT_RESOLVED'
  )),
  passkit_internal_id VARCHAR(50),
  external_id VARCHAR(100),
  event_payload JSONB,
  sync_source VARCHAR(20) DEFAULT 'API' CHECK (sync_source IN ('API', 'WEBHOOK', 'MANUAL', 'SCHEDULED')),
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent: Drop if exists before creating to avoid conflicts
DROP INDEX IF EXISTS idx_passkit_event_journal_program;
DROP INDEX IF EXISTS idx_passkit_event_journal_type;
DROP INDEX IF EXISTS idx_passkit_event_journal_passkit_id;
CREATE INDEX IF NOT EXISTS idx_passkit_event_journal_program ON passkit_event_journal(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passkit_event_journal_type ON passkit_event_journal(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passkit_event_journal_passkit_id ON passkit_event_journal(passkit_internal_id) WHERE passkit_internal_id IS NOT NULL;

ALTER TABLE passkit_event_journal ENABLE ROW LEVEL SECURITY;

-- Idempotent: Drop policy if exists before creating
DROP POLICY IF EXISTS "Service role can manage passkit_event_journal" ON passkit_event_journal;
CREATE POLICY "Service role can manage passkit_event_journal" ON passkit_event_journal
  FOR ALL USING (true);

COMMENT ON TABLE passkit_event_journal IS 'Audit trail for all PassKit sync operations';
COMMENT ON COLUMN passkit_event_journal.event_payload IS 'Raw event data from PassKit or sync operation details';
COMMENT ON COLUMN passkit_event_journal.processing_time_ms IS 'Time taken to process this event in milliseconds';

-- =============================================================================
-- Unique Index: Prevent duplicate passes per program
-- =============================================================================
-- Idempotent: Drop if exists before creating to avoid conflicts
DROP INDEX IF EXISTS idx_passes_master_program_passkit_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_passes_master_program_passkit_id 
ON passes_master(program_id, passkit_internal_id) 
WHERE passkit_internal_id IS NOT NULL;

COMMENT ON INDEX idx_passes_master_program_passkit_id IS 'Ensures no duplicate PassKit passes per program';

-- =============================================================================
-- Function: upsert_membership_pass_from_passkit
-- Idempotent pass import - creates or updates pass from PassKit data
-- CRITICAL: Never overwrites existing points_balance
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_membership_pass_from_passkit(
  p_program_id UUID,
  p_passkit_internal_id TEXT,
  p_external_id TEXT,
  p_status TEXT DEFAULT 'INSTALLED',
  p_member_email TEXT DEFAULT NULL,
  p_member_first_name TEXT DEFAULT NULL,
  p_member_last_name TEXT DEFAULT NULL,
  p_member_phone TEXT DEFAULT NULL,
  p_passkit_tier_name TEXT DEFAULT NULL,
  p_passkit_created_at TIMESTAMPTZ DEFAULT NULL,
  p_passkit_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_existing_pass passes_master%ROWTYPE;
  v_pass_id UUID;
  v_action TEXT;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_existing_pass
  FROM passes_master
  WHERE program_id = p_program_id 
    AND passkit_internal_id = p_passkit_internal_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE passes_master
    SET 
      external_id = COALESCE(p_external_id, external_id),
      status = COALESCE(p_status, status),
      member_email = COALESCE(p_member_email, member_email),
      member_first_name = COALESCE(p_member_first_name, member_first_name),
      member_last_name = COALESCE(p_member_last_name, member_last_name),
      last_updated = NOW()
    WHERE id = v_existing_pass.id
    RETURNING id INTO v_pass_id;

    v_action := 'UPDATED';
  ELSE
    v_pass_id := gen_random_uuid();

    INSERT INTO passes_master (
      id,
      program_id,
      passkit_internal_id,
      external_id,
      status,
      is_active,
      protocol,
      points_balance,
      spend_tier_level,
      member_email,
      member_first_name,
      member_last_name,
      enrollment_source,
      last_updated
    ) VALUES (
      v_pass_id,
      p_program_id,
      p_passkit_internal_id,
      p_external_id,
      COALESCE(p_status, 'INSTALLED'),
      true,
      'MEMBERSHIP',
      0,
      1,
      p_member_email,
      p_member_first_name,
      p_member_last_name,
      'PASSKIT_SYNC',
      NOW()
    );

    v_action := 'CREATED';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'pass_id', v_pass_id,
    'passkit_internal_id', p_passkit_internal_id,
    'external_id', p_external_id,
    'program_id', p_program_id
  );

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'DUPLICATE_PASS',
    'passkit_internal_id', p_passkit_internal_id,
    'program_id', p_program_id
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'passkit_internal_id', p_passkit_internal_id,
    'program_id', p_program_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_membership_pass_from_passkit(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_membership_pass_from_passkit(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION upsert_membership_pass_from_passkit IS 'Idempotent pass import from PassKit - NEVER overwrites existing points_balance';

-- =============================================================================
-- Function: get_sync_state_for_program
-- Get current sync state for a program, creating if not exists
-- =============================================================================
CREATE OR REPLACE FUNCTION get_sync_state_for_program(p_program_id UUID)
RETURNS passkit_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_sync_state passkit_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_sync_state
  FROM passkit_sync_state
  WHERE program_id = p_program_id;

  IF NOT FOUND THEN
    INSERT INTO passkit_sync_state (program_id)
    VALUES (p_program_id)
    RETURNING * INTO v_sync_state;
  END IF;

  RETURN v_sync_state;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sync_state_for_program(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sync_state_for_program(UUID) TO service_role;

-- =============================================================================
-- Function: update_sync_state
-- Update sync state after a sync operation
-- =============================================================================
CREATE OR REPLACE FUNCTION update_sync_state(
  p_program_id UUID,
  p_sync_type TEXT,
  p_status TEXT,
  p_cursor TEXT DEFAULT NULL,
  p_passes_synced INTEGER DEFAULT 0,
  p_error TEXT DEFAULT NULL
)
RETURNS passkit_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_sync_state passkit_sync_state%ROWTYPE;
BEGIN
  PERFORM get_sync_state_for_program(p_program_id);

  IF p_sync_type = 'FULL' THEN
    UPDATE passkit_sync_state
    SET 
      last_full_sync_at = CASE WHEN p_status IN ('SUCCESS', 'PARTIAL') THEN NOW() ELSE last_full_sync_at END,
      last_sync_status = p_status,
      last_sync_cursor = COALESCE(p_cursor, last_sync_cursor),
      total_passes_synced = total_passes_synced + p_passes_synced,
      last_sync_error = p_error,
      updated_at = NOW()
    WHERE program_id = p_program_id
    RETURNING * INTO v_sync_state;
  ELSE
    UPDATE passkit_sync_state
    SET 
      last_delta_sync_at = CASE WHEN p_status IN ('SUCCESS', 'PARTIAL') THEN NOW() ELSE last_delta_sync_at END,
      last_sync_status = p_status,
      last_sync_cursor = COALESCE(p_cursor, last_sync_cursor),
      total_passes_synced = total_passes_synced + p_passes_synced,
      last_sync_error = p_error,
      updated_at = NOW()
    WHERE program_id = p_program_id
    RETURNING * INTO v_sync_state;
  END IF;

  RETURN v_sync_state;
END;
$$;

GRANT EXECUTE ON FUNCTION update_sync_state(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_sync_state(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION update_sync_state IS 'Updates sync state after a sync operation completes';
