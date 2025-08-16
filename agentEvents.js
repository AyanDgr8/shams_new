// agentEvents.js

import 'dotenv/config';
import axios from 'axios';
import { getPortalToken, httpsAgent } from './tokenService.js';

const MAX_RETRIES = 3;

/**
 * Essential timezone utilities - simplified Dubai timezone handling
 */

/**
 * Format timestamp to Dubai timezone
 * @param {number|string|Date} timestamp - Timestamp to format
 * @returns {string} - Formatted datetime string in Dubai timezone
 */
const formatTimestampDubai = (timestamp) => {
  if (!timestamp) return '';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    // Handle numeric timestamps properly
    let timestampMs;
    if (timestamp.toString().length <= 10) {
      // Unix timestamp in seconds - convert to milliseconds
      timestampMs = timestamp * 1000;
    } else {
      // Already in milliseconds
      timestampMs = timestamp;
    }
    date = new Date(timestampMs);
  }
  
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Format time only in Dubai timezone (HH:MM AM/PM)
 * @param {number|string|Date} timestamp - Timestamp to format
 * @returns {string} - Formatted time string in Dubai timezone
 */
const formatTimeDubai = (timestamp) => {
  if (!timestamp) return '';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    // Handle numeric timestamps properly
    let timestampMs;
    if (timestamp.toString().length <= 10) {
      // Unix timestamp in seconds - convert to milliseconds
      timestampMs = timestamp * 1000;
    } else {
      // Already in milliseconds
      timestampMs = timestamp;
    }
    date = new Date(timestampMs);
  }
  
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleString('en-AE', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Get current time in Dubai timezone
 * @returns {string} - Current Dubai time
 */
const getCurrentDubaiTime = () => {
  return formatTimestampDubai(new Date());
};

/**
 * Convert user input (treated as Dubai time) to UTC for API calls
 * @param {string} dateTimeString - Date time string (YYYY-MM-DDTHH:MM)
 * @returns {string} - UTC ISO string
 */
const convertDubaiInputToUTC = (dateTimeString) => {
  if (!dateTimeString) return '';
  
  // Parse as Dubai time and convert to UTC
  const dubaiDate = new Date(dateTimeString + '+04:00'); // Dubai is UTC+4
  return dubaiDate.toISOString();
};

/**
 * Fetch agent stats data from API
 */
async function fetchAgentStatsData(tenant, startDateTime, endDateTime, agentName = null, extension = null) {
  const baseUrl = process.env.BASE_URL || 'https://uc.ira-shams-sj.ucprem.voicemeetme.com:9443';
  const url = `${baseUrl}/api/v2/reports/callcenter/agents/stats`;
  
  try {
    console.log(`🔐 Authenticating with tenant: ${tenant}`);
    const token = await getPortalToken(tenant);
    const startTimestamp = Math.floor(new Date(startDateTime).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDateTime).getTime() / 1000);
    
    const params = {
      startDate: startTimestamp,
      endDate: endTimestamp
    };
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-account-id': process.env.ACCOUNT_ID
    };
    
    console.log(`📡 Fetching stats from: ${url}`);
    console.log(`📅 Time range: ${startTimestamp} to ${endTimestamp}`);
    
    const response = await axios.get(url, {
      params,
      headers,
      httpsAgent,
      timeout: 30000
    });
    
    console.log(`✅ Stats API Response: ${response.data?.length || 0} agents`);
    
    // Debug: Log the first agent's data structure
    if (response.data && response.data.length > 0) {
      console.log('🔍 Sample agent data structure:', JSON.stringify(response.data[0], null, 2));
    }
    
    return response.data || [];
  } catch (error) {
    console.error('❌ Error fetching agent stats:', error.message);
    if (error.response) {
      console.error(`📡 Response status: ${error.response.status}`);
      console.error(`📡 Response data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Fetch agent events data from API with improved pagination and date filtering
 */
async function fetchAgentEventsData(tenant, startDateTime, endDateTime, agentName = null, extension = null) {
  const baseUrl = process.env.BASE_URL || 'https://uc.ira-shams-sj.ucprem.voicemeetme.com:9443';
  const url = `${baseUrl}/api/v2/reports/callcenter/agents/activity/events`;
  
  try {
    console.log(`🔐 Authenticating with tenant: ${tenant}`);
    const token = await getPortalToken(tenant);
    
    // Convert to timestamps and add buffer to ensure we don't miss edge cases
    const startTimestamp = Math.floor(new Date(startDateTime).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDateTime).getTime() / 1000);
    
    // Add 1-hour buffer on each side to account for timezone edge cases
    const bufferedStartTimestamp = startTimestamp - 3600; // 1 hour before
    const bufferedEndTimestamp = endTimestamp + 3600; // 1 hour after
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-account-id': process.env.ACCOUNT_ID
    };
    
    console.log(`📡 Fetching events from: ${url}`);
    console.log(`📅 Requested range: ${startTimestamp} to ${endTimestamp}`);
    console.log(`📅 API query range (with buffer): ${bufferedStartTimestamp} to ${bufferedEndTimestamp}`);
    console.log(`📅 Dubai time range: ${formatTimestampDubai(startTimestamp * 1000)} to ${formatTimestampDubai(endTimestamp * 1000)}`);
    
    let allEvents = [];
    let nextStartKey = null;
    let pageCount = 0;
    const maxPages = 500; // Increased for very large datasets
    
    do {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}${nextStartKey ? ` (continuing...)` : ' (initial)'}`);
      
      const params = {
        startDate: bufferedStartTimestamp, // Use buffered range for API
        endDate: bufferedEndTimestamp,
        pageSize: 10000 // Maximum page size for efficiency
      };
      
      if (nextStartKey) {
        params.next_start_key = nextStartKey;
      }
      
      const response = await axios.get(url, {
        params,
        headers,
        httpsAgent,
        timeout: 180000 // 3 minutes timeout for large requests
      });
      
      const responseData = response.data || {};
      const events = responseData.events || responseData || [];
      
      console.log(`✅ Page ${pageCount}: ${events.length} events received`);
      
      if (Array.isArray(events) && events.length > 0) {
        allEvents = allEvents.concat(events);
        console.log(`📊 Total events so far: ${allEvents.length}`);
      }
      
      nextStartKey = responseData.next_start_key || responseData.nextStartKey || null;
      
      if (nextStartKey) {
        console.log(`🔄 More data available, continuing...`);
      } else {
        console.log(`🏁 Pagination complete`);
      }
      
      // Safety checks
      if (pageCount >= maxPages) {
        console.log(`⚠️ Reached maximum page limit (${maxPages}), stopping`);
        break;
      }
      
      if (events.length === 0) {
        console.log(`📄 Empty page received, stopping`);
        break;
      }
      
      // Respectful delay between requests
      if (nextStartKey && pageCount > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } while (nextStartKey);
    
    console.log(`✅ API fetch complete: ${allEvents.length} total events across ${pageCount} pages`);
    
    // CRITICAL: Apply strict date filtering to remove events outside the actual requested range
    console.log(`🔍 Applying strict date filtering...`);
    console.log(`🔍 Target range: ${formatTimestampDubai(startTimestamp * 1000)} to ${formatTimestampDubai(endTimestamp * 1000)}`);
    
    // DEBUG: Check first 3 events to understand timestamp format
    console.log(`🔍 Sample raw timestamps from API:`);
    allEvents.slice(0, 3).forEach((event, i) => {
      console.log(`   Event ${i + 1}: Raw=${event.Timestamp} (${typeof event.Timestamp}), State=${event.state}`);
      const parsed = parseEventTimestamp(event.Timestamp);
      console.log(`   → Parsed to: ${parsed} (${new Date(parsed).toISOString()})`);
      console.log(`   → Dubai time: ${formatTimestampDubai(parsed)}`);
    });
    
    const filteredEvents = allEvents.filter(event => {
      const eventTimestamp = parseEventTimestamp(event.Timestamp);
      const eventTimestampSeconds = Math.floor(eventTimestamp / 1000);
      const eventDubaiTime = formatTimestampDubai(eventTimestamp);
      
      // Extract date components for precise date validation
      const eventDateStr = eventDubaiTime.split(',')[0].trim(); // DD/MM/YYYY
      const startDateStr = formatTimestampDubai(startTimestamp * 1000).split(',')[0].trim();
      const endDateStr = formatTimestampDubai(endTimestamp * 1000).split(',')[0].trim();
      
      // Parse dates for comparison
      const [eventDay, eventMonth, eventYear] = eventDateStr.split('/').map(Number);
      const [startDay, startMonth, startYear] = startDateStr.split('/').map(Number);
      const [endDay, endMonth, endYear] = endDateStr.split('/').map(Number);
      
      const eventDate = new Date(eventYear, eventMonth - 1, eventDay);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      
      // STRICT validation: Both date AND timestamp must be within range
      const dateInRange = eventDate >= startDate && eventDate <= endDate;
      const timestampInRange = eventTimestampSeconds >= startTimestamp && eventTimestampSeconds <= endTimestamp;
      
      const isValid = dateInRange && timestampInRange;
      
      // CRITICAL: Log events from wrong dates that are being accepted
      if (isValid && eventDateStr !== startDateStr && eventDateStr !== endDateStr) {
        if (eventDate < startDate || eventDate > endDate) {
          console.log(`🚨 WRONG DATE EVENT ACCEPTED: ${event.state} from ${eventDateStr} (expected ${startDateStr}-${endDateStr})`);
          console.log(`   Raw: ${event.Timestamp} → Parsed: ${eventTimestamp} → ${eventDubaiTime}`);
          return false; // Force reject
        }
      }
      
      return isValid;
    });
    
    console.log(`🔍 Filtering results: ${allEvents.length} → ${filteredEvents.length} events`);
    console.log(`⚠️ Filtered out ${allEvents.length - filteredEvents.length} events outside requested range`);
    
    // Verify no wrong-date events made it through
    const sampleCheck = filteredEvents.slice(0, 10);
    sampleCheck.forEach(event => {
      const eventTime = formatTimestampDubai(parseEventTimestamp(event.Timestamp));
      const eventDateStr = eventTime.split(',')[0].trim();
      const startDateStr = formatTimestampDubai(startTimestamp * 1000).split(',')[0].trim();
      const endDateStr = formatTimestampDubai(endTimestamp * 1000).split(',')[0].trim();
      
      if (eventDateStr !== startDateStr && eventDateStr !== endDateStr) {
        // Check if it's a valid multi-day range event
        const [eventDay, eventMonth, eventYear] = eventDateStr.split('/').map(Number);
        const [startDay, startMonth, startYear] = startDateStr.split('/').map(Number);
        const [endDay, endMonth, endYear] = endDateStr.split('/').map(Number);
        
        const eventDate = new Date(eventYear, eventMonth - 1, eventDay);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        
        if (eventDate < startDate || eventDate > endDate) {
          console.log(`🚨🚨 FINAL CHECK FAILED: Event from ${eventDateStr} in results when range is ${startDateStr} to ${endDateStr}`);
        }
      }
    });
    
    return filteredEvents;
    
  } catch (error) {
    console.error('❌ Error fetching agent events:', error.message);
    if (error.response) {
      console.error(`📡 Response status: ${error.response.status}`);
      console.error(`📡 Response data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Process custom states for an agent from events data
 * Returns array of state blocks with start time, end time, and duration
 */
function processCustomStatesForAgent(events, agentUsername, agentExtension, startDateTime = null, endDateTime = null) {
  const stateBlocks = [];
  const targetStates = ['available', 'Logoff', 'Login', 'Not Available', 'training', 'Team Meeting', 'lunch', 'Outbound', 'ON Tickets', 'Tea Break'];
  
  if (!events || !Array.isArray(events)) return stateBlocks;
  
  // Convert date range to timestamps for filtering (if provided)
  let startTimestamp = null;
  let endTimestamp = null;
  
  if (startDateTime) {
    startTimestamp = new Date(startDateTime).getTime();
  }
  if (endDateTime) {
    endTimestamp = new Date(endDateTime).getTime();
  }
  
  // Filter events for this agent and sort by timestamp
  const agentEvents = events.filter(event => {
    const matchesAgent = event.username === agentUsername || event.ext === agentExtension;
    
    if (!matchesAgent) return false;
    
    // Additional date range filtering to ensure events are within specified range
    if (startTimestamp || endTimestamp) {
      const eventTimestamp = parseEventTimestamp(event.Timestamp);
      const eventDubaiTime = formatTimestampDubai(eventTimestamp);
      
      // Check if this is a problematic event from wrong date
      const eventDateOnly = eventDubaiTime.split(',')[0].trim(); // Get just the date part (DD/MM/YYYY)
      const startDateOnly = formatTimestampDubai(startTimestamp).split(',')[0].trim();
      const endDateOnly = formatTimestampDubai(endTimestamp).split(',')[0].trim();
      
      // Parse dates for comparison
      const [eventDay, eventMonth, eventYear] = eventDateOnly.split('/').map(Number);
      const [startDay, startMonth, startYear] = startDateOnly.split('/').map(Number);
      const [endDay, endMonth, endYear] = endDateOnly.split('/').map(Number);
      
      const eventDate = new Date(eventYear, eventMonth - 1, eventDay);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      
      // First check: Date must be within the date range
      const dateWithinRange = eventDate >= startDate && eventDate <= endDate;
      
      // Second check: Timestamp must be within the time range
      const timestampWithinRange = eventTimestamp >= startTimestamp && eventTimestamp <= endTimestamp;
      
      // CRITICAL: Both date AND timestamp checks must pass
      const withinRange = dateWithinRange && timestampWithinRange;
      
      if (!withinRange) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const timestampA = parseEventTimestamp(a.Timestamp);
    const timestampB = parseEventTimestamp(b.Timestamp);
    return timestampA - timestampB;
  });
  
  // Process consecutive state events to create blocks
  for (let i = 0; i < agentEvents.length; i++) {
    const currentEvent = agentEvents[i];
    const nextEvent = agentEvents[i + 1];
    
    if (targetStates.includes(currentEvent.state)) {
      const startTime = parseEventTimestamp(currentEvent.Timestamp);
      const startTimeFormatted = formatTimestampDubai(startTime);
      
      let endTime, endTimeFormatted, duration;
      
      if (nextEvent) {
        endTime = parseEventTimestamp(nextEvent.Timestamp);
        endTimeFormatted = formatTimestampDubai(endTime);
        duration = Math.round((endTime - startTime) / 1000); // Duration in seconds
      } else {
        // Last event - mark as CONTINUED
        endTimeFormatted = 'CONTINUED';
        duration = null;
      }
      
      stateBlocks.push({
        state: currentEvent.state,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        duration: duration
      });
    }
  }
  
  return stateBlocks;
}

/**
 * Format duration from seconds or HH:MM:SS string
 */
function formatDuration(duration) {
  if (!duration) return '00:00:00';
  
  if (typeof duration === 'string' && duration.includes(':')) {
    return duration;
  }
  
  const seconds = parseInt(duration) || 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Process simplified agent data without time slots
 */
function processSimplifiedAgentData(statsData, eventsData, agentName = null, extension = null, startDateTime = null, endDateTime = null) {
  console.log(`📊 Processing simplified agent data...`);
  console.log(`- statsData: ${statsData?.length || 0} agents`);
  console.log(`- eventsData: ${eventsData?.length || 0} events`);
  
  const processedAgents = [];
  
  // Process stats data (API returns object with extension keys)
  if (statsData && typeof statsData === 'object') {
    Object.keys(statsData).forEach(extension => {
      const agentData = statsData[extension];
      const agentUsername = agentData.name;
      const agentExtension = extension;
      
      // Apply filters if specified
      if (agentName && !agentUsername.toLowerCase().includes(agentName.toLowerCase())) {
        return;
      }
      if (extension && agentExtension !== extension) {
        return;
      }
      
      // Process custom states from events
      const customStates = processCustomStatesForAgent(eventsData, agentUsername, agentExtension, startDateTime, endDateTime);
      
      // Extract call statistics from API response
      const totalCalls = agentData.total_calls || 0;
      const answered = agentData.answered_calls || 0;
      const failed = totalCalls - answered;
      
      // Calculate AHT (Average Handle Time) - convert seconds to HH:MM:SS
      const ahtSeconds = agentData.talked_average || 0;
      
      // Extract time durations from API response (all in seconds)
      const wrapUpTimeSeconds = agentData.wrap_up_time || 0;
      const holdTimeSeconds = agentData.hold_time || 0;
      const onCallTimeSeconds = agentData.on_call_time || 0;
      const notAvailableTimeSeconds = agentData.not_available_time || 0;
      
      // Extract detailed not available breakdown
      const notAvailableReport = agentData.not_available_detailed_report || {};
      const loginTimeSeconds = notAvailableReport.Login || 0;
      const lunchTimeSeconds = notAvailableReport.lunch || 0;
      const breakTimeSeconds = notAvailableReport.break || 0;
      const trainingTimeSeconds = notAvailableReport.training || 0;
      
      console.log(`🔍 Agent ${agentUsername} (${agentExtension}) time data:`, {
        wrapUpTime: wrapUpTimeSeconds,
        holdTime: holdTimeSeconds,
        onCallTime: onCallTimeSeconds,
        notAvailableTime: notAvailableTimeSeconds,
        loginTime: loginTimeSeconds,
        lunchTime: lunchTimeSeconds
      });
      
      const processedAgent = {
        agentName: agentUsername,
        extension: agentExtension,
        totalCalls,
        answered,
        failed,
        totalWrapUpTime: formatDuration(wrapUpTimeSeconds),
        totalNotAvailableTime: formatDuration(notAvailableTimeSeconds),
        totalHoldTime: formatDuration(holdTimeSeconds),
        totalOnCallTime: formatDuration(onCallTimeSeconds),
        aht: formatDuration(ahtSeconds),
        loginTime: formatDuration(loginTimeSeconds),
        breakTime: formatDuration(breakTimeSeconds),
        lunchTime: formatDuration(lunchTimeSeconds),
        trainingTime: formatDuration(trainingTimeSeconds),
        customStates
      };
      
      processedAgents.push(processedAgent);
    });
  }
  
  return processedAgents;
}

/**
 * Generate simplified agent report (main function)
 */
const generateSimplifiedAgentReport = async (tenant, startDateTime, endDateTime, agentName = null, extension = null) => {
  console.log(`🚀 Generating simplified agent report...`);
  console.log(`📅 Time Range: ${startDateTime} to ${endDateTime}`);
  
  try {
    // Fetch data from both APIs
    const [statsData, eventsData] = await Promise.all([
      fetchAgentStatsData(tenant, startDateTime, endDateTime, agentName, extension),
      fetchAgentEventsData(tenant, startDateTime, endDateTime, agentName, extension)
    ]);
    
    // Process the data
    const processedAgents = processSimplifiedAgentData(statsData, eventsData, agentName, extension, startDateTime, endDateTime);
    
    // Calculate summary statistics
    const summary = {
      totalAgents: processedAgents.length,
      totalCalls: processedAgents.reduce((sum, agent) => sum + agent.totalCalls, 0),
      totalAnswered: processedAgents.reduce((sum, agent) => sum + agent.answered, 0),
      totalFailed: processedAgents.reduce((sum, agent) => sum + agent.failed, 0),
      timeRange: {
        start: startDateTime,
        end: endDateTime,
        startFormatted: formatTimestampDubai(startDateTime),
        endFormatted: formatTimestampDubai(endDateTime)
      }
    };
    
    summary.answerRate = summary.totalCalls > 0 ? ((summary.totalAnswered / summary.totalCalls) * 100).toFixed(1) : '0.0';
    
    return {
      success: true,
      summary,
      agents: processedAgents,
      timestamp: getCurrentDubaiTime()
    };
    
  } catch (error) {
    console.error('❌ Error generating simplified report:', error);
    return {
      success: false,
      error: error.message,
      agents: [],
      summary: {
        totalAgents: 0,
        totalCalls: 0,
        totalAnswered: 0,
        totalFailed: 0,
        answerRate: '0.0'
      }
    };
  }
};

/**
 * Display simplified agent report (for CLI usage)
 */
function displaySimplifiedAgentReport(reportData) {
  if (!reportData.success) {
    console.log('❌ Report generation failed:', reportData.error);
    return;
  }
  
  const { summary, agents } = reportData;
  
  console.log('\n📊 SIMPLIFIED AGENT ACTIVITY REPORT');
  console.log('=====================================');
  console.log(`📅 Time Range: ${summary.timeRange.startFormatted} to ${summary.timeRange.endFormatted}`);
  console.log(`👥 Total Agents: ${summary.totalAgents}`);
  console.log(`📞 Total Calls: ${summary.totalCalls} | Answered: ${summary.totalAnswered} | Failed: ${summary.totalFailed}`);
  console.log(`📈 Answer Rate: ${summary.answerRate}%`);
  console.log('');
  
  agents.forEach(agent => {
    console.log(`👤 ${agent.agentName} (${agent.extension})`);
    console.log(`   📞 Calls: ${agent.totalCalls} | Answered: ${agent.answered} | Failed: ${agent.failed}`);
    console.log(`   ⏱️  Times: Login: ${agent.loginTime} | Break: ${agent.breakTime} | Lunch: ${agent.lunchTime} | Training: ${agent.trainingTime}`);
    console.log(`   📊 Metrics: AHT: ${agent.aht} | On Call: ${agent.totalOnCallTime} | Hold: ${agent.totalHoldTime}`);
    
    // Display custom states
    agent.customStates.forEach(state => {
      console.log(`   🔄 ${state.state}: ${state.startTime} to ${state.endTime} (${formatDuration(state.duration)} seconds)`);
    });
    console.log('');
  });
}

/**
 * Helper function to parse event timestamp
 */
function parseEventTimestamp(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  } else if (typeof timestamp === 'string') {
    return new Date(timestamp).getTime();
  } else if (typeof timestamp === 'number') {
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    // Unix timestamps are typically 10 digits (seconds since 1970)
    // Millisecond timestamps are typically 13 digits
    
    if (timestamp.toString().length <= 10) {
      // This is a Unix timestamp in seconds - convert to milliseconds
      const timestampMs = timestamp * 1000;
      return timestampMs;
    } else {
      // This is already in milliseconds
      return timestamp;
    }
  }
  return new Date().getTime(); // Fallback to current time
}

// Export functions
export {
  formatTimestampDubai,
  formatTimeDubai,
  getCurrentDubaiTime,
  convertDubaiInputToUTC,
  fetchAgentStatsData,
  fetchAgentEventsData,
  generateSimplifiedAgentReport,
  processSimplifiedAgentData,
  displaySimplifiedAgentReport
};

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node agentEvents.js <tenant> <startDateTime> <endDateTime> [agentName] [extension]');
    console.log('Example: node agentEvents.js mc_int "2025-08-14T08:00:00" "2025-08-14T18:00:00"');
    process.exit(1);
  }
  
  const [tenant, startDateTime, endDateTime, agentName, extension] = args;
  
  generateSimplifiedAgentReport(tenant, startDateTime, endDateTime, agentName, extension)
    .then(reportData => {
      displaySimplifiedAgentReport(reportData);
    })
    .catch(error => {
      console.error('❌ CLI Error:', error);
    });
}