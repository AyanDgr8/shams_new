// public/script.js - Simplified Frontend for Agent Activity Report

console.log('🚀 Simplified Agent Activity Report Frontend - Version 2025-08-14');

/* global axios */

// Check if all required elements exist
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔍 DOM Content Loaded - Checking elements...');
  
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

  // Debug: Check if elements exist
  console.log('📋 Element check:');
  console.log(`   form: ${form ? '✅' : '❌'}`);
  console.log(`   errorBox: ${errorBox ? '✅' : '❌'}`);
  console.log(`   loading: ${loading ? '✅' : '❌'}`);
  console.log(`   reportContainer: ${reportContainer ? '✅' : '❌'}`);
  console.log(`   axios available: ${typeof axios !== 'undefined' ? '✅' : '❌'}`);

  if (!form) {
    console.error('❌ CRITICAL: Form element not found!');
    return;
  }

  if (typeof axios === 'undefined') {
    console.error('❌ CRITICAL: Axios library not loaded!');
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'color: red; padding: 20px; text-align: center; font-weight: bold;';
    errorMsg.textContent = 'Error: Required libraries not loaded. Please refresh the page.';
    document.body.insertBefore(errorMsg, document.body.firstChild);
    return;
  }

  // Set default Dubai times
  setDefaultDubaiTimes();
  console.log('✅ Default times set');
});

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
    // Handle numeric timestamps properly - check digit length
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
 * Format time only in Dubai timezone (HH:MM AM/PM)
 * @param {number|string|Date} timestamp - Unix timestamp (seconds/milliseconds), ISO string, or Date object
 * @returns {string} - Formatted time string in Dubai timezone (HH:MM AM/PM)
 */
function formatTimeDubai(timestamp) {
  if (!timestamp) return '';
  
  let date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    // Handle numeric timestamps properly - check digit length
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
  
  // Parse as Dubai time and convert to UTC
  const dubaiDate = new Date(dateTimeString + '+04:00'); // Dubai is UTC+4
  return dubaiDate.toISOString();
};

/**
 * Set default times to Dubai timezone (8 hours ago to now)
 */
function setDefaultDubaiTimes() {
  const now = new Date();
  const eightHoursAgo = new Date(now.getTime() - (8 * 60 * 60 * 1000));
  
  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
  const formatForInput = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  document.getElementById('startDateTime').value = formatForInput(eightHoursAgo);
  document.getElementById('endDateTime').value = formatForInput(now);
}

/**
 * Convert duration from seconds to HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration string (HH:MM:SS)
 */
function formatDurationToHHMMSS(seconds) {
  if (!seconds || seconds === null || seconds === undefined) return '00:00:00';
  
  const totalSeconds = Math.abs(Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp to "dd/mm, 11:59 AM" format
 */
function formatTimestampToDateAndTime(timestamp) {
  if (!timestamp || timestamp === 'N/A') return 'N/A';
  
  try {
    // Handle different timestamp formats
    let date;
    if (typeof timestamp === 'string' && timestamp.includes(':')) {
      // If it's already a formatted time string like "11:59 AM", we need to add date
      if (timestamp.includes('AM') || timestamp.includes('PM')) {
        // This is just a time string - we need to get the actual date from context
        // For now, return as-is but this should be handled by the calling function
        return timestamp; // This will be fixed by using proper timestamps
      } else {
        // Try to parse as ISO string or other date format
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'number') {
      // Handle numeric timestamps properly - check digit length
      let timestampMs;
      if (timestamp.toString().length <= 10) {
        // Unix timestamp in seconds - convert to milliseconds
        timestampMs = timestamp * 1000;
      } else {
        // Already in milliseconds
        timestampMs = timestamp;
      }
      date = new Date(timestampMs);
    } else {
      // Try to parse as date string
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return timestamp; // Return original if can't parse
    }
    
    // Format to "dd/mm, 11:59 AM" using Dubai timezone
    const day = date.toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: '2-digit' });
    const month = date.toLocaleString('en-AE', { timeZone: 'Asia/Dubai', month: '2-digit' });
    const timeString = date.toLocaleString('en-AE', { 
      timeZone: 'Asia/Dubai',
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    return `${day}/${month}, ${timeString}`;
  } catch (error) {
    console.warn('Error formatting timestamp:', timestamp, error);
    return timestamp; // Return original on error
  }
}

/**
 * Display simplified agent report
 */
function displaySimplifiedAgentReport(reportData) {
  if (!reportData.success) {
    showError(`Report generation failed: ${reportData.error}`);
    return;
  }
  
  const { summary, agents } = reportData;
  
  // Update report header
  reportHeader.innerHTML = `
    <div class="report-title">
      <h2>📊 Agent Activity Report</h2>
      <p class="report-subtitle">Simplified Single-Row Format</p>
    </div>
    <div class="report-meta">
      <p><strong>Time Range:</strong> ${summary.timeRange.startFormatted} to ${summary.timeRange.endFormatted}</p>
      <p><strong>Generated:</strong> ${reportData.timestamp}</p>
    </div>
  `;
  
  // Update statistics
  updateSimplifiedStatistics(summary);
  
  // Create agent table
  const tableHtml = createSimplifiedAgentTable(agents);
  reportContent.innerHTML = tableHtml;
  
  // Show report container and filters
  reportContainer.style.display = 'block';
  exportSection.style.display = 'block';
  if (filtersGrid) filtersGrid.style.display = 'grid';
  
  // Store data for filtering and export
  currentReportData = reportData;
  filteredReportData = agents;
  
  console.log(`✅ Displayed report with ${agents.length} agents`);
}

/**
 * Create simplified agent table
 */
function createSimplifiedAgentTable(agents) {
  if (!agents || agents.length === 0) {
    return '<div class="no-data">No agent data available for the selected time range.</div>';
  }
  
  let tableHtml = `
    <div class="table-container">
      <table class="agent-table">
        <thead>
          <tr>
            <th>Agent Name</th>
            <th>Extension</th>
            <th>Total Calls</th>
            <th>Answered</th>
            <th>Failed</th>
            <th>Total Wrap Up Time</th>
            <th>Total Not Available Time</th>
            <th>Total Hold Time</th>
            <th>Total On Call Time</th>
            <th>AHT</th>
            <th>Agent States</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  agents.forEach(agent => {
    const customStatesHtml = formatCustomStatesForDisplay(agent.customStates);
    
    tableHtml += `
      <tr>
        <td><strong>${agent.agentName}</strong></td>
        <td>${agent.extension}</td>
        <td>${agent.totalCalls}</td>
        <td>${agent.answered}</td>
        <td>${agent.failed}</td>
        <td>${agent.totalWrapUpTime}</td>
        <td>${agent.totalNotAvailableTime}</td>
        <td>${agent.totalHoldTime}</td>
        <td>${agent.totalOnCallTime}</td>
        <td>${agent.aht}</td>
        <td class="custom-states-cell">${customStatesHtml}</td>
      </tr>
    `;
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  return tableHtml;
}

/**
 * Format custom states for display
 */
function formatCustomStatesForDisplay(customStates) {
  if (!customStates || customStates.length === 0) {
    return '<span class="no-activity">No custom states</span>';
  }
  
  let statesHtml = '<div class="custom-states-container">';
  customStates.forEach(stateBlock => {
    const durationText = stateBlock.duration !== null ? `(${formatDurationToHHMMSS(stateBlock.duration)})` : '';
    const formattedStartTime = formatTimestampToDateAndTime(stateBlock.startTime);
    const formattedEndTime = formatTimestampToDateAndTime(stateBlock.endTime);
    
    statesHtml += `
      <div class="custom-state-block">
        <strong>${stateBlock.state}</strong>
        <span class="state-time">(${formattedStartTime} → ${formattedEndTime})</span>
        <span class="state-duration">${durationText}</span>
      </div>
    `;
  });
  statesHtml += '</div>';
  
  return statesHtml;
}

/**
 * Format custom states for CSV export
 */
function formatCustomStatesForCSV(customStates) {
  if (!customStates || customStates.length === 0) {
    return 'No custom states';
  }
  
  const stateTexts = [];
  customStates.forEach(stateBlock => {
    const duration = stateBlock.duration !== null ? formatDurationToHHMMSS(stateBlock.duration) : 'CONTINUED';
    stateTexts.push(`${stateBlock.state}: ${stateBlock.startTime} - ${stateBlock.endTime} (${duration})`);
  });
  
  return stateTexts.join('; ');
}

/**
 * Update simplified statistics display
 */
function updateSimplifiedStatistics(summary) {
  const statsHtml = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${summary.totalAgents}</div>
        <div class="stat-label">Total Agents</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.totalCalls}</div>
        <div class="stat-label">Total Calls</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.totalAnswered}</div>
        <div class="stat-label">Answered Calls</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.totalFailed}</div>
        <div class="stat-label">Failed Calls</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.answerRate}%</div>
        <div class="stat-label">Answer Rate</div>
      </div>
    </div>
  `;
  
  // Update or create statistics section
  let statsSection = document.getElementById('statisticsSection');
  if (!statsSection) {
    statsSection = document.createElement('div');
    statsSection.id = 'statisticsSection';
    statsSection.className = 'statistics-section';
    reportContainer.insertBefore(statsSection, reportContent);
  }
  
  statsSection.innerHTML = `
    <h3>📈 Report Statistics</h3>
    ${statsHtml}
  `;
}

/**
 * Apply filters to the current report data
 */
function applyFilters() {
  if (!currentReportData || !currentReportData.agents) return;
  
  const agentNameFilter = document.getElementById('nameFilter').value.toLowerCase();
  const extensionFilter = document.getElementById('extFilter').value.toLowerCase();
  
  filteredReportData = currentReportData.agents.filter(agent => {
    const nameMatch = !agentNameFilter || agent.agentName.toLowerCase().includes(agentNameFilter);
    const extMatch = !extensionFilter || agent.extension.toString().includes(extensionFilter);
    return nameMatch && extMatch;
  });
  
  // Update display with filtered data
  const tableHtml = createSimplifiedAgentTable(filteredReportData);
  reportContent.innerHTML = tableHtml;
  
  // Update statistics for filtered data
  const filteredSummary = {
    totalAgents: filteredReportData.length,
    totalCalls: filteredReportData.reduce((sum, agent) => sum + agent.totalCalls, 0),
    totalAnswered: filteredReportData.reduce((sum, agent) => sum + agent.answered, 0),
    totalFailed: filteredReportData.reduce((sum, agent) => sum + agent.failed, 0)
  };
  filteredSummary.answerRate = filteredSummary.totalCalls > 0 ? 
    ((filteredSummary.totalAnswered / filteredSummary.totalCalls) * 100).toFixed(1) : '0.0';
  
  updateSimplifiedStatistics(filteredSummary);
  
  console.log(`🔍 Applied filters: ${filteredReportData.length} agents shown`);
}

/**
 * Export to CSV
 */
function exportToCSV() {
  if (!filteredReportData || filteredReportData.length === 0) {
    showError('No data available to export');
    return;
  }
  
  const headers = [
    'Agent Name', 'Extension', 'Total Calls', 'Answered', 'Failed',
    'Total Wrap Up Time', 'Total Not Available Time', 'Total Hold Time',
    'Total On Call Time', 'AHT', 'Agent States'
  ];
  
  let csvContent = headers.join(',') + '\n';
  
  filteredReportData.forEach(agent => {
    const customStatesText = formatCustomStatesForCSV(agent.customStates);
    
    const row = [
      `"${agent.agentName}"`,
      agent.extension,
      agent.totalCalls,
      agent.answered,
      agent.failed,
      `"${agent.totalWrapUpTime}"`,
      `"${agent.totalNotAvailableTime}"`,
      `"${agent.totalHoldTime}"`,
      `"${agent.totalOnCallTime}"`,
      `"${agent.aht}"`,
      `"${customStatesText}"`
    ];
    
    csvContent += row.join(',') + '\n';
  });
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `agent_activity_report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('📊 CSV export completed');
}

/**
 * Show error message
 */
function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = 'block';
  loading.style.display = 'none';
  reportContainer.style.display = 'none';
  exportSection.style.display = 'none';
}

/**
 * Hide error message
 */
function hideError() {
  errorBox.style.display = 'none';
}

/**
 * Show loading state
 */
function showLoading() {
  loading.style.display = 'block';
  hideError();
  reportContainer.style.display = 'none';
  exportSection.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
  loading.style.display = 'none';
}

// Event Listeners
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  showLoading();
  hideError();
  
  try {
    const formData = new FormData(e.target);
    const tenant = formData.get('tenant');
    const startDateTime = formData.get('startDateTime');
    const endDateTime = formData.get('endDateTime');
    const agentName = formData.get('agentName');
    const extension = formData.get('extension');
    
    console.log('📊 Fetching simplified agent report...');
    console.log('Parameters:', { tenant, startDateTime, endDateTime, agentName, extension });
    
    const params = new URLSearchParams({
      tenant,
      startDateTime: convertDubaiInputToUTC(startDateTime),
      endDateTime: convertDubaiInputToUTC(endDateTime)
    });
    
    if (agentName) params.append('agentName', agentName);
    if (extension) params.append('extension', extension);
    
    const response = await axios.get(`/api/agent-report?${params.toString()}`);
    
    hideLoading();
    displaySimplifiedAgentReport(response.data);
    
  } catch (error) {
    hideLoading();
    console.error('❌ Error fetching report:', error);
    
    if (error.response) {
      showError(`Server Error: ${error.response.data.error || error.response.statusText}`);
    } else if (error.request) {
      showError('Network Error: Unable to connect to server');
    } else {
      showError(`Error: ${error.message}`);
    }
  }
});

// CSV Export button
if (csvBtn) {
  csvBtn.addEventListener('click', exportToCSV);
}

// Filter inputs - use correct element IDs from HTML
const nameFilter = document.getElementById('nameFilter');
const extFilter = document.getElementById('extFilter');

if (nameFilter) {
  nameFilter.addEventListener('input', applyFilters);
}

if (extFilter) {
  extFilter.addEventListener('input', applyFilters);
}

// New Report button
const newReportBtn = document.getElementById('newReportBtn');
if (newReportBtn) {
  newReportBtn.addEventListener('click', () => {
    // Hide report sections
    if (reportContainer) reportContainer.style.display = 'none';
    if (reportHeader) reportHeader.style.display = 'none';
    if (exportSection) exportSection.style.display = 'none';
    if (filtersGrid) filtersGrid.style.display = 'none';
    if (filtersBox) filtersBox.style.display = 'block';
    
    // Clear current data
    currentReportData = null;
    filteredReportData = null;
    
    // Reset form
    const form = document.getElementById('filterForm');
    if (form) {
      form.reset();
      setDefaultDubaiTimes();
    }
    
    hideError();
    console.log('🔄 Ready for new report');
  });
}

// Initialize page
console.log('🎯 Simplified Agent Activity Report initialized');