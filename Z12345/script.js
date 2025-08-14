// public/script.js - Simplified Frontend for Agent Activity Report

console.log('🚀 Simplified Agent Activity Report Frontend - Version 2025-08-14');

/* global axios */
const form = document.getElementById('filterForm');
const errorBox = document.getElementById('error');
const loading = document.getElementById('loading');
const reportContainer = document.getElementById('reportContainer');
const reportContent = document.getElementById('reportContent');
const csvBtn = document.getElementById('csvBtn');
const reportHeader = document.getElementById('reportHeader');
const filtersGrid = document.getElementById('filtersGrid');
const exportSection = document.getElementById('exportSection');
const filtersBox = document.getElementById('filtersBox');

let currentReportData = null;
let filteredReportData = null;

/**
 * Format any timestamp to Dubai timezone with full date and time
 * @param {number|string|Date} timestamp - Unix timestamp (seconds/milliseconds), ISO string, or Date object
 * @returns {string} - Formatted datetime string in Dubai timezone (DD/MM/YYYY, HH:MM:SS)
 */
function formatTimestampDubai(timestamp) {
  if (!timestamp) return '';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    // Handle both seconds and milliseconds timestamps
    const timestampMs = timestamp < 946684800000 ? timestamp * 1000 : timestamp;
    date = new Date(timestampMs);
  }
  
  if (isNaN(date.getTime())) return '';
  
  // Format as DD/MM/YYYY, HH:MM:SS in Dubai timezone
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Format time only in Dubai timezone (HH:MM)
 * @param {number|string|Date} timestamp - Unix timestamp (seconds/milliseconds), ISO string, or Date object
 * @returns {string} - Formatted time string in Dubai timezone (HH:MM)
 */
function formatTimeDubai(timestamp) {
  if (!timestamp) return '';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    // Handle both seconds and milliseconds timestamps
    const timestampMs = timestamp < 946684800000 ? timestamp * 1000 : timestamp;
    date = new Date(timestampMs);
  }
  
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Get current time in Dubai timezone
 * @returns {string} - Current Dubai time formatted as DD/MM/YYYY, HH:MM:SS
 */
function getCurrentDubaiTime() {
  return formatTimestampDubai(new Date());
}

/**
 * Convert user input (treated as Dubai time) to UTC for API calls
 * @param {string} dateTimeString - Date time string from datetime-local input (YYYY-MM-DDTHH:MM)
 * @returns {string} - UTC ISO string
 */
const convertDubaiInputToUTC = (dateTimeString) => {
  if (!dateTimeString) return '';
  
  // Create date object from input (browser treats this as local time)
  const inputDate = new Date(dateTimeString);
  
  // Return as ISO string for API call
  return inputDate.toISOString();
};

// Set default times to current Dubai time
function setDefaultDubaiTimes() {
  const now = new Date();
  const dubaiNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Dubai"}));
  
  // Set start time to 8 hours ago
  const startTime = new Date(dubaiNow.getTime() - (8 * 60 * 60 * 1000));
  
  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
  const formatForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  document.getElementById('startDateTime').value = formatForInput(startTime);
  document.getElementById('endDateTime').value = formatForInput(dubaiNow);
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 Page loaded, setting default Dubai times...');
  setDefaultDubaiTimes();
  
  // Add form submit handler
  form.addEventListener('submit', handleFormSubmit);
  
  // Add CSV export handler
  csvBtn.addEventListener('click', exportToCSV);
  
  // Add new report button handler
  document.getElementById('newReportBtn').addEventListener('click', showNewReportForm);
  
  // Add filter handlers
  document.getElementById('nameFilter').addEventListener('input', applyFilters);
  document.getElementById('extFilter').addEventListener('input', applyFilters);
});

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(form);
  const tenant = formData.get('tenant');
  const startDateTime = formData.get('startDateTime');
  const endDateTime = formData.get('endDateTime');
  const agentName = formData.get('agentName');
  const extension = formData.get('extension');
  
  if (!tenant || !startDateTime || !endDateTime) {
    showError('Please fill in all required fields');
    return;
  }
  
  try {
    showLoading(true);
    hideError();
    
    console.log('📊 Generating simplified agent report...');
    console.log(`   Tenant: ${tenant}`);
    console.log(`   Time Range: ${startDateTime} to ${endDateTime}`);
    console.log(`   Agent Filter: ${agentName || 'All agents'}`);
    console.log(`   Extension Filter: ${extension || 'All extensions'}`);
    
    // Call the simplified API endpoint
    const response = await axios.get('/api/agent-report', {
      params: {
        tenant,
        startDateTime,
        endDateTime,
        agentName: agentName || undefined,
        extension: extension || undefined
      }
    });
    
    currentReportData = response.data;
    filteredReportData = currentReportData;
    
    console.log(`✅ Report received with ${currentReportData.agents.length} agents`);
    
    // Update header information
    updateReportHeader(currentReportData);
    
    // Display the report
    displaySimplifiedReport(currentReportData);
    
    // Show filters and export options
    showReportControls();
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    showError(error.response?.data?.error || error.message || 'Failed to generate report');
  } finally {
    showLoading(false);
  }
}

/**
 * Display the simplified report
 */
function displaySimplifiedReport(reportData) {
  const { agents } = reportData;
  
  // Debug: Log the first few agents to see their structure
  console.log('🔍 Debug - First agent data structure:', agents[0]);
  console.log('🔍 Debug - Custom states for first agent:', agents[0]?.customStates);
  
  let html = `
    <div class="report-section">
      <h3 class="section-title">Agent Activity Report</h3>
      <div class="table-wrapper">
        <table class="report-table">
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Extension</th>
              <th>Total Calls</th>
              <th>Answered Calls</th>
              <th>Failed Calls</th>
              <th>Total Wrap Up Time</th>
              <th>Total Not Available Time</th>
              <th>Total Hold Time</th>
              <th>Total On Call Time</th>
              <th>AHT</th>
              <th>Custom States</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  if (agents.length === 0) {
    html += `
      <tr>
        <td colspan="11" class="no-data">No agents found for the selected criteria</td>
      </tr>
    `;
  } else {
    agents.forEach((agent, index) => {
      // Debug: Log custom states for each agent
      if (index < 3) { // Only log first 3 agents to avoid spam
        console.log(`🔍 Debug - Agent ${agent.agentName} custom states:`, agent.customStates);
      }
      
      const customStatesText = formatCustomStates(agent.customStates);
      
      // Debug: Log formatted custom states text
      if (index < 3) {
        console.log(`🔍 Debug - Formatted custom states for ${agent.agentName}:`, customStatesText);
      }
      
      html += `
        <tr>
          <td class="agent-name">${agent.agentName}</td>
          <td class="extension">${agent.extension}</td>
          <td class="number">${agent.totalCalls}</td>
          <td class="number answered">${agent.answered}</td>
          <td class="number failed">${agent.failed}</td>
          <td class="duration">${agent.totalWrapUpTime}</td>
          <td class="duration">${agent.totalNotAvailableTime}</td>
          <td class="duration">${agent.totalHoldTime}</td>
          <td class="duration">${agent.totalOnCallTime}</td>
          <td class="duration">${agent.aht}</td>
          <td class="custom-states">${customStatesText}</td>
        </tr>
      `;
    });
  }
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  reportContent.innerHTML = html;
  reportContainer.style.display = 'block';
}

/**
 * Format custom states for display
 */
function formatCustomStates(customStates) {
  // Debug: Log the custom states structure
  console.log('🔍 Debug - formatCustomStates input:', customStates);
  
  if (!customStates) {
    console.log('🔍 Debug - customStates is null/undefined');
    return '<span class="no-states">No custom states</span>';
  }
  
  if (!Array.isArray(customStates)) {
    console.log('🔍 Debug - customStates is not an array:', typeof customStates);
    return '<span class="no-states">Invalid custom states format</span>';
  }
  
  if (customStates.length === 0) {
    console.log('🔍 Debug - customStates array is empty');
    return '<span class="no-states">No custom states</span>';
  }
  
  console.log('🔍 Debug - Processing', customStates.length, 'custom states');
  
  const stateBlocks = customStates.map((state, index) => {
    console.log(`🔍 Debug - State ${index}:`, state);
    
    // Handle different possible data structures
    let displayText = '';
    let stateClass = 'state-default';
    
    if (state.text) {
      // Backend format with formatted text
      displayText = state.text.replace(/\n/g, '<br>');
      stateClass = getStateClass(state.state || 'default');
    } else if (state.state) {
      // Simple state format
      displayText = state.state;
      stateClass = getStateClass(state.state);
    } else if (typeof state === 'string') {
      // String format
      displayText = state;
      stateClass = getStateClass(state);
    } else {
      // Unknown format
      displayText = JSON.stringify(state);
      stateClass = 'state-default';
    }
    
    return `<div class="state-block ${stateClass}">${displayText}</div>`;
  });
  
  const result = `<div class="state-blocks-horizontal">${stateBlocks.join('')}</div>`;
  console.log('🔍 Debug - formatCustomStates result:', result);
  
  return result;
}

/**
 * Get CSS class for state styling
 */
function getStateClass(state) {
  if (!state) return 'state-default';
  
  const stateMap = {
    'available': 'state-available',
    'Available': 'state-available',
    'Login': 'state-login',
    'Logoff': 'state-logoff',
    'Not Available': 'state-not-available',
    'training': 'state-training',
    'Training': 'state-training',
    'Team Meeting': 'state-meeting',
    'lunch': 'state-lunch',
    'Lunch': 'state-lunch',
    'Outbound': 'state-outbound',
    'ON Tickets': 'state-tickets',
    'Tea Break': 'state-break',
    'Break': 'state-break',
    'On Call': 'state-on-call',
    'Wrap Up': 'state-wrap-up',
    'Hold': 'state-hold',
    'No Activity': 'state-no-activity'
  };
  
  return stateMap[state] || 'state-default';
}

/**
 * Update report header information
 */
function updateReportHeader(reportData) {
  document.getElementById('tenantName').textContent = reportData.tenant;
  document.getElementById('startDateTime').textContent = reportData.startDateTime;
  document.getElementById('endDateTime').textContent = reportData.endDateTime;
  document.getElementById('agentFilter').textContent = reportData.agentFilter;
  document.getElementById('extensionFilter').textContent = reportData.extensionFilter;
  
  reportHeader.style.display = 'block';
}

/**
 * Show report controls (filters and export)
 */
function showReportControls() {
  filtersGrid.style.display = 'grid';
  exportSection.style.display = 'block';
  filtersBox.style.display = 'none';
}

/**
 * Show new report form
 */
function showNewReportForm() {
  reportContainer.style.display = 'none';
  reportHeader.style.display = 'none';
  filtersGrid.style.display = 'none';
  exportSection.style.display = 'none';
  filtersBox.style.display = 'block';
  
  // Clear filters
  document.getElementById('nameFilter').value = '';
  document.getElementById('extFilter').value = '';
  
  // Reset form
  form.reset();
  setDefaultDubaiTimes();
  
  currentReportData = null;
  filteredReportData = null;
}

/**
 * Apply filters to the current report
 */
function applyFilters() {
  if (!currentReportData) return;
  
  const nameFilter = document.getElementById('nameFilter').value.toLowerCase();
  const extFilter = document.getElementById('extFilter').value.toLowerCase();
  
  const filteredAgents = currentReportData.agents.filter(agent => {
    const nameMatch = !nameFilter || agent.agentName.toLowerCase().includes(nameFilter);
    const extMatch = !extFilter || agent.extension.toLowerCase().includes(extFilter);
    return nameMatch && extMatch;
  });
  
  filteredReportData = {
    ...currentReportData,
    agents: filteredAgents
  };
  
  displaySimplifiedReport(filteredReportData);
}

/**
 * Export report to CSV
 */
function exportToCSV() {
  if (!filteredReportData || !filteredReportData.agents) {
    showError('No data to export');
    return;
  }
  
  const { agents } = filteredReportData;
  
  // Create CSV headers
  const headers = [
    'Agent Name',
    'Extension', 
    'Total Calls',
    'Answered Calls',
    'Failed Calls',
    'Total Wrap Up Time',
    'Total Not Available Time',
    'Total Hold Time',
    'Total On Call Time',
    'AHT',
    'Custom States'
  ];
  
  // Create CSV rows
  const rows = agents.map(agent => {
    const customStatesText = agent.customStates.map(state => state.text).join('; ');
    
    return [
      agent.agentName,
      agent.extension,
      agent.totalCalls,
      agent.answered,
      agent.failed,
      agent.totalWrapUpTime,
      agent.totalNotAvailableTime,
      agent.totalHoldTime,
      agent.totalOnCallTime,
      agent.aht,
      `"${customStatesText}"` // Wrap in quotes for CSV
    ];
  });
  
  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `agent_activity_report_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('📊 CSV export completed');
}

/**
 * Show loading state
 */
function showLoading(show) {
  loading.style.display = show ? 'block' : 'none';
}

/**
 * Show error message
 */
function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('is-hidden');
  console.error('❌ Error:', message);
}

/**
 * Hide error message
 */
function hideError() {
  errorBox.classList.add('is-hidden');
}