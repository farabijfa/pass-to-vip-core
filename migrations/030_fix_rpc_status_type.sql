-- Migration 030: Fix RPC status type casting
-- Problem: COALESCE(p_status, status) fails because p_status is TEXT and status is pass_status enum
-- Solution: Cast p_status to pass_status enum type

DROP FUNCTION IF EXISTS upsert_membership_pass_from_passkit(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

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
AS $fn$
DECLARE
  v_existing_pass passes_master%ROWTYPE;
  v_pass_id UUID;
  v_action TEXT;
  v_status_enum pass_status;
BEGIN
  -- Cast text status to enum, default to INSTALLED if invalid
  BEGIN
    v_status_enum := p_status::pass_status;
  EXCEPTION WHEN OTHERS THEN
    v_status_enum := 'INSTALLED'::pass_status;
  END;

  -- Lock the row if it exists
  SELECT * INTO v_existing_pass
  FROM passes_master
  WHERE program_id = p_program_id 
    AND passkit_internal_id = p_passkit_internal_id
  FOR UPDATE;

  IF FOUND THEN
    -- UPDATE: Set is_active=true and protocol='MEMBERSHIP'
    UPDATE passes_master
    SET 
      external_id = COALESCE(p_external_id, external_id),
      status = COALESCE(v_status_enum, status),
      is_active = true,
      protocol = 'MEMBERSHIP',
      member_email = COALESCE(p_member_email, member_email),
      member_first_name = COALESCE(p_member_first_name, member_first_name),
      member_last_name = COALESCE(p_member_last_name, member_last_name),
      last_updated = NOW()
    WHERE id = v_existing_pass.id
    RETURNING id INTO v_pass_id;

    v_action := 'UPDATED';
  ELSE
    -- INSERT: Create new pass with all required fields
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
      COALESCE(v_status_enum, 'INSTALLED'::pass_status),
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
    'program_id', p_program_id,
    'member_email', p_member_email,
    'member_first_name', p_member_first_name,
    'member_last_name', p_member_last_name
  );

EXCEPTION 
  WHEN unique_violation THEN
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
$fn$;

GRANT EXECUTE ON FUNCTION upsert_membership_pass_from_passkit TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_membership_pass_from_passkit TO service_role;
