import dotenv from 'dotenv';
import { generateSlotWiseAgentReportWithSeparateApiCalls, parseDateTimeString } from './agentEvents.js';

// Load environment variables
dotenv.config();

// Test parameters
const tenant = 'shams';
const startDateTime = '14/08/2025, 10:30AM';
const endDateTime = '14/08/2025, 02:45PM';
const agentName = null; // Set to a specific agent name to filter, or null for all agents
const extension = null; // Set to a specific extension to filter, or null for all extensions

// Expected time slots based on the example:
// 1) 10:30AM - 11:00AM
// 2) 11:00AM - 12:00PM
// 3) 12:00PM - 01:00PM
// 4) 01:00PM - 02:00PM
// 5) 02:00PM - 02:45PM

async function runTest() {
  console.log('🧪 Starting slot-wise agent report test');
  console.log(`📅 Time range: ${startDateTime} to ${endDateTime}`);
  console.log(`🎯 Filters: agentName=${agentName || 'All'}, extension=${extension || 'All'}`);
  
  try {
    // Parse the date times to verify they're correct
    const startTime = parseDateTimeString(startDateTime);
    const endTime = parseDateTimeString(endDateTime);
    
    console.log(`📅 Parsed start time: ${startTime.toISOString()}`);
    console.log(`📅 Parsed end time: ${endTime.toISOString()}`);
    
    // Generate the report
    console.log('🚀 Generating slot-wise report with separate API calls...');
    const report = await generateSlotWiseAgentReportWithSeparateApiCalls(
      tenant,
      startDateTime,
      endDateTime,
      agentName,
      extension
    );
    
    // Verify the time slots
    console.log('\n📊 Generated Time Slots:');
    report.timeSlots.forEach((slot, index) => {
      console.log(`  Slot ${slot.slotNumber}: ${slot.label} (${slot.duration} minutes)`);
    });
    
    // Verify the agent data
    console.log('\n👥 Agent Data Summary:');
    const uniqueAgents = new Set();
    report.reportData.forEach(agent => {
      uniqueAgents.add(`${agent.agentName}_${agent.extension}`);
    });
    console.log(`  Total unique agents: ${uniqueAgents.size}`);
    
    // Print first agent data as sample
    if (report.reportData.length > 0) {
      console.log('\n📋 Sample Agent Data (First Record):');
      const sample = report.reportData[0];
      console.log(`  Agent: ${sample.agentName} (${sample.extension})`);
      console.log(`  Slot: ${sample.slotNumber} (${sample.timeRange})`);
      console.log(`  States: ${sample.stateBlocks?.length || 0} state blocks`);
      
      // Print state blocks if available
      if (sample.stateBlocks && sample.stateBlocks.length > 0) {
        console.log('\n📊 Sample State Blocks:');
        sample.stateBlocks.slice(0, 3).forEach((state, i) => {
          console.log(`  ${i+1}. ${state.state}: ${state.startTime} → ${state.endTime} (${state.duration} seconds)`);
        });
        if (sample.stateBlocks.length > 3) {
          console.log(`  ... and ${sample.stateBlocks.length - 3} more states`);
        }
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error(error.stack);
  }
}

// Run the test
runTest();
