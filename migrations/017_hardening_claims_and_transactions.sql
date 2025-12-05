-- ============================================================================
-- Migration 017: Security Hardening for Claims and Transactions
-- ============================================================================
-- Addresses two critical security gaps:
--   Gap E: Double-Claim Vulnerability (claim codes can be used multiple times)
--   Gap F: Redemption Race Condition (concurrent redemptions can overdraw balance)
-- 
-- Strategy: Move validation logic inside the database for atomic consistency
-- ============================================================================

-- ============================================================================
-- PART 1: HARDEN CLAIM CODES (Gap E - Double-Claim Prevention)
-- ============================================================================

-- Add claimed_at timestamp to track when a claim code was burned
ALTER TABLE claim_codes 
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Create index for efficient lookups on claimed status
CREATE INDEX IF NOT EXISTS idx_claim_codes_claimed_at 
ON claim_codes(claimed_at) 
WHERE claimed_at IS NOT NULL;

-- ============================================================================
-- RPC: process_claim_attempt
-- Atomically validates and burns a claim code (one-time use guarantee)
-- ============================================================================
CREATE OR REPLACE FUNCTION process_claim_attempt(
  p_code TEXT,
  p_program_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim claim_codes%ROWTYPE;
BEGIN
  -- Lock the row to prevent concurrent scans of the same postcard
  SELECT * INTO v_claim
  FROM claim_codes
  WHERE code = p_code AND program_id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- Gap E Fix: Strict one-time-use check
  IF v_claim.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ALREADY_CLAIMED', 
      'claimed_at', v_claim.claimed_at
    );
  END IF;

  -- Burn the code immediately (mark as claimed)
  UPDATE claim_codes
  SET claimed_at = NOW()
  WHERE id = v_claim.id;

  -- Return success with claim data for pass provisioning
  RETURN jsonb_build_object(
    'success', true, 
    'data', jsonb_build_object(
      'id', v_claim.id,
      'code', v_claim.code,
      'program_id', v_claim.program_id,
      'first_name', v_claim.first_name,
      'last_name', v_claim.last_name,
      'email', v_claim.email,
      'phone', v_claim.phone,
      'points_initial', COALESCE(v_claim.points_initial, 0),
      'tier_level', v_claim.tier_level,
      'claimed_at', NOW()
    )
  );
END;
$$;

-- ============================================================================
-- PART 2: HARDEN TRANSACTIONS (Gap F - Race Condition Prevention)
-- ============================================================================

-- ============================================================================
-- RPC: process_membership_transaction_atomic
-- Race-condition-proof version of membership transactions
-- Uses atomic UPDATE with WHERE clause to prevent overdraw
-- ============================================================================
CREATE OR REPLACE FUNCTION process_membership_transaction_atomic(
  p_external_id TEXT,
  p_action TEXT,           -- 'MEMBER_EARN' or 'MEMBER_REDEEM'
  p_amount INTEGER,        -- Points to add (earn) or subtract (redeem)
  p_transaction_amount NUMERIC DEFAULT NULL  -- Currency amount for multiplier-based earning
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Get pass info with row lock to prevent concurrent updates
  SELECT * INTO v_pass
  FROM passes_master
  WHERE external_id = p_external_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'MEMBER_NOT_FOUND');
  END IF;

  -- Get program info (read lock to prevent modification during transaction)
  SELECT * INTO v_program
  FROM programs
  WHERE id = v_pass.program_id
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROGRAM_NOT_FOUND');
  END IF;

  -- Check program suspension
  IF v_program.is_suspended THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROGRAM_SUSPENDED');
  END IF;

  v_previous_balance := COALESCE(v_pass.points_balance, 0);
  v_multiplier := COALESCE(v_program.earn_rate_multiplier, 10);

  -- Calculate points based on transaction amount or direct points
  IF p_transaction_amount IS NOT NULL AND p_action = 'MEMBER_EARN' THEN
    v_points_to_process := FLOOR(p_transaction_amount * v_multiplier)::INTEGER;
  ELSE
    v_points_to_process := COALESCE(p_amount, 0);
  END IF;

  IF v_points_to_process <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  -- Generate transaction ID
  v_transaction_id := gen_random_uuid();

  -- PROCESS BASED ON ACTION TYPE
  IF p_action = 'MEMBER_EARN' THEN
    -- Earn is always safe - just add points
    UPDATE passes_master
    SET 
      points_balance = points_balance + v_points_to_process,
      updated_at = NOW()
    WHERE id = v_pass.id
    RETURNING points_balance INTO v_new_balance;

    IF p_transaction_amount IS NOT NULL THEN
      v_notification_message := 'Earned ' || v_points_to_process || ' points for $' || ROUND(p_transaction_amount::NUMERIC, 2) || ' purchase';
    ELSE
      v_notification_message := 'Earned ' || v_points_to_process || ' points';
    END IF;

  ELSIF p_action = 'MEMBER_REDEEM' THEN
    -- GAP F FIX: Atomic Update with balance check
    -- Only update IF points are sufficient - prevents race conditions
    UPDATE passes_master
    SET 
      points_balance = points_balance - v_points_to_process,
      updated_at = NOW()
    WHERE id = v_pass.id 
      AND points_balance >= v_points_to_process
    RETURNING points_balance INTO v_new_balance;

    -- If no row was updated, balance was insufficient
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
    -- Adjustment can go positive or negative
    UPDATE passes_master
    SET 
      points_balance = GREATEST(0, points_balance + v_points_to_process),
      updated_at = NOW()
    WHERE id = v_pass.id
    RETURNING points_balance INTO v_new_balance;

    v_notification_message := 'Adjusted by ' || v_points_to_process || ' points';

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION');
  END IF;

  -- Log transaction (if transactions table exists)
  BEGIN
    INSERT INTO pos_transactions (
      id,
      program_id,
      external_id,
      action,
      points,
      previous_balance,
      new_balance,
      transaction_amount,
      multiplier_used,
      description,
      created_at
    ) VALUES (
      v_transaction_id,
      v_pass.program_id,
      p_external_id,
      p_action,
      v_points_to_process,
      v_previous_balance,
      v_new_balance,
      p_transaction_amount,
      CASE WHEN p_transaction_amount IS NOT NULL THEN v_multiplier ELSE NULL END,
      v_notification_message,
      NOW()
    );
  EXCEPTION WHEN undefined_table THEN
    -- pos_transactions table doesn't exist, skip logging
    NULL;
  END;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance,
    'points_processed', v_points_to_process,
    'transaction_amount', p_transaction_amount,
    'multiplier_used', CASE WHEN p_transaction_amount IS NOT NULL THEN v_multiplier ELSE NULL END,
    'notification_message', v_notification_message,
    'passkit_internal_id', v_pass.passkit_internal_id,
    'passkit_program_id', v_program.passkit_program_id,
    'member_name', COALESCE(v_pass.member_first_name, '') || ' ' || COALESCE(v_pass.member_last_name, ''),
    'tier_level', v_pass.tier_level
  );
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION process_claim_attempt(TEXT, UUID) IS 
  'Atomically validates and burns a claim code. Returns ALREADY_CLAIMED if code was previously used. (Gap E Fix)';

COMMENT ON FUNCTION process_membership_transaction_atomic(TEXT, TEXT, INTEGER, NUMERIC) IS 
  'Race-condition-proof membership transaction. Prevents overdraw via atomic UPDATE with WHERE clause. (Gap F Fix)';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION process_claim_attempt(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_claim_attempt(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION process_membership_transaction_atomic(TEXT, TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION process_membership_transaction_atomic(TEXT, TEXT, INTEGER, NUMERIC) TO service_role;
