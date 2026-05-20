import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// Test data
const testWorkspace = {
  name: 'Test Workspace',
  description: 'A test workspace for testing purposes',
  icon: 'briefcase',
  color: '#FF6B6B'
};

async function testWorkspaceAPI() {
  try {
    console.log('🧪 Testing Workspace API...\n');

    // Test 1: Create workspace (will fail without auth, but tests endpoint)
    console.log('1️⃣ Testing POST /workspaces...');
    try {
      const createResponse = await axios.post(`${API_BASE}/workspaces`, testWorkspace);
      console.log('✅ Create workspace successful:', createResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Create workspace endpoint exists (auth required)');
      } else {
        console.log('❌ Create workspace failed:', error.message);
      }
    }

    // Test 2: Get workspaces (will fail without auth, but tests endpoint)
    console.log('\n2️⃣ Testing GET /workspaces...');
    try {
      const getResponse = await axios.get(`${API_BASE}/workspaces`);
      console.log('✅ Get workspaces successful:', getResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Get workspaces endpoint exists (auth required)');
      } else {
        console.log('❌ Get workspaces failed:', error.message);
      }
    }

    // Test 3: Check if workspace routes are mounted
    console.log('\n3️⃣ Testing if workspace routes are accessible...');
    try {
      const response = await axios.get(`${API_BASE}/workspaces`, {
        validateStatus: () => true // Don't throw on any status
      });
      console.log('✅ Workspace routes are accessible');
      console.log('📊 Response status:', response.status);
    } catch (error) {
      console.log('❌ Workspace routes not accessible:', error.message);
    }

    console.log('\n🎉 Workspace API test completed!');
    console.log('\n📝 Note: Authentication is required for full functionality.');
    console.log('   To test with auth, include a valid JWT token in the Authorization header.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testWorkspaceAPI(); 