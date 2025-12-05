-- Migration 015: Earn Rate Multiplier for Point System
-- Purpose: Implement the "Casino Chip" model for integer-based loyalty points
-- The multiplier converts transaction amounts to integer points
-- Default multiplier of 10 means: $12.50 spend = 125 points (floor(12.50 * 10))

-- ============================================
-- STEP 1: ADD earn_rate_multiplier COLUMN
-- ============================================

-- Add the multiplier column to programs table
-- Default 10 = standard US/UK/EU model (1 dollar = 10 points)
-- Adjustable per program: 1, 10, 100 for different currency/psychological needs
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS earn_rate_multiplier INTEGER NOT NULL DEFAULT 10;

-- Add index for potential filtering by multiplier
CREATE INDEX IF NOT EXISTS idx_programs_earn_multiplier 
ON programs(earn_rate_multiplier);

-- ============================================
-- STEP 2: UPDATE PROCESS_MEMBERSHIP_TRANSACTION RPC
-- ============================================
-- The RPC now accepts EITHER:
--   - p_amount (integer) for direct point manipulation (backward compatible)
--   - p_transaction_amount (numeric) for currency-based earning with multiplier

CREATE OR REPLACE FUNCTION process_membership_transaction(
    p_external_id TEXT,
    p_action TEXT,
    p_amount INTEGER DEFAULT 0,
    p_transaction_amount NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pass RECORD;
    v_program RECORD;
    v_new_balance INTEGER;
    v_previous_balance INTEGER;
    v_transaction_id UUID;
    v_points_to_process INTEGER;
    v_multiplier INTEGER;
BEGIN
    -- Look up pass by external_id with program join for multiplier
    SELECT 
        pm.*,
        p.id as prog_id,
        p.name as prog_name,
        p.earn_rate_multiplier,
        p.passkit_program_id,
        p.is_suspended
    INTO v_pass
    FROM passes_master pm
    JOIN programs p ON pm.program_id = p.id
    WHERE pm.external_id = p_external_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Pass not found',
            'notification_message', 'Error: Pass not found'
        );
    END IF;

    -- Check if program is suspended
    IF v_pass.is_suspended THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Program is suspended',
            'notification_message', 'Error: Program Suspended. Contact Admin.'
        );
    END IF;
    
    v_previous_balance := COALESCE(v_pass.points_balance, 0);
    v_multiplier := COALESCE(v_pass.earn_rate_multiplier, 10);
    
    -- Calculate points based on input type
    IF p_transaction_amount IS NOT NULL AND p_action = 'MEMBER_EARN' THEN
        -- Currency-based earning: Apply multiplier and floor
        v_points_to_process := FLOOR(p_transaction_amount * v_multiplier)::INTEGER;
    ELSE
        -- Direct point manipulation (backward compatible)
        v_points_to_process := COALESCE(p_amount, 0);
    END IF;
    
    -- Calculate new balance based on action
    CASE p_action
        WHEN 'MEMBER_EARN' THEN
            v_new_balance := v_previous_balance + v_points_to_process;
        WHEN 'MEMBER_REDEEM' THEN
            IF v_previous_balance < v_points_to_process THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Insufficient balance',
                    'notification_message', 'Error: Insufficient points. Balance: ' || v_previous_balance,
                    'current_balance', v_previous_balance,
                    'requested_points', v_points_to_process
                );
            END IF;
            v_new_balance := v_previous_balance - v_points_to_process;
        WHEN 'MEMBER_ADJUST' THEN
            -- Adjust sets absolute balance (p_amount is the new balance)
            v_new_balance := v_points_to_process;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid action type',
                'notification_message', 'Error: Invalid action'
            );
    END CASE;
    
    -- Update pass balance
    UPDATE passes_master 
    SET 
        points_balance = v_new_balance, 
        last_updated = NOW()
    WHERE id = v_pass.id;
    
    -- Insert transaction record
    INSERT INTO transactions (
        pass_id, 
        program_id,
        action_type, 
        value_change, 
        balance_after,
        transaction_amount,
        earn_multiplier_used,
        notes
    )
    VALUES (
        v_pass.id, 
        v_pass.prog_id,
        p_action, 
        v_points_to_process, 
        v_new_balance,
        p_transaction_amount,
        CASE WHEN p_transaction_amount IS NOT NULL THEN v_multiplier ELSE NULL END,
        CASE 
            WHEN p_transaction_amount IS NOT NULL THEN 
                'Spend: ' || p_transaction_amount || ' x' || v_multiplier || ' = ' || v_points_to_process || ' points'
            ELSE
                p_action || ': ' || v_points_to_process || ' points'
        END
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_balance', v_new_balance,
        'previous_balance', v_previous_balance,
        'points_processed', v_points_to_process,
        'transaction_amount', p_transaction_amount,
        'multiplier_used', v_multiplier,
        'notification_message', 
            CASE p_action
                WHEN 'MEMBER_EARN' THEN 
                    CASE WHEN p_transaction_amount IS NOT NULL THEN
                        'Earned ' || v_points_to_process || ' points for $' || ROUND(p_transaction_amount::NUMERIC, 2) || ' purchase'
                    ELSE
                        'Earned ' || v_points_to_process || ' points'
                    END
                WHEN 'MEMBER_REDEEM' THEN 'Redeemed ' || v_points_to_process || ' points'
                WHEN 'MEMBER_ADJUST' THEN 'Balance adjusted to ' || v_new_balance || ' points'
            END,
        'passkit_internal_id', v_pass.passkit_internal_id,
        'passkit_program_id', v_pass.passkit_program_id,
        'member_name', COALESCE(v_pass.first_name || ' ' || v_pass.last_name, 'Member'),
        'program_name', v_pass.prog_name
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: ADD TRANSACTION COLUMNS FOR AUDIT
-- ============================================
-- Track the original transaction amount and multiplier used

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_amount NUMERIC(12,2);

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS earn_multiplier_used INTEGER;

-- ============================================
-- STEP 4: COMMON MULTIPLIER PRESETS REFERENCE
-- ============================================
-- Use this as a guide when configuring earn_rate_multiplier:
--
-- MULTIPLIER  | USE CASE                           | EXAMPLE
-- ------------|------------------------------------|-----------------------
-- 1           | Japan (Yen), Direct 1:1            | 1000 JPY = 1000 pts
-- 10          | US/UK/EU (Default, Psychological)  | $12.50 = 125 pts
-- 100         | Middle East (3 decimals), Premium  | 12.500 AED = 1250 pts
-- 0.1         | Japan simplified                   | 1000 JPY = 100 pts
--
-- Psychology: Higher point numbers feel more rewarding
-- "125 VIP Points" feels better than "12.5 Points"

-- ============================================
-- STEP 5: VERIFY MIGRATION
-- ============================================
-- Run these queries to verify the migration succeeded:

-- Check column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'programs' 
AND column_name = 'earn_rate_multiplier';

-- Check function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'process_membership_transaction';

-- Verify existing programs got default multiplier
SELECT id, name, earn_rate_multiplier 
FROM programs 
LIMIT 5;

COMMENT ON COLUMN programs.earn_rate_multiplier IS 'Point multiplier for currency conversion. Default 10 = $1.00 earns 10 points. Configurable per program.';
COMMENT ON COLUMN transactions.transaction_amount IS 'Original currency amount of the transaction (if applicable)';
COMMENT ON COLUMN transactions.earn_multiplier_used IS 'The multiplier applied at time of transaction for audit trail';
