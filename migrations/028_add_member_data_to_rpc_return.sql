-- ============================================================================
-- Migration 028: Add Member Data to RPC Return
-- ============================================================================
-- Issue: PassKit API requires person.emailAddress, person.forename, person.surname
-- for successful PUT /members/member updates when data collection is enabled.
-- 
-- Fix: Add member_email, member_first_name, member_last_name, and external_id
-- to the process_membership_transaction_atomic return JSON.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_membership_transaction_atomic(
  p_external_id TEXT,
  p_action TEXT,
  p_amount INTEGER,
  p_transaction_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_pass passes_master%ROWTYPE;
  v_program programs%ROWTYPE;
  v_previous_balance INTEGER;
  v_new_balance INTEGER;
  v_points_to_process INTEGER;
  v_multiplier INTEGER;
  v_transaction_id UUID;
  v_notification_message TEXT;
BEGIN
  SELECT * INTO v_pass
  FROM passes_master
  WHERE external_id = p_external_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  SELECT * INTO v_program
  FROM programs
  WHERE id = v_pass.program_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROGRAM_NOT_FOUND');
  END IF;

  IF v_program.is_suspended THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROGRAM_SUSPENDED');
  END IF;

  v_previous_balance := COALESCE(v_pass.points_balance, 0);
  v_multiplier := COALESCE(v_program.earn_rate_multiplier, 10);

  IF p_transaction_amount IS NOT NULL AND p_action = 'MEMBER_EARN' THEN
    v_points_to_process := FLOOR(p_transaction_amount * v_multiplier)::INTEGER;
  ELSE
    v_points_to_process := COALESCE(p_amount, 0);
  END IF;

  IF v_points_to_process <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  v_transaction_id := gen_random_uuid();

  IF p_action = 'MEMBER_EARN' THEN
    UPDATE passes_master
    SET points_balance = points_balance + v_points_to_process
    WHERE id = v_pass.id
    RETURNING points_balance INTO v_new_balance;

    v_notification_message := 'Earned ' || v_points_to_process || ' points';

  ELSIF p_action = 'MEMBER_REDEEM' THEN
    UPDATE passes_master
    SET points_balance = points_balance - v_points_to_process
    WHERE id = v_pass.id AND points_balance >= v_points_to_process
    RETURNING points_balance INTO v_new_balance;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_FUNDS',
        'available_balance', v_previous_balance,
        'requested_amount', v_points_to_process
      );
    END IF;

    v_notification_message := 'Redeemed ' || v_points_to_process || ' points';

  ELSIF p_action = 'MEMBER_ADJUST' THEN
    UPDATE passes_master
    SET points_balance = GREATEST(0, points_balance + v_points_to_process)
    WHERE id = v_pass.id
    RETURNING points_balance INTO v_new_balance;

    v_notification_message := 'Adjusted by ' || v_points_to_process || ' points';

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance,
    'points_processed', v_points_to_process,
    'notification_message', v_notification_message,
    'passkit_internal_id', v_pass.passkit_internal_id,
    'passkit_program_id', v_program.passkit_program_id,
    'member_name', COALESCE(v_pass.member_first_name, '') || ' ' || COALESCE(v_pass.member_last_name, ''),
    'tier_level', v_pass.spend_tier_level,
    'member_email', v_pass.member_email,
    'member_first_name', v_pass.member_first_name,
    'member_last_name', v_pass.member_last_name,
    'external_id', v_pass.external_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_membership_transaction_atomic(TEXT, TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION process_membership_transaction_atomic(TEXT, TEXT, INTEGER, NUMERIC) TO service_role;
