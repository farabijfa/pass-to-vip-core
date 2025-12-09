-- ============================================================================
-- Migration 028: Fix PassKit Sync Enum Type Cast
-- ============================================================================
-- Purpose: Fix the upsert_membership_pass_from_passkit function to properly
-- cast text status parameter to the pass_status enum type
-- ============================================================================

-- Drop and recreate the function with proper enum casting
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
  v_status_enum pass_status;
BEGIN
  -- Cast the text status to the pass_status enum
  v_status_enum := COALESCE(p_status, 'INSTALLED')::pass_status;

  SELECT * INTO v_existing_pass
  FROM passes_master
  WHERE program_id = p_program_id 
    AND passkit_internal_id = p_passkit_internal_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE passes_master
    SET 
      external_id = COALESCE(p_external_id, external_id),
      status = v_status_enum,
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
      v_status_enum,
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

COMMENT ON FUNCTION upsert_membership_pass_from_passkit IS 'Idempotent pass import from PassKit - NEVER overwrites existing points_balance. Fixed enum casting in v028.';
