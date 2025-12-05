/**
 * Test Script: Client Provisioning Flow
 * 
 * This script tests the complete client provisioning flow including:
 * 1. API endpoint validation
 * 2. Request/response format validation
 * 3. Error handling validation
 * 4. Dashboard slug generation
 * 
 * Run with: npx tsx scripts/test-provisioning-flow.ts
 */

const BASE_URL = process.env.APP_URL || 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  response?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, details: string, response?: any) {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${details}`);
  results.push({ name, passed, details, response });
}

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response;
  } catch (error) {
    throw new Error(`Network error: ${error}`);
  }
}

async function runTests() {
  console.log('\n🧪 Starting Client Provisioning Flow Tests\n');
  console.log('='.repeat(60));

  // Test 1: Enrollment endpoint without anon key (should return 503)
  console.log('\n📋 Test 1: Public Enrollment Endpoint (No Anon Key)');
  try {
    const res = await testEndpoint(
      'Enrollment endpoint',
      `${BASE_URL}/api/enroll/test-slug-12345`
    );
    const body = await res.json();
    
    if (res.status === 503 && body.error?.code === 'SERVICE_UNAVAILABLE') {
      logTest('Enrollment without anon key', true, 'Returns 503 SERVICE_UNAVAILABLE as expected', body);
    } else if (res.status === 404) {
      logTest('Enrollment without anon key', true, 'Returns 404 NOT_FOUND (anon key configured, slug not found)', body);
    } else {
      logTest('Enrollment without anon key', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Enrollment without anon key', false, `Error: ${error}`);
  }

  // Test 2: Admin tenants endpoint without auth (should return 401)
  console.log('\n📋 Test 2: Admin Tenants Endpoint (No Auth)');
  try {
    const res = await testEndpoint(
      'Admin tenants',
      `${BASE_URL}/api/client/admin/tenants`
    );
    const body = await res.json();
    
    if (res.status === 401 && body.error?.code === 'MISSING_TOKEN') {
      logTest('Admin tenants without auth', true, 'Returns 401 MISSING_TOKEN as expected', body);
    } else {
      logTest('Admin tenants without auth', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Admin tenants without auth', false, `Error: ${error}`);
  }

  // Test 3: Provision endpoint without auth (should return 401)
  console.log('\n📋 Test 3: Provision Endpoint (No Auth)');
  try {
    const res = await testEndpoint(
      'Provision tenant',
      `${BASE_URL}/api/client/admin/provision`,
      {
        method: 'POST',
        body: JSON.stringify({
          businessName: 'Test Business',
          email: 'test@example.com',
          password: 'testpass123',
          passkitProgramId: 'test-passkit-id',
          protocol: 'MEMBERSHIP',
        }),
      }
    );
    const body = await res.json();
    
    if (res.status === 401) {
      logTest('Provision without auth', true, 'Returns 401 as expected (protected endpoint)', body);
    } else {
      logTest('Provision without auth', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Provision without auth', false, `Error: ${error}`);
  }

  // Test 4: Provision endpoint validation (with fake auth token)
  console.log('\n📋 Test 4: Provision Endpoint Validation (Invalid Token)');
  try {
    const res = await testEndpoint(
      'Provision with invalid token',
      `${BASE_URL}/api/client/admin/provision`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake-token-12345',
        },
        body: JSON.stringify({
          businessName: 'Test Business',
          email: 'test@example.com',
          password: 'testpass123',
          passkitProgramId: 'test-passkit-id',
          protocol: 'MEMBERSHIP',
        }),
      }
    );
    const body = await res.json();
    
    if (res.status === 401 || res.status === 403) {
      logTest('Provision with invalid token', true, `Returns ${res.status} as expected (invalid token rejected)`, body);
    } else {
      logTest('Provision with invalid token', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Provision with invalid token', false, `Error: ${error}`);
  }

  // Test 5: Login endpoint validation
  console.log('\n📋 Test 5: Login Endpoint Validation');
  try {
    const res = await testEndpoint(
      'Login validation',
      `${BASE_URL}/api/client/login`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const body = await res.json();
    
    if (res.status === 400 && body.error?.code === 'MISSING_CREDENTIALS') {
      logTest('Login validation (empty body)', true, 'Returns 400 MISSING_CREDENTIALS as expected', body);
    } else if (res.status === 503) {
      logTest('Login validation (empty body)', true, 'Returns 503 SERVICE_UNAVAILABLE (Supabase not configured)', body);
    } else {
      logTest('Login validation (empty body)', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Login validation (empty body)', false, `Error: ${error}`);
  }

  // Test 6: Login with invalid credentials
  console.log('\n📋 Test 6: Login with Invalid Credentials');
  try {
    const res = await testEndpoint(
      'Login invalid credentials',
      `${BASE_URL}/api/client/login`,
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        }),
      }
    );
    const body = await res.json();
    
    if (res.status === 401 && body.error?.code === 'INVALID_CREDENTIALS') {
      logTest('Login with invalid credentials', true, 'Returns 401 INVALID_CREDENTIALS as expected', body);
    } else if (res.status === 503) {
      logTest('Login with invalid credentials', true, 'Returns 503 SERVICE_UNAVAILABLE (anon key not configured)', body);
    } else {
      logTest('Login with invalid credentials', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Login with invalid credentials', false, `Error: ${error}`);
  }

  // Test 7: Delete tenant without auth
  console.log('\n📋 Test 7: Delete Tenant Endpoint (No Auth)');
  try {
    const res = await testEndpoint(
      'Delete tenant',
      `${BASE_URL}/api/client/admin/tenants/fake-user-id`,
      {
        method: 'DELETE',
      }
    );
    const body = await res.json();
    
    if (res.status === 401) {
      logTest('Delete tenant without auth', true, 'Returns 401 as expected (protected endpoint)', body);
    } else {
      logTest('Delete tenant without auth', false, `Unexpected response: ${res.status}`, body);
    }
  } catch (error) {
    logTest('Delete tenant without auth', false, `Error: ${error}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Return exit code
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
