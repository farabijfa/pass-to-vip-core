import axios from 'axios';

// Your LIVE Project URL
const LIVE_URL = 'https://passtovip.replit.app/api/pos/action';

async function runLiveTest() {
  console.log('🚀 Starting Live Integration Test...');
  console.log(`🎯 Target: ${LIVE_URL}`);
  console.log('');

  try {
    const payload = {
      external_id: 'TEST-QR-001', // The QR code we seeded in Supabase
      action: 'MEMBER_EARN',      // We are adding points
      amount: 50
    };

    console.log('📤 Sending Payload:', JSON.stringify(payload, null, 2));
    console.log('');

    const response = await axios.post(LIVE_URL, payload);

    console.log('✅ SUCCESS! Server responded:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    
    // Interpretation helper
    console.log('📊 Interpretation:');
    if (response.data.success) {
      console.log('   ✓ Replit → Supabase: CONNECTED (Transaction processed)');
      if (response.data.data?.passkit_sync?.synced) {
        console.log('   ✓ Replit → PassKit: SYNCED (Pass updated on phone)');
      } else if (response.data.data?.passkit_sync?.error?.includes('404')) {
        console.log('   ✓ Replit → PassKit: AUTHENTICATED (404 = Pass ID not found, but credentials work!)');
      } else if (response.data.data?.passkit_sync?.mode === 'MOCK') {
        console.log('   ⚠ Replit → PassKit: MOCK MODE (No API keys configured)');
      }
    }

  } catch (error) {
    console.error('❌ Test Failed!');
    console.log('');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      // Help interpret errors
      console.log('');
      console.log('📊 Interpretation:');
      if (error.response.status === 401) {
        console.log('   ✗ Authentication failed - check PASSKIT_API_KEY and PASSKIT_API_SECRET');
      } else if (error.response.status === 404) {
        console.log('   ✓ Auth successful but resource not found (this is OK for test data!)');
      } else if (error.response.status >= 500) {
        console.log('   ✗ Server error - check Replit logs for details');
      }
    } else {
      console.error('Error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('   ✗ Could not connect - is the app deployed?');
      }
    }
  }
}

runLiveTest();
