// Simple test script to verify messaging functionality
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Test function to check if messaging endpoints are working
async function testMessagingEndpoints() {
  console.log('🧪 Testing messaging endpoints...\n');
  
  try {
    // Test 1: Check if server is running
    console.log('1. Testing server connection...');
    const healthCheck = await axios.get(`${API_BASE.replace('/api', '')}/`).catch(() => null);
    if (!healthCheck) {
      console.log('❌ Server is not running. Start with: npm run dev');
      return;
    }
    console.log('✅ Server is running\n');

    // Test 2: Check conversations endpoint (without auth - should get 401)
    console.log('2. Testing conversations endpoint...');
    try {
      await axios.get(`${API_BASE}/conversations`);
      console.log('❌ Conversations endpoint should require authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Conversations endpoint properly requires authentication');
      } else {
        console.log(`❌ Unexpected error: ${error.message}`);
      }
    }
    console.log('');

    // Test 3: Check messages endpoint (without auth - should get 401)
    console.log('3. Testing messages endpoint...');
    try {
      await axios.get(`${API_BASE}/messages/test-id`);
      console.log('❌ Messages endpoint should require authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Messages endpoint properly requires authentication');
      } else {
        console.log(`❌ Unexpected error: ${error.message}`);
      }
    }
    console.log('');

    console.log('🎉 Basic endpoint tests completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Start the backend: cd gp-connect-backend && npm run dev');
    console.log('2. Start the frontend: cd gp-connect && npm run dev');
    console.log('3. Login with a user account');
    console.log('4. Try sending messages between users who follow each other');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMessagingEndpoints();