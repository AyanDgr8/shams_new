import axios from 'axios';
import { log } from './logger.js';

// Test configuration
const config = {
  tenant: 'shams',
  startDateTime: '14/08/2025, 10:30AM',
  endDateTime: '14/08/2025, 02:30PM',
  // Remove agent filtering to get all agents
  agentName: '',
  extension: ''
};

// Function to test custom states display
async function testCustomStatesDisplay() {
  try {
    console.log('🧪 TESTING CUSTOM STATES DISPLAY');
    console.log(`📅 Date Range: ${config.startDateTime} to ${config.endDateTime}`);
    console.log(`👤 Agent: ${config.agentName ? config.agentName : 'All agents'}`);
    
    // Make API request to slot-wise agent report
    const response = await axios.get('http://localhost:9232/api/slot-wise-agent-report', {
      params: config,
      timeout: 60000 // 60 second timeout
    });
    
    if (response.data && response.data.success) {
      const { reportData } = response.data;
      console.log(`✅ Report generated successfully with ${reportData.length} time slots`);
      
      // Check each time slot for custom states
      let totalCustomStates = 0;
      let customStatesByType = {};
      let agentsWithCustomStates = new Set();
      
      reportData.forEach((slot, index) => {
        console.log(`\n📊 SLOT ${index + 1}: ${slot.startTime} to ${slot.endTime}`);
        
        if (slot.customStates && slot.customStates.length > 0) {
          console.log(`   Found ${slot.customStates.length} custom states:`);
          
          slot.customStates.forEach(state => {
            console.log(`   - ${state.state}: ${state.startTime} to ${state.endTime} (${state.duration || 'CONTINUED'} seconds)`);
            
            // Track custom state types
            if (!customStatesByType[state.state]) {
              customStatesByType[state.state] = 0;
            }
            customStatesByType[state.state]++;
            totalCustomStates++;
            
            // Track which agents have custom states
            if (slot.agentName) {
              agentsWithCustomStates.add(slot.agentName);
            }
          });
        } else {
          console.log('   No custom states found in this slot');
        }
      });
      
      // Summary
      console.log('\n📈 CUSTOM STATES SUMMARY:');
      console.log(`   Total custom states found: ${totalCustomStates}`);
      
      if (totalCustomStates > 0) {
        console.log('   Breakdown by type:');
        Object.keys(customStatesByType).forEach(stateType => {
          console.log(`   - ${stateType}: ${customStatesByType[stateType]} occurrences`);
        });
        console.log(`   Agents with custom states: ${Array.from(agentsWithCustomStates).join(', ')}`);
        console.log('\n✅ TEST PASSED: Custom states are being displayed');
      } else {
        console.log('\n❌ TEST FAILED: No custom states found');
      }
    } else {
      console.error('❌ Failed to generate report:', response.data);
    }
  } catch (error) {
    console.error('❌ Error testing custom states display:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testCustomStatesDisplay();
