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
        pageSize: 1500 // Updated page size as requested
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
      const eventDateStr = eventDubaiTime.split(',')[0].trim(); // Get just the date part (DD/MM/YYYY)
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
      const timestampWithinRange = eventTimestampSeconds >= startTimestamp && eventTimestampSeconds <= endTimestamp;
      
      const isValid = dateInRange && timestampWithinRange;
      
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
 * Fetch agent events data for a specific time slot
 * @param {string} tenant - Tenant name
 * @param {string} startDateTime - Start date time in user format
 * @param {string} endDateTime - End date time in user format
 * @param {string} agentName - Filter by agent name (optional)
 * @param {string} extension - Filter by extension (optional)
 * @returns {Promise<Array>} - Events data for the specified time slot
 */
async function fetchSlotWiseAgentEvents(tenant, startDateTime, endDateTime, agentName = null, extension = null) {
  const baseUrl = process.env.BASE_URL || 'https://uc.ira-shams-sj.ucprem.voicemeetme.com:9443';
  const url = `${baseUrl}/api/v2/reports/callcenter/agents/activity/events`;
  
  try {
    console.log(`🔐 Authenticating with tenant: ${tenant}`);
    const token = await getPortalToken(tenant);
    
    // Convert to timestamps
    const startTimestamp = Math.floor(new Date(startDateTime).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDateTime).getTime() / 1000);
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-account-id': process.env.ACCOUNT_ID
    };
    
    console.log(`📡 Fetching events for slot: ${formatTimestampDubai(startTimestamp * 1000)} to ${formatTimestampDubai(endTimestamp * 1000)}`);
    
    let allEvents = [];
    let nextStartKey = null;
    let pageCount = 0;
    const maxPages = 50; // Limit pages for individual slot queries
    
    do {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount} for slot`);
      
      const params = {
        startDate: startTimestamp,
        endDate: endTimestamp,
        pageSize: 1500 // As requested in requirements
      };
      
      if (nextStartKey) {
        params.next_start_key = nextStartKey;
      }
      
      const response = await axios.get(url, {
        params,
        headers,
        httpsAgent,
        timeout: 60000 // 60 seconds timeout
      });
      
      const responseData = response.data || {};
      const events = responseData.events || responseData || [];
      
      console.log(`✅ Slot page ${pageCount}: ${events.length} events received`);
      
      if (Array.isArray(events) && events.length > 0) {
        allEvents = allEvents.concat(events);
        console.log(`📊 Total events for this slot so far: ${allEvents.length}`);
      }
      
      nextStartKey = responseData.next_start_key || responseData.nextStartKey || null;
      
      if (nextStartKey) {
        console.log(`🔄 More data available for this slot, continuing...`);
      } else {
        console.log(`🏁 Slot pagination complete`);
      }
      
      // Safety checks
      if (pageCount >= maxPages) {
        console.log(`⚠️ Reached maximum page limit (${maxPages}) for this slot, stopping`);
        break;
      }
      
      if (events.length === 0) {
        console.log(`📄 Empty page received for this slot, stopping`);
        break;
      }
      
      // Respectful delay between requests
      if (nextStartKey && pageCount > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } while (nextStartKey);
    
    console.log(`✅ Slot API fetch complete: ${allEvents.length} total events across ${pageCount} pages`);
    
    // Apply filtering for agent name and extension if provided
    if (agentName || extension) {
      allEvents = allEvents.filter(event => {
        const matchesName = !agentName || (event.username && event.username.toLowerCase().includes(agentName.toLowerCase()));
        const matchesExtension = !extension || (event.ext && event.ext.toString() === extension.toString());
        return matchesName && matchesExtension;
      });
      
      console.log(`🔍 After agent filtering: ${allEvents.length} events`);
    }
    
    return allEvents;
    
  } catch (error) {
    console.error(`❌ Error fetching slot events (${formatTimestampDubai(startTimestamp * 1000)} to ${formatTimestampDubai(endTimestamp * 1000)}):`, error.message);
    if (error.response) {
      console.error(`📡 Response status: ${error.response.status}`);
      console.error(`📡 Response data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Consolidate consecutive identical states into single entries
 * @param {Array} stateBlocks - Array of state blocks from processCustomStatesForAgent
 * @returns {Array} - Consolidated state blocks with merged consecutive states
 */
function consolidateConsecutiveStates(stateBlocks) {
  if (!stateBlocks || stateBlocks.length === 0) return [];
  
  console.log(`🔄 Starting consolidation with ${stateBlocks.length} state blocks`);
  
  // Debug: Log all input states
  stateBlocks.forEach((block, i) => {
    console.log(`   Block ${i}: ${block.state} (${block.startTime} → ${block.endTime}) Duration: ${block.duration}`);
  });
  
  const consolidated = [];
  let currentGroup = null;
  
  for (let i = 0; i < stateBlocks.length; i++) {
    const currentBlock = stateBlocks[i];
    
    console.log(`🔍 Processing block ${i}: ${currentBlock.state}`);
    
    // If this is the first block or state changed, start a new group
    if (!currentGroup || currentGroup.state !== currentBlock.state) {
      // Save previous group if exists
      if (currentGroup) {
        console.log(`✅ Finalizing group: ${currentGroup.state} with ${currentGroup.blockCount} blocks, total duration: ${currentGroup.duration}`);
        consolidated.push(currentGroup);
      }
      
      // Start new group
      currentGroup = {
        state: currentBlock.state,
        startTime: currentBlock.startTime,
        endTime: currentBlock.endTime,
        duration: currentBlock.duration || 0,
        blockCount: 1
      };
      console.log(`🆕 Starting new group: ${currentGroup.state}`);
    } else {
      // Same state - extend the current group
      console.log(`🔗 Extending group: ${currentGroup.state} (block ${currentGroup.blockCount + 1})`);
      currentGroup.endTime = currentBlock.endTime;
      currentGroup.blockCount++;
      
      // Add duration if both blocks have valid durations
      if (currentBlock.duration !== null && currentGroup.duration !== null) {
        const oldDuration = currentGroup.duration;
        currentGroup.duration += currentBlock.duration;
        console.log(`   Duration: ${oldDuration} + ${currentBlock.duration} = ${currentGroup.duration}`);
      } else if (currentBlock.duration === null) {
        // If any block in the group has null duration (CONTINUED), mark the whole group as null
        console.log(`   Setting duration to null (CONTINUED state)`);
        currentGroup.duration = null;
      }
    }
  }
  
  // Don't forget to add the last group
  if (currentGroup) {
    console.log(`✅ Finalizing last group: ${currentGroup.state} with ${currentGroup.blockCount} blocks, total duration: ${currentGroup.duration}`);
    consolidated.push(currentGroup);
  }
  
  console.log(`🎯 Consolidation complete: ${stateBlocks.length} → ${consolidated.length} blocks`);
  
  // Debug: Log final consolidated results
  consolidated.forEach((block, i) => {
    console.log(`   Final ${i}: ${block.state} (${block.startTime} → ${block.endTime}) Duration: ${block.duration} [${block.blockCount} blocks merged]`);
  });
  
  return consolidated;
}

/**
 * Process custom states for an agent from events data
 * Returns array of consolidated state blocks with start time, end time, and duration
 */
function processCustomStatesForAgent(events, agentUsername, agentExtension, startDateTime = null, endDateTime = null) {
  console.log(`🔍 DEBUG: processCustomStatesForAgent called with username=${agentUsername}, extension=${agentExtension}`);
  console.log(`🔍 DEBUG: Date range: ${startDateTime} to ${endDateTime}`);
  
  const stateBlocks = [];
  const targetStates = ['available', 'Logoff', 'Login', 'Not Available', 'training', 'Team Meeting', 'lunch', 'Outbound', 'ON Tickets', 'Tea Break'];
  
  if (!events || !Array.isArray(events)) {
    console.log(`⚠️ WARNING: No events data provided to processCustomStatesForAgent`);
    return stateBlocks;
  }
  
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
      
      // DEBUG: Special logging for lunch events
      if (currentEvent.state === 'lunch') {
        console.log(`🍽️ LUNCH EVENT DEBUG:`);
        console.log(`   Current event: ${JSON.stringify(currentEvent)}`);
        console.log(`   Next event: ${nextEvent ? JSON.stringify(nextEvent) : 'NONE'}`);
        console.log(`   Start time: ${startTimeFormatted}`);
      }
      
      if (nextEvent) {
        endTime = parseEventTimestamp(nextEvent.Timestamp);
        endTimeFormatted = formatTimestampDubai(endTime);
        duration = Math.round((endTime - startTime) / 1000); // Duration in seconds
        
        // DEBUG: More lunch logging
        if (currentEvent.state === 'lunch') {
          console.log(`   End time: ${endTimeFormatted}`);
          console.log(`   Duration calculation: (${endTime} - ${startTime}) / 1000 = ${duration} seconds`);
          console.log(`   Time difference in ms: ${endTime - startTime}`);
        }
        
        // FIX: Handle instantaneous state changes (0-second durations)
        if (duration === 0) {
          // For lunch and break states that show 0 seconds, this likely means
          // the agent entered and exited the state within the same second
          // We have a few options:
          
          if (['lunch', 'Tea Break', 'break'].includes(currentEvent.state)) {
            console.log(`⚠️ Detected instantaneous ${currentEvent.state} event - this suggests rapid state change`);
            console.log(`   Raw timestamps: ${currentEvent.Timestamp} → ${nextEvent.Timestamp}`);
            
            // Option 1: Set a minimum duration (e.g., 1 second) to indicate the state occurred
            duration = 1;
            console.log(`   Applied minimum duration: ${duration} second(s)`);
            
            // Option 2: Alternative - you could skip these events entirely if they seem invalid
            // Uncomment the following lines if you prefer to skip 0-duration events:
            // console.log(`   Skipping instantaneous ${currentEvent.state} event`);
            // continue; // Skip this event
          }
        }
      } else {
        // Last event - mark as CONTINUED
        endTimeFormatted = 'CONTINUED';
        duration = null;
        
        if (currentEvent.state === 'lunch') {
          console.log(`   No next event - marked as CONTINUED`);
        }
      }
      
      stateBlocks.push({
        state: currentEvent.state,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        duration: duration
      });
    }
  }
  
  // Consolidate consecutive identical states
  const consolidatedBlocks = consolidateConsecutiveStates(stateBlocks);
  
  return consolidatedBlocks;
}

/**
 * Parse event timestamp from various formats
 * @param {number|string} timestamp - Event timestamp
 * @returns {number} - Parsed timestamp in milliseconds
 */
function parseEventTimestamp(timestamp) {
  if (!timestamp) return null;
  
  const rawTimestamp = timestamp.timestamp || timestamp.time || timestamp;
  
  if (typeof rawTimestamp === 'number') {
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    // Unix timestamps are typically 10 digits (seconds since 1970)
    // Millisecond timestamps are typically 13 digits
    if (rawTimestamp < 10000000000) {
      // Timestamp is in seconds, convert to milliseconds
      return rawTimestamp * 1000;
    } else {
      // Timestamp is already in milliseconds
      return rawTimestamp;
    }
  }
  
  if (typeof rawTimestamp === 'string') {
    return new Date(rawTimestamp).getTime();
  }
  
  return null;
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
 * Process events for a specific time slot
 * @param {Array} events - Agent events data
 * @param {Object} timeSlot - Current time slot with start and end times
 * @param {Object} previousSlotState - State from the end of the previous slot (null for first slot)
 * @returns {Object} - Processed state blocks and next slot state
 */
function processEventsForTimeSlot(events, timeSlot, previousSlotState) {
  const stateBlocks = [];
  const slotStart = timeSlot.start.getTime();
  const slotEnd = timeSlot.end.getTime();
  
  // Filter events that fall within this time slot
  const slotEvents = events.filter(event => {
    const eventTime = new Date(event.timestamp * 1000).getTime();
    return eventTime >= slotStart && eventTime <= slotEnd;
  });
  
  // Sort events by timestamp
  slotEvents.sort((a, b) => a.timestamp - b.timestamp);
  
  // Initialize with previous slot state if available
  let currentState = previousSlotState ? { 
    state: previousSlotState.state,
    startTime: formatTimeDubai(new Date(slotStart)),
    timestamp: slotStart / 1000
  } : null;
  
  // Process events to create state blocks
  for (const event of slotEvents) {
    const eventTime = new Date(event.timestamp * 1000);
    const formattedTime = formatTimeDubai(eventTime);
    const newState = event.state || event.event_type;
    
    // If we have a current state and it's different from the new state, close the block
    if (currentState && currentState.state !== newState) {
      stateBlocks.push({
        state: currentState.state,
        startTime: currentState.startTime,
        endTime: formattedTime,
        duration: Math.round((event.timestamp - currentState.timestamp))
      });
    }
    
    // Start a new state block
    currentState = {
      state: newState,
      startTime: formattedTime,
      timestamp: event.timestamp
    };
  }
  
  // Close the last state block if it exists
  if (currentState) {
    stateBlocks.push({
      state: currentState.state,
      startTime: currentState.startTime,
      endTime: formatTimeDubai(new Date(slotEnd)),
      duration: Math.round((slotEnd / 1000) - currentState.timestamp)
    });
  }
  
  // Return the state blocks and the state at the end of this slot
  return {
    stateBlocks: stateBlocks,
    nextSlotState: currentState ? {
      state: currentState.state,
      timestamp: slotEnd / 1000
    } : null
  };
}

/**
 * Process agent data for slot-wise report with proper time distribution
 * @param {Object} statsData - Agent stats data
 * @param {Array} eventsData - Agent events data
 * @param {Array} timeSlots - Time slots array
 * @param {string} agentName - Filter by agent name (optional)
 * @param {string} extension - Filter by extension (optional)
 * @returns {Array} - Processed slot-wise report data
 */
function processAgentDataForSlotWiseReport(statsData, eventsData, timeSlots, agentName = null, extension = null) {
  console.log('🔍 DEBUG: processAgentDataForSlotWiseReport called with:');
  console.log(`- statsData: ${statsData ? Object.keys(statsData).length : 0} agents`);
  console.log(`- eventsData: ${eventsData?.length || 0} records`);
  console.log(`- timeSlots: ${timeSlots?.length || 0} slots`);

  const reportData = [];
  
  // Group events by agent
  const eventsByAgent = {};
  const eventsByUsername = {};
  if (Array.isArray(eventsData)) {
    eventsData.forEach(event => {
      const agentKey = `${event.username || event.user_id}_${event.ext || event.extension}`;
      const username = event.username || event.user_id;
      
      if (!eventsByAgent[agentKey]) {
        eventsByAgent[agentKey] = [];
      }
      eventsByAgent[agentKey].push(event);
      
      if (!eventsByUsername[username]) {
        eventsByUsername[username] = [];
      }
      eventsByUsername[username].push(event);
    });
  }
  
  // Create a combined agent list from both stats and events
  const allAgents = new Map();
  const statsByUsername = new Map();
  
  // Add agents from stats data
  if (statsData && Object.keys(statsData).length > 0) {
    Object.entries(statsData).forEach(([ext, agentStats]) => {
      const agentUsername = agentStats.name || agentStats.username;
      const agentKey = `${agentUsername}_${ext}`;
      
      statsByUsername.set(agentUsername, { ext, stats: agentStats });
      
      const normalizedStats = {
        Login: agentStats.Login || '00:00:00',
        break: agentStats.break || '00:00:00',
        lunch: agentStats.lunch || '00:00:00',
        training: agentStats.training || '00:00:00',
        'Tea Break': agentStats['Tea Break'] || '00:00:00',
        'Team Meeting': agentStats['Team Meeting'] || '00:00:00',
        totalCalls: agentStats.total_calls || agentStats.totalCalls || 0,
        answeredCalls: agentStats.answered_calls || agentStats.answeredCalls || 0,
        failedCalls: agentStats.failed_calls || agentStats.failedCalls || 0,
        wrapUpTime: agentStats.wrap_up_time || agentStats.wrapUpTime || '00:00:00',
        holdTime: agentStats.hold_time || agentStats.holdTime || '00:00:00',
        onCallTime: agentStats.on_call_time || agentStats.onCallTime || '00:00:00',
        notAvailableTime: agentStats.not_available_time || agentStats.notAvailableTime || '00:00:00'
      };
      
      allAgents.set(agentKey, {
        username: agentUsername,
        extension: ext,
        stats: normalizedStats,
        source: 'stats'
      });
    });
  }
  
  // Add agents from events data and merge with stats when possible
  if (Array.isArray(eventsData) && eventsData.length > 0) {
    Object.keys(eventsByAgent).forEach(agentKey => {
      const firstEvent = eventsByAgent[agentKey][0];
      const agentUsername = firstEvent.username || firstEvent.user_id;
      const ext = firstEvent.ext || firstEvent.extension;
      
      if (!allAgents.has(agentKey)) {
        const statsForUser = statsByUsername.get(agentUsername);
        let agentStats = {
          Login: '00:00:00',
          break: '00:00:00',
          lunch: '00:00:00',
          training: '00:00:00',
          'Tea Break': '00:00:00',
          'Team Meeting': '00:00:00',
          totalCalls: 0,
          answeredCalls: 0,
          failedCalls: 0,
          wrapUpTime: '00:00:00',
          holdTime: '00:00:00',
          onCallTime: '00:00:00',
          notAvailableTime: '00:00:00'
        };

        if (statsForUser) {
          const rawStats = statsForUser.stats;
          agentStats = {
            Login: rawStats.Login || '00:00:00',
            break: rawStats.break || '00:00:00',
            lunch: rawStats.lunch || '00:00:00',
            training: rawStats.training || '00:00:00',
            'Tea Break': rawStats['Tea Break'] || '00:00:00',
            'Team Meeting': rawStats['Team Meeting'] || '00:00:00',
            totalCalls: rawStats.total_calls || rawStats.totalCalls || 0,
            answeredCalls: rawStats.answered_calls || rawStats.answeredCalls || 0,
            failedCalls: rawStats.failed_calls || rawStats.failedCalls || 0,
            wrapUpTime: rawStats.wrap_up_time || rawStats.wrapUpTime || '00:00:00',
            holdTime: rawStats.hold_time || rawStats.holdTime || '00:00:00',
            onCallTime: rawStats.on_call_time || rawStats.onCallTime || '00:00:00',
            notAvailableTime: rawStats.not_available_time || rawStats.notAvailableTime || '00:00:00'
          };
        }
        
        allAgents.set(agentKey, {
          username: agentUsername,
          extension: ext,
          stats: agentStats,
          source: statsForUser ? 'events+stats' : 'events'
        });
      }
    });
  }
  
  console.log(`🔍 DEBUG: Combined ${allAgents.size} unique agents from stats and events`);
  
  // Process each agent
  allAgents.forEach((agentInfo, agentKey) => {
    const { username: agentUsername, extension: ext, stats: agentStats, source } = agentInfo;
    
    // Skip agents with undefined or null names
    if (!agentUsername || agentUsername === 'undefined') {
      return;
    }
    
    // Apply filters
    if (agentName && !agentUsername.toLowerCase().includes(agentName.toLowerCase())) {
      return;
    }
    if (extension && !ext.toString().includes(extension)) {
      return;
    }
    
    const agentEvents = eventsByAgent[agentKey] || eventsByUsername[agentUsername] || [];
    
    // Sort events by timestamp
    agentEvents.sort((a, b) => {
      const timeA = new Date(a.timestamp * 1000).getTime();
      const timeB = new Date(b.timestamp * 1000).getTime();
      return timeA - timeB;
    });
    
    // Process each time slot for this agent
    let previousSlotState = null;
    
    timeSlots.forEach((timeSlot, slotIndex) => {
      console.log(`🚨 PROCESSING SLOT ${slotIndex + 1} for agent ${agentUsername} (${timeSlot.duration} minutes)`);
      
      // Calculate slot-specific metrics based on slot duration
      const slotCallMetrics = calculateSlotWiseCallMetrics(agentEvents, agentStats, timeSlot, timeSlots);
      
      // Process events for this specific time slot
      const slotResult = processEventsForTimeSlot(agentEvents, timeSlot, previousSlotState);
      
      // Process custom states for this slot
      const customStates = processCustomStatesForAgent(
        agentEvents, 
        agentUsername,
        ext,
        timeSlot.start.toISOString(), 
        timeSlot.end.toISOString()
      );
      
      console.log(`🔍 DEBUG: Agent ${agentUsername}, Slot ${slotIndex + 1}: Call metrics =`, slotCallMetrics);

      console.log(`📊 Slot ${slotIndex + 1}/${timeSlots.length} (${timeSlot.start.toISOString()} - ${timeSlot.end.toISOString()}): Adding ${customStates.length} custom states for ${agentUsername}`);
      
      reportData.push({
        agentName: agentUsername,
        extension: ext,
        timeSlot: timeSlot.label,
        slotNumber: timeSlot.slotNumber,
        slotDuration: timeSlot.duration,
        timeSlotStart: timeSlot.start,
        timeSlotEnd: timeSlot.end,
        stateBlocks: slotResult.stateBlocks.length > 0 ? slotResult.stateBlocks : [{
          state: 'No Activity',
          startTime: formatTimeDubai(timeSlot.start),
          endTime: formatTimeDubai(timeSlot.end),
          displayText: 'No Activity'
        }],
        customStates: customStates,
        dailyStats: agentStats,
        totalCalls: slotCallMetrics.totalCalls,
        answered: slotCallMetrics.answeredCalls,
        failed: slotCallMetrics.failedCalls,
        wrapUpTime: slotCallMetrics.wrapUpTime,
        holdTime: slotCallMetrics.holdTime,
        onCallTime: slotCallMetrics.onCallTime,
        notAvailableTime: slotCallMetrics.notAvailableTime,
        aht: slotCallMetrics.aht
      });
      
      previousSlotState = slotResult.nextSlotState;
    });
  });
  
  console.log(`🔍 DEBUG: Generated ${reportData.length} slot-wise report records`);
  return reportData;
}

/**
 * Distribute time values across slots based on duration ratio
 * @param {number|string} timeValue - Time value in seconds or formatted string
 * @param {number} durationRatio - Ratio of slot duration to total duration
 * @returns {string} - Formatted time value for the slot
 */
function distributeTimeAcrossSlots(timeValue, durationRatio) {
  // Handle case when timeValue is already a formatted string
  if (typeof timeValue === 'string' && timeValue.includes(':')) {
    // Convert HH:MM:SS to seconds
    const [hours, minutes, seconds] = timeValue.split(':').map(Number);
    timeValue = hours * 3600 + minutes * 60 + seconds;
  }
  
  // Ensure timeValue is a number
  const timeValueSeconds = Number(timeValue) || 0;
  
  // Calculate proportional time for this slot
  let slotTimeSeconds = Math.round(timeValueSeconds * durationRatio);
  
  // Ensure minimum value if original is > 0
  if (timeValueSeconds > 0 && slotTimeSeconds === 0) {
    slotTimeSeconds = 1; // Minimum 1 second if there was any time
  }
  
  // Format the result using the existing formatDuration function
  return formatDuration(slotTimeSeconds);
}

/**
 * Calculate call metrics for slot-wise reporting with duration-based distribution
 * @param {Array} agentEvents - Agent events for this agent
 * @param {Object} agentStats - Agent daily stats
 * @param {Object} timeSlot - Current time slot with duration
 * @param {Array} allTimeSlots - All time slots for proportional calculation
 * @returns {Object} - Call metrics for this time slot
 */
function calculateSlotWiseCallMetrics(agentEvents, agentStats, timeSlot, allTimeSlots) {
  console.log(`🚨 FUNCTION CALLED: calculateSlotWiseCallMetrics for slot ${timeSlot.slotNumber} (${timeSlot.duration} min)`);
  
  // Calculate total duration across all slots
  const totalDurationMinutes = allTimeSlots.reduce((sum, slot) => sum + slot.duration, 0);
  const slotDurationMinutes = timeSlot.duration;
  
  // Calculate proportional distribution based on slot duration
  const durationRatio = slotDurationMinutes / totalDurationMinutes;
  
  console.log(`🔍 DEBUG: Slot ${timeSlot.slotNumber} duration ratio: ${durationRatio.toFixed(3)} (${slotDurationMinutes}/${totalDurationMinutes} min)`);
  
  // Normalize field names
  const normalizedStats = {
    totalCalls: agentStats.total_calls || agentStats.totalCalls || 0,
    answeredCalls: agentStats.answered_calls || agentStats.answeredCalls || 0,
    failedCalls: agentStats.failed_calls || agentStats.failedCalls || 0,
    wrapUpTime: agentStats.wrap_up_time || agentStats.wrapUpTime || 0,
    holdTime: agentStats.hold_time || agentStats.holdTime || 0,
    onCallTime: agentStats.on_call_time || agentStats.onCallTime || 0,
    notAvailableTime: agentStats.not_available_time || agentStats.notAvailableTime || 0
  };

  // Distribute calls based on slot duration
  const originalTotalCalls = normalizedStats.totalCalls;
  const originalAnsweredCalls = normalizedStats.answeredCalls;
  
  let totalCalls = Math.round(originalTotalCalls * durationRatio);
  let answeredCalls = Math.round(originalAnsweredCalls * durationRatio);
  
  // Ensure minimum values when original totals > 0
  if (originalTotalCalls > 0 && totalCalls === 0) {
    totalCalls = Math.max(1, Math.ceil(originalTotalCalls * durationRatio));
  }
  if (originalAnsweredCalls > 0 && answeredCalls === 0) {
    answeredCalls = Math.max(1, Math.ceil(originalAnsweredCalls * durationRatio));
  }
  
  const failedCalls = Math.max(0, totalCalls - answeredCalls);
  
  // Distribute time values based on slot duration
  const wrapUpTime = distributeTimeAcrossSlots(normalizedStats.wrapUpTime, durationRatio);
  const holdTime = distributeTimeAcrossSlots(normalizedStats.holdTime, durationRatio);
  const onCallTime = distributeTimeAcrossSlots(normalizedStats.onCallTime, durationRatio);
  const notAvailableTime = distributeTimeAcrossSlots(normalizedStats.notAvailableTime, durationRatio);
  
  // Calculate AHT for this slot
  const talkedTimeSeconds = agentStats.talked_time || 0;
  const wrapUpTimeSeconds = agentStats.wrap_up_time || 0;
  const holdTimeSeconds = agentStats.hold_time || 0;
  const dailyTotalCalls = agentStats.total_calls || 0;
  
  const ahtSeconds = dailyTotalCalls > 0 ? Math.floor((talkedTimeSeconds + wrapUpTimeSeconds + holdTimeSeconds) / dailyTotalCalls) : 0;
  const aht = formatDurationToHHMMSS(ahtSeconds);
  
  console.log(`🔍 DEBUG: Slot ${timeSlot.slotNumber} metrics - Calls: ${totalCalls}, Answered: ${answeredCalls}, Failed: ${failedCalls}`);
  
  return {
    totalCalls,
    answeredCalls,
    failedCalls,
    wrapUpTime,
    holdTime,
    onCallTime,
    notAvailableTime,
    aht
  };
}

/**
 * Generate slot-wise agent report
 * @param {string} tenant - Tenant name
 * @param {string} startDateTime - Start date time in user format
 * @param {string} endDateTime - End date time in user format
 * @param {string} agentName - Filter by agent name (optional)
 * @param {string} extension - Filter by extension (optional)
 * @returns {Object} - Slot-wise report data
 */
async function generateSlotWiseAgentReport(tenant, startDateTime, endDateTime, agentName = null, extension = null) {
  try {
    console.log(`🚀 Generating slot-wise agent report for tenant: ${tenant}`);
    console.log(`📅 Time Range: ${startDateTime} to ${endDateTime}`);
    
    const startTime = parseDateTimeString(startDateTime);
    const endTime = parseDateTimeString(endDateTime);
    
    // Generate slot-wise time slots
    const timeSlots = generateSlotWiseTimeSlots(startTime, endTime);
    
    console.log(`📊 Generated ${timeSlots.length} time slots:`);
    timeSlots.forEach((slot, index) => {
      console.log(`  Slot ${index + 1}: ${slot.label} (${slot.duration} min)`);
    });
    
    const [statsData, eventsData] = await Promise.all([
      fetchAgentStatsData(tenant, startTime, endTime),
      fetchAgentEventsData(tenant, startTime, endTime).catch(err => {
        console.log('⚠️ Events data fetch failed, continuing with stats only');
        return [];
      })
    ]);
    
    const reportData = processAgentDataForSlotWiseReport(statsData, eventsData, timeSlots, agentName, extension);
    
    const uniqueAgents = new Set(reportData.map(r => `${r.agentName}_${r.extension}`));
    const totalStateBlocks = reportData.reduce((sum, r) => sum + r.stateBlocks.length, 0);
    
    const summary = {
      totalAgents: uniqueAgents.size,
      totalTimeSlots: timeSlots.length,
      totalStateBlocks: totalStateBlocks,
      timeRange: `${startDateTime} to ${endDateTime}`,
      slotBreakdown: timeSlots.map(slot => ({
        slotNumber: slot.slotNumber,
        timeRange: slot.label,
        duration: `${slot.duration} minutes`
      })),
      generatedAt: new Date().toISOString()
    };
    
    const result = {
      success: true,
      summary,
      reportData,
      timeSlots
    };
    
    console.log(`✅ Generated slot-wise report with ${reportData.length} records across ${timeSlots.length} slots`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating slot-wise agent report:', error);
    throw error;
  }
}

/**
 * Generate slot-wise agent report with separate API calls per slot
 * @param {string} tenant - Tenant name
 * @param {string} startDateTime - Start date time in user format
 * @param {string} endDateTime - End date time in user format
 * @param {string} agentName - Filter by agent name (optional)
 * @param {string} extension - Filter by extension (optional)
 * @returns {Object} - Slot-wise report data
 */
async function generateSlotWiseAgentReportWithSeparateApiCalls(tenant, startDateTime, endDateTime, agentName = null, extension = null) {
  try {
    console.log(`🚀 Generating slot-wise agent report with separate API calls for tenant: ${tenant}`);
    console.log(`📅 Time Range: ${startDateTime} to ${endDateTime}`);
    
    const startTime = parseDateTimeString(startDateTime);
    const endTime = parseDateTimeString(endDateTime);
    
    // Generate slot-wise time slots
    const timeSlots = generateSlotWiseTimeSlots(startTime, endTime);
    
    console.log(`📊 Generated ${timeSlots.length} time slots:`);
    timeSlots.forEach((slot, index) => {
      console.log(`  Slot ${index + 1}: ${slot.label} (${slot.duration} min)`);
    });
    
    // Fetch stats data for the entire period (once)
    const statsData = await fetchAgentStatsData(tenant, startTime, endTime);
    console.log(`📊 Fetched stats data for ${Object.keys(statsData).length} agents`);
    
    // Fetch events data for each slot separately
    const slotResults = [];
    
    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      console.log(`🔍 Processing slot ${i + 1}: ${slot.label}`);
      
      // Format dates for API call
      const slotStartFormatted = formatTimestampDubai(slot.start);
      const slotEndFormatted = formatTimestampDubai(slot.end);
      
      console.log(`📡 Fetching events for slot ${i + 1}: ${slotStartFormatted} to ${slotEndFormatted}`);
      
      // Fetch events data for this specific slot
      const slotEventsData = await fetchSlotWiseAgentEvents(
        tenant,
        slot.start,
        slot.end,
        agentName,
        extension
      );
      
      console.log(`✅ Slot ${i + 1}: Fetched ${slotEventsData.length} events`);
      
      // Process data for this slot
      const slotAgentData = processAgentDataForSlotWiseReport(
        statsData,
        slotEventsData,
        [slot], // Pass only this slot
        agentName,
        extension
      );
      
      // Add slot data to results
      slotResults.push({
        slotNumber: slot.slotNumber,
        timeRange: slot.label,
        duration: slot.duration,
        agentData: slotAgentData
      });
    }
    
    // Combine all slot results
    const allAgentData = slotResults.flatMap(slot => slot.agentData);
    const uniqueAgents = new Set(allAgentData.map(r => `${r.agentName}_${r.extension}`));
    
    const summary = {
      totalAgents: uniqueAgents.size,
      totalTimeSlots: timeSlots.length,
      timeRange: `${startDateTime} to ${endDateTime}`,
      slotBreakdown: timeSlots.map(slot => ({
        slotNumber: slot.slotNumber,
        timeRange: slot.label,
        duration: `${slot.duration} minutes`
      })),
      generatedAt: new Date().toISOString()
    };
    
    const result = {
      success: true,
      summary,
      reportData: allAgentData,
      timeSlots,
      slotResults
    };
    
    console.log(`✅ Generated slot-wise report with ${allAgentData.length} records across ${timeSlots.length} slots`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating slot-wise agent report with separate API calls:', error);
    throw error;
  }
}

/**
 * Parse date time string in various formats
 * @param {string} dateTimeString - Date time string to parse
 * @returns {Date} - Parsed Date object
 */
function parseDateTimeString(dateTimeString) {
  if (!dateTimeString) return new Date();
  
  try {
    // Handle various date formats
    if (dateTimeString.includes(',')) {
      // Format: DD/MM/YYYY, HH:MM(AM/PM)
      const [datePart, timePart] = dateTimeString.split(',').map(part => part.trim());
      const [day, month, year] = datePart.split('/').map(Number);
      
      let hours = 0;
      let minutes = 0;
      
      if (timePart) {
        const timeMatch = timePart.match(/(\d+):(\d+)([APap][Mm])?/);
        if (timeMatch) {
          hours = parseInt(timeMatch[1]);
          minutes = parseInt(timeMatch[2]);
          
          // Handle AM/PM
          const ampm = timeMatch[3]?.toUpperCase();
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }
      
      return new Date(year, month - 1, day, hours, minutes);
    } else {
      // Try standard date parsing
      return new Date(dateTimeString);
    }
  } catch (error) {
    console.error(`❌ Error parsing date string: ${dateTimeString}`, error);
    return new Date();
  }
}

/**
 * Format duration to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration string
 */
function formatDurationToHHMMSS(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate time slots between start and end times
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {Array} - Array of time slot objects
 */
function generateSlotWiseTimeSlots(startTime, endTime) {
  const slots = [];
  const startHour = startTime.getHours();
  const startMinute = startTime.getMinutes();
  const endHour = endTime.getHours();
  const endMinute = endTime.getMinutes();
  
  // Create a copy of the start time to manipulate
  let currentSlotStart = new Date(startTime);
  let slotNumber = 1;
  
  // First slot: from start time to the next hour mark (or end time if earlier)
  let firstSlotEnd;
  if (startMinute > 0) {
    // Go to the next hour mark
    firstSlotEnd = new Date(startTime);
    firstSlotEnd.setHours(startHour + 1, 0, 0, 0);
    
    // If the next hour mark is after the end time, use the end time
    if (firstSlotEnd > endTime) {
      firstSlotEnd = new Date(endTime);
    }
    
    // Add the first slot
    const firstSlotDuration = Math.round((firstSlotEnd - currentSlotStart) / (60 * 1000));
    if (firstSlotDuration >= 1) {
      slots.push({
        slotNumber: slotNumber++,
        start: new Date(currentSlotStart),
        end: new Date(firstSlotEnd),
        label: `${formatTimeDubai(currentSlotStart)} - ${formatTimeDubai(firstSlotEnd)}`,
        duration: firstSlotDuration
      });
    }
    
    // Update current slot start for the next iteration
    currentSlotStart = new Date(firstSlotEnd);
  }
  
  // Generate hourly slots until we reach the end time
  while (currentSlotStart < endTime) {
    // Set the end of this slot to be one hour later or the end time, whichever is earlier
    const hourlySlotEnd = new Date(currentSlotStart);
    hourlySlotEnd.setHours(hourlySlotEnd.getHours() + 1);
    
    const slotEnd = hourlySlotEnd > endTime ? new Date(endTime) : hourlySlotEnd;
    
    // Calculate duration in minutes
    const slotDuration = Math.round((slotEnd - currentSlotStart) / (60 * 1000));
    
    // Only add slots with a duration of at least 1 minute
    if (slotDuration >= 1) {
      slots.push({
        slotNumber: slotNumber++,
        start: new Date(currentSlotStart),
        end: new Date(slotEnd),
        label: `${formatTimeDubai(currentSlotStart)} - ${formatTimeDubai(slotEnd)}`,
        duration: slotDuration
      });
    }
    
    // Move to the next slot
    currentSlotStart = new Date(slotEnd);
  }
  
  return slots;
}

// Export functions
export {
  formatTimestampDubai,
  formatTimeDubai,
  getCurrentDubaiTime,
  convertDubaiInputToUTC,
  fetchAgentStatsData,
  fetchAgentEventsData,
  fetchSlotWiseAgentEvents,
  generateSimplifiedAgentReport,
  processSimplifiedAgentData,
  displaySimplifiedAgentReport,
  generateSlotWiseTimeSlots,
  processAgentDataForSlotWiseReport,
  calculateSlotWiseCallMetrics,
  distributeTimeAcrossSlots,
  generateSlotWiseAgentReport,
  generateSlotWiseAgentReportWithSeparateApiCalls,
  parseDateTimeString
};

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node agentEvents.js <tenant> <startDateTime> <endDateTime> [agentName] [extension]');
    console.log('Example: node agentEvents.js shams "2025-08-14T08:00:00" "2025-08-14T18:00:00"');
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