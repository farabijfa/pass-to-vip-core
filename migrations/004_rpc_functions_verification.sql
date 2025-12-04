-- Migration 004: RPC Functions Verification & Creation Checklist
-- Purpose: Verify all required Supabase RPC functions exist
-- Run this in Supabase Studio > SQL Editor

-- ============================================
-- STEP 1: CHECK WHICH FUNCTIONS EXIST
-- ============================================

SELECT 
    routine_name as function_name,
    CASE 
        WHEN routine_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_name IN (
    'process_membership_transaction',
    'process_one_time_use', 
    'generate_claim_code',
    'lookup_claim_code',
    'update_claim_code_status',
    'get_member_balance',
    'get_member_transaction_history',
    'get_service_status'
)
ORDER BY routine_name;

-- ============================================
-- STEP 2: REQUIRED RPC FUNCTION SIGNATURES
-- ============================================
-- Your Replit backend expects these exact function signatures.
-- 
-- IMPORTANT: There are TWO calling patterns in the codebase:
--   A) POS Actions (logic.service.ts) - Uses p_external_id, p_action, p_amount
--   B) Legacy Loyalty (supabase.service.ts) - Uses p_member_id, p_transaction_type, p_points
--
-- The POS pattern (A) is primary. Templates below match the POS service.

-- ============================================
-- Function: process_membership_transaction
-- Called by: logic.service.ts (POS actions)
-- Actions: MEMBER_EARN, MEMBER_REDEEM, MEMBER_ADJUST
-- ============================================
/*
CREATE OR REPLACE FUNCTION process_membership_transaction(
    p_external_id TEXT,
    p_action TEXT,
    p_amount INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_pass RECORD;
    v_new_balance INTEGER;
    v_previous_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Look up pass by external_id
    SELECT * INTO v_pass FROM passes_master WHERE external_id = p_external_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Pass not found',
            'notification_message', 'Error: Pass not found'
        );
    END IF;
    
    v_previous_balance := COALESCE(v_pass.points_balance, 0);
    
    -- Calculate new balance based on action
    CASE p_action
        WHEN 'MEMBER_EARN' THEN
            v_new_balance := v_previous_balance + p_amount;
        WHEN 'MEMBER_REDEEM' THEN
            IF v_previous_balance < p_amount THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Insufficient balance',
                    'notification_message', 'Error: Insufficient points'
                );
            END IF;
            v_new_balance := v_previous_balance - p_amount;
        WHEN 'MEMBER_ADJUST' THEN
            v_new_balance := p_amount;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid action type',
                'notification_message', 'Error: Invalid action'
            );
    END CASE;
    
    -- Update pass balance
    UPDATE passes_master 
    SET points_balance = v_new_balance, last_updated = NOW()
    WHERE id = v_pass.id;
    
    -- Insert transaction record
    INSERT INTO transactions (pass_id, action_type, value_change, balance_after)
    VALUES (v_pass.id, p_action, p_amount, v_new_balance)
    RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_balance', v_new_balance,
        'previous_balance', v_previous_balance,
        'notification_message', p_action || ' processed: ' || p_amount || ' points',
        'passkit_internal_id', v_pass.passkit_internal_id
    );
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================
-- Function: process_one_time_use
-- Called by: logic.service.ts (POS actions)
-- Actions: COUPON_ISSUE, COUPON_REDEEM, TICKET_CHECKIN
-- ============================================
/*
CREATE OR REPLACE FUNCTION process_one_time_use(
    p_external_id TEXT,
    p_action TEXT
) RETURNS JSONB AS $$
DECLARE
    v_pass RECORD;
    v_transaction_id UUID;
BEGIN
    SELECT * INTO v_pass FROM passes_master WHERE external_id = p_external_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pass not found',
            'notification_message', 'Error: Pass not found'
        );
    END IF;
    
    -- For ticket check-in or coupon redemption, mark as used
    IF p_action IN ('TICKET_CHECKIN', 'COUPON_REDEEM') THEN
        IF v_pass.status = 'VOIDED' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Pass already used',
                'notification_message', 'Error: This pass has already been used'
            );
        END IF;
        
        UPDATE passes_master 
        SET status = 'VOIDED', last_updated = NOW()
        WHERE id = v_pass.id;
    END IF;
    
    -- Insert transaction record
    INSERT INTO transactions (pass_id, action_type, value_change, notes)
    VALUES (v_pass.id, p_action, 0, 'One-time use: ' || p_action)
    RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'notification_message', p_action || ' processed successfully',
        'passkit_internal_id', v_pass.passkit_internal_id
    );
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================
-- Function: generate_claim_code
-- Called by: campaign.service.ts
-- Purpose: Create unique claim codes for physical mail campaigns
-- ============================================
/*
CREATE OR REPLACE FUNCTION generate_claim_code(
    p_passkit_program_id TEXT,
    p_first_name TEXT,
    p_last_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_address_line_1 TEXT DEFAULT NULL,
    p_address_line_2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_postal_code TEXT DEFAULT NULL,
    p_country TEXT DEFAULT 'US'
) RETURNS JSONB AS $$
DECLARE
    v_claim_code TEXT;
BEGIN
    -- Generate unique claim code (MAIL-XXXXXX format)
    v_claim_code := 'MAIL-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Insert claim code record
    INSERT INTO claim_codes (
        claim_code, 
        passkit_program_id, 
        first_name, 
        last_name, 
        email,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country,
        status
    ) VALUES (
        v_claim_code,
        p_passkit_program_id,
        p_first_name,
        p_last_name,
        p_email,
        p_address_line_1,
        p_address_line_2,
        p_city,
        p_state,
        p_postal_code,
        p_country,
        'PENDING'
    );
    
    RETURN jsonb_build_object('claim_code', v_claim_code);
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================
-- Function: lookup_claim_code
-- Called by: claim.controller.ts
-- Purpose: Look up claim code details for Physical Bridge
-- ============================================
/*
CREATE OR REPLACE FUNCTION lookup_claim_code(
    p_claim_code TEXT
) RETURNS JSONB AS $$
DECLARE
    v_claim RECORD;
BEGIN
    SELECT * INTO v_claim FROM claim_codes WHERE claim_code = p_claim_code;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    RETURN jsonb_build_object(
        'claim_code', v_claim.claim_code,
        'status', v_claim.status,
        'passkit_program_id', v_claim.passkit_program_id,
        'passkit_install_url', v_claim.passkit_install_url,
        'first_name', v_claim.first_name,
        'last_name', v_claim.last_name,
        'email', v_claim.email,
        'created_at', v_claim.created_at,
        'installed_at', v_claim.installed_at
    );
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================
-- Function: update_claim_code_status
-- Called by: claim.controller.ts
-- Purpose: Update claim code after wallet installation
-- ============================================
/*
CREATE OR REPLACE FUNCTION update_claim_code_status(
    p_claim_code TEXT,
    p_status TEXT,
    p_passkit_install_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE claim_codes 
    SET 
        status = p_status,
        passkit_install_url = COALESCE(p_passkit_install_url, passkit_install_url),
        installed_at = CASE WHEN p_status = 'INSTALLED' THEN NOW() ELSE installed_at END
    WHERE claim_code = p_claim_code;
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================
-- Function: get_service_status (OPTIONAL)
-- Called by: Health check endpoint
-- Purpose: Verify Supabase connectivity
-- ============================================
/*
CREATE OR REPLACE FUNCTION get_service_status()
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'status', 'healthy',
        'timestamp', NOW(),
        'version', '1.0.0'
    );
END;
$$ LANGUAGE plpgsql;
*/

-- ============================================
-- STEP 3: VERIFY ALL FUNCTIONS AFTER CREATION
-- ============================================
-- Run this again after creating functions to confirm:

SELECT 
    routine_name as function_name,
    'EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_name IN (
    'process_membership_transaction',
    'process_one_time_use', 
    'generate_claim_code',
    'lookup_claim_code',
    'update_claim_code_status',
    'get_service_status'
)
ORDER BY routine_name;
