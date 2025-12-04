-- =====================================================
-- Phygital Loyalty: Test Data Seed Script
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. First, check if tables exist (if not, you'll need to run the schema setup first)
-- This script assumes the following tables already exist:
--   - programs
--   - admin_profiles  
--   - passes_master

-- =====================================================
-- STEP 1: Create a Test Program
-- =====================================================

-- Insert a test loyalty program
INSERT INTO programs (
    id,
    name,
    passkit_program_id,
    passkit_tier_id,
    protocol,
    is_suspended,
    birthday_message,
    created_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Demo Pizza Rewards',
    'pk_demo_pizza_123',
    'tier_gold_pizza',
    'MEMBERSHIP',
    false,
    'Happy Birthday! Enjoy a FREE personal pizza on us!',
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    passkit_program_id = EXCLUDED.passkit_program_id;

-- Verify program was created
SELECT 'Program created:' as step, id, name FROM programs WHERE id = '11111111-1111-1111-1111-111111111111';

-- =====================================================
-- STEP 2: Link Your Supabase User to the Program
-- =====================================================

-- IMPORTANT: Replace 'YOUR_SUPABASE_USER_ID' with your actual user ID
-- You can find this in Supabase Dashboard > Authentication > Users
-- Or run: SELECT id, email FROM auth.users;

-- First, let's see what users exist in the auth system
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- After identifying your user ID, run this INSERT:
-- (Uncomment and replace the placeholder with your actual user ID)

/*
INSERT INTO admin_profiles (
    id,
    role,
    program_id,
    created_at
) VALUES (
    'YOUR_SUPABASE_USER_ID',  -- Replace with your auth.users.id
    'CLIENT_ADMIN',
    '11111111-1111-1111-1111-111111111111',
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    program_id = EXCLUDED.program_id,
    role = EXCLUDED.role;
*/

-- =====================================================
-- STEP 3: Create Test Members (Passes)
-- =====================================================

-- Insert some test members into passes_master
INSERT INTO passes_master (
    id,
    program_id,
    external_id,
    status,
    is_active,
    points_balance,
    tier_name,
    enrollment_source,
    member_email,
    member_first_name,
    member_last_name,
    member_phone,
    created_at,
    last_updated
) VALUES 
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'PUB-member001',
    'INSTALLED',
    true,
    1250,
    'Gold',
    'SMARTPASS',
    'john.doe@example.com',
    'John',
    'Doe',
    '+15551234567',
    NOW() - INTERVAL '30 days',
    NOW()
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'CLM-member002',
    'INSTALLED',
    true,
    875,
    'Silver',
    'CLAIM_CODE',
    'jane.smith@example.com',
    'Jane',
    'Smith',
    '+15559876543',
    NOW() - INTERVAL '20 days',
    NOW()
),
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'CSV-member003',
    'INSTALLED',
    true,
    2100,
    'Platinum',
    'CSV',
    'mike.johnson@example.com',
    'Mike',
    'Johnson',
    NULL,
    NOW() - INTERVAL '60 days',
    NOW()
),
(
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    'PUB-member004',
    'UNINSTALLED',
    false,
    450,
    'Bronze',
    'SMARTPASS',
    'sarah.williams@example.com',
    'Sarah',
    'Williams',
    '+15555551234',
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '10 days'
),
(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111',
    'CLM-member005',
    'INSTALLED',
    true,
    3200,
    'Platinum',
    'CLAIM_CODE',
    'david.brown@example.com',
    'David',
    'Brown',
    '+15557778899',
    NOW() - INTERVAL '120 days',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    points_balance = EXCLUDED.points_balance,
    tier_name = EXCLUDED.tier_name,
    last_updated = NOW();

-- =====================================================
-- STEP 4: Verify Data
-- =====================================================

-- Check the program
SELECT '=== Program ===' as section;
SELECT id, name, protocol, is_suspended FROM programs WHERE id = '11111111-1111-1111-1111-111111111111';

-- Check admin profiles
SELECT '=== Admin Profiles ===' as section;
SELECT id, role, program_id FROM admin_profiles LIMIT 5;

-- Check members
SELECT '=== Members ===' as section;
SELECT 
    external_id, 
    member_first_name || ' ' || member_last_name as full_name,
    member_email,
    points_balance,
    tier_name,
    status,
    enrollment_source
FROM passes_master 
WHERE program_id = '11111111-1111-1111-1111-111111111111'
ORDER BY created_at DESC;

-- Summary stats
SELECT '=== Summary ===' as section;
SELECT 
    COUNT(*) as total_members,
    COUNT(*) FILTER (WHERE status = 'INSTALLED') as active_members,
    COUNT(*) FILTER (WHERE status = 'UNINSTALLED') as churned_members,
    SUM(points_balance) as total_points
FROM passes_master 
WHERE program_id = '11111111-1111-1111-1111-111111111111';
