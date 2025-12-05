# Security Validation Protocol

## Overview

This document describes security tests to verify the Row Level Security (RLS) policies are correctly configured. **These tests MUST be run in Supabase Studio or browser console** to validate production security.

---

## Protocol D: The Security Tunnel

### Objective
Prove that a hacker with the `SUPABASE_ANON_KEY` cannot steal your customer list, but can still fetch public enrollment pages.

### Prerequisites
1. Migration `012_secure_public_access.sql` applied to your Supabase database
2. Your `SUPABASE_URL` and `SUPABASE_ANON_KEY` values

---

## Test 1: The Hack (Should FAIL)

This test attempts to download all programs using the anonymous key. **This MUST fail.**

### Using Supabase SQL Editor

```sql
-- Run this as 'anon' role
SET ROLE anon;

-- Attempt to read all programs (should return empty or error)
SELECT * FROM programs;
```

**Expected Result:** Empty result set or RLS policy violation error (code 42501).

### Using Browser Console

```javascript
// Run this in your browser console on the /login page
const { createClient } = await import('https://esm.sh/@supabase/supabase-js');
const sb = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY');

// Hacker tries to download all programs
const { data, error } = await sb.from('programs').select('*');
console.log('Data:', data);
console.log('Error:', error); 
```

**Expected Result:** 
- `error` object present with code `42501` (Row Level Security Policy Violation)
- OR `data` is empty array `[]`
- **FAIL if data contains program records**

---

## Test 2: The Feature (Should SUCCEED)

This test uses the public RPC function to fetch enrollment info. **This MUST succeed.**

### Using Supabase SQL Editor

```sql
-- Run this as 'anon' role
SET ROLE anon;

-- Valid user loading enrollment page (should work)
SELECT * FROM get_public_program_info('your-dashboard-slug');
```

**Expected Result:** Returns `{ name: "...", enrollment_url: "..." }` without internal IDs or secrets.

### Using Browser Console

```javascript
const { createClient } = await import('https://esm.sh/@supabase/supabase-js');
const sb = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY');

// Valid public lookup
const { data, error } = await sb.rpc('get_public_program_info', { lookup_slug: 'your-dashboard-slug' });
console.log('Data:', data);
console.log('Error:', error);
```

**Expected Result:**
- `data` contains `{ name: "...", enrollment_url: "..." }`
- Does NOT contain: `id`, `passkit_program_id`, `passkit_tier_id`, or any secrets
- **FAIL if data contains internal IDs**

---

## Test 3: Table Access Audit

Run these queries to verify all tables have RLS enabled:

```sql
-- Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Result:** All tables should show `rowsecurity = true`.

---

## Test 4: Direct Table Access (Should FAIL)

Test that anon role cannot access any data tables directly:

```sql
SET ROLE anon;

-- Each of these should return empty or error
SELECT * FROM programs LIMIT 1;
SELECT * FROM passes_master LIMIT 1;
SELECT * FROM users LIMIT 1;
SELECT * FROM transactions LIMIT 1;
SELECT * FROM pos_api_keys LIMIT 1;
```

**Expected Result:** All queries return empty or RLS error.

---

## Summary Checklist

| Test | Expected | Pass Criteria |
|------|----------|---------------|
| Test 1: Direct SELECT | FAIL | Empty data OR error 42501 |
| Test 2: RPC Function | SUCCESS | Returns name/URL only |
| Test 3: RLS Enabled | All TRUE | rowsecurity = true for all tables |
| Test 4: Direct Access | FAIL | Empty data OR error for each table |

---

## Remediation

If any test fails unexpectedly:

1. **Apply migration 012**: 
   ```sql
   -- Run migrations/012_secure_public_access.sql in Supabase SQL Editor
   ```

2. **Verify RLS policies exist**:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```

3. **Contact support**: support@passtovip.com

---

## Security Best Practices

1. **Never expose SERVICE_ROLE_KEY** - Only use ANON_KEY on frontend
2. **Audit RLS regularly** - Run these tests monthly
3. **Monitor failed queries** - Check Supabase logs for suspicious access patterns
4. **Rotate secrets** - If SERVICE_ROLE_KEY is ever exposed, rotate immediately
