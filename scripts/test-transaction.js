import axios from 'axios';

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

async function testTransaction() {
  console.log('Simulating Softr Button Press...');
  console.log('================================\n');

  const payload = {
    external_id: "TEST-QR-001",
    action: "MEMBER_EARN",
    amount: 100
  };

  console.log('Request URL:', `${BASE_URL}/api/pos/action`);
  console.log('Request Payload:', JSON.stringify(payload, null, 2));
  console.log('\nSending request...\n');

  try {
    const response = await axios.post(`${BASE_URL}/api/pos/action`, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('SUCCESS! Response:');
    console.log('==================');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('\n--- Summary ---');
      console.log(`New Balance: ${response.data.data?.new_balance}`);
      console.log(`Message: ${response.data.data?.notification_message || response.data.message}`);
    }
  } catch (error) {
    console.log('ERROR! Response:');
    console.log('=================');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received. Is the server running?');
      console.log('Make sure to start the server with: npm run dev');
    } else {
      console.log('Error:', error.message);
    }
  }
}

testTransaction();
