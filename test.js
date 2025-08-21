#!/usr/bin/env node

// test.js - Test slot-wise agent report API
import axios from 'axios';

const BASE_URL = 'http://localhost:9232';

/**
 * Test slot-wise agent report API
 */
async function testSlotWiseReport() {
  console.log('🧪 Testing Slot-wise Agent Report API');
  console.log('='.repeat(50));
  
  try {
    // Test parameters - matching your example
    const params = {
      tenant: 'shams',
      startDateTime: '1755153000', //'14/08/2025, 10:30AM'
      endDateTime: '1755182700', //'14/08/2025, 06:45PM'
    };
    
    console.log('📋 Test Parameters:');
    console.log(`   Tenant: ${params.tenant}`);
    console.log(`   Start: ${params.startDateTime}`);
    console.log(`   End: ${params.endDateTime}`);
    console.log('');
    
    // Make API call
    console.log('🚀 Making API call to /api/slot-wise-agent-report...');
    const response = await axios.get(`${BASE_URL}/api/slot-wise-agent-report`, { 
      params,
      timeout: 60000
    });
    
    console.log('✅ API Response received');
    console.log('📊 Response Structure:');
    console.log(`   Success: ${response.data.success}`);
    console.log(`   Summary: ${response.data.summary ? 'Present' : 'Missing'}`);
    console.log(`   Time Slots: ${response.data.summary?.totalTimeSlots || 'N/A'}`);
    console.log(`   Report Data: ${response.data.reportData ? response.data.reportData.length : 'N/A'} records`);
    console.log('');
    
    if (response.data.success) {
      // Display time slots from summary
      if (response.data.summary?.slotBreakdown) {
        console.log('⏰ Generated Time Slots:');
        response.data.summary.slotBreakdown.forEach((slot, index) => {
          console.log(`   ${slot.slotNumber}) ${slot.timeRange} (${slot.duration})`);
        });
        console.log('');
      }
      
      // Display sample report data
      if (response.data.reportData && response.data.reportData.length > 0) {
        console.log('📋 Sample Report Data (first 3 records):');
        response.data.reportData.slice(0, 3).forEach((record, index) => {
          console.log(`   ${index + 1}. Agent: ${record.agentName} (${record.extension})`);
          console.log(`      Slot: ${record.slotTime}`);
          console.log(`      Calls: ${record.totalCalls} | Answered: ${record.answered} | Failed: ${record.failed}`);
          console.log(`      States: ${record.stateBlocks?.length || 0} blocks`);
          console.log('');
        });
        
        // Verify structure
        console.log('🔍 Structure Analysis:');
        const uniqueSlots = [...new Set(response.data.reportData.map(r => r.slotTime))];
        const uniqueAgents = [...new Set(response.data.reportData.map(r => r.agentName))];
        
        console.log(`   Unique time slots: ${uniqueSlots.length}`);
        console.log(`   Unique agents: ${uniqueAgents.length}`);
        console.log(`   Total records: ${response.data.reportData.length}`);
        console.log(`   Expected records (9 slots × ${uniqueAgents.length} agents): ${9 * uniqueAgents.length}`);
        
      } else {
        console.log('❌ No report data found');
      }
      
    } else {
      console.log('❌ API returned error:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    if (error.code === 'ECONNREFUSED') {
      console.error('   💡 Make sure the server is running on port 9232');
    }
  }
}

/**
 * Test with specific agent to verify 9 slots
 */
async function testSingleAgent() {
  console.log('\n🧪 Testing Single Agent (9 Slots)');
  console.log('='.repeat(50));
  
  try {
    const params = {
      tenant: 'shams',
      startDateTime: '14/08/2025, 10:30AM',
      endDateTime: '14/08/2025, 06:45PM',
      agentName: 'Mohit test'
    };
    
    console.log(`📋 Testing agent: ${params.agentName}`);
    
    const response = await axios.get(`${BASE_URL}/api/slot-wise-agent-report`, { 
      params,
      timeout: 60000
    });
    
    if (response.data.success && response.data.reportData) {
      console.log(`✅ Agent records: ${response.data.reportData.length}`);
      console.log(`   Expected 9 slots: ${response.data.reportData.length === 9 ? '✅' : '❌'}`);
      
      console.log('\n📅 All slots for this agent:');
      response.data.reportData.forEach((record, index) => {
        console.log(`   ${index + 1}) ${record.slotTime} - Calls: ${record.totalCalls}, States: ${record.stateBlocks?.length || 0}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Single agent test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   💡 Make sure the server is running on port 9232');
    }
  }
}

// Run tests
async function runAllTests() {
  await testSlotWiseReport();
  await testSingleAgent();
  
  console.log('\n🎯 Expected Output Format:');
  console.log('Each agent should appear 9 times with these slots:');
  console.log('1) 14/08/2025, 10:30AM - 14/08/2025, 11:00AM (30 minutes)');
  console.log('2) 14/08/2025, 11:00AM - 14/08/2025, 12:00PM (60 minutes)');
  console.log('3) 14/08/2025, 12:00PM - 14/08/2025, 01:00PM (60 minutes)');
  console.log('4) 14/08/2025, 01:00PM - 14/08/2025, 02:00PM (60 minutes)');
  console.log('5) 14/08/2025, 02:00PM - 14/08/2025, 03:00PM (60 minutes)');
  console.log('6) 14/08/2025, 03:00PM - 14/08/2025, 04:00PM (60 minutes)');
  console.log('7) 14/08/2025, 04:00PM - 14/08/2025, 05:00PM (60 minutes)');
  console.log('8) 14/08/2025, 05:00PM - 14/08/2025, 06:00PM (60 minutes)');
  console.log('9) 14/08/2025, 06:00PM - 14/08/2025, 06:45PM (45 minutes)');
}

// Execute tests
runAllTests().catch(console.error);
