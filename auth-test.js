// auth-test.js - Test authentication token generation
import { getPortalToken } from './tokenService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAuthentication() {
  console.log('🔐 Testing Authentication...');
  console.log('='.repeat(50));
  
  try {
    console.log('📋 Environment Check:');
    console.log(`   BASE_URL: ${process.env.BASE_URL}`);
    console.log(`   API_USERNAME: ${process.env.API_USERNAME}`);
    console.log(`   API_PASSWORD: ${process.env.API_PASSWORD ? '***' : 'NOT SET'}`);
    console.log(`   TENANT: ${process.env.TENANT}`);
    console.log('');
    
    console.log('🚀 Attempting to get portal token...');
    const token = await getPortalToken('shams');
    
    console.log('✅ Authentication successful!');
    console.log(`   Token length: ${token.length} characters`);
    console.log(`   Token preview: ${token.substring(0, 50)}...`);
    
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testAuthentication().catch(console.error);
