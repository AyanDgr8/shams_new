// logger.js - Logging utility for agent state transitions
import fs from 'fs';
import path from 'path';
import { formatTimestampDubai } from './agentEvents.js';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Log levels with their corresponding colors
const logLevels = {
  debug: { color: colors.cyan, prefix: ' DEBUG' },
  info: { color: colors.green, prefix: ' INFO' },
  warn: { color: colors.yellow, prefix: ' WARN' },
  error: { color: colors.red, prefix: ' ERROR' },
  state: { color: colors.magenta, prefix: ' STATE' },
  command: { color: colors.blue, prefix: ' COMMAND' }
};

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create combined logs directory for report generation logs
const getCombinedLogsDir = () => {
  const dateStr = getLogDate();
  const combinedLogsDir = path.join(logsDir, `combined_logs_${dateStr}`);
  
  if (!fs.existsSync(combinedLogsDir)) {
    fs.mkdirSync(combinedLogsDir, { recursive: true });
  }
  
  return combinedLogsDir;
};

// Get current date for log file names and folders
const getLogDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Get current timestamp for log entries
const getLogTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

// Get or create daily log directory
const getDailyLogDir = () => {
  const dateStr = getLogDate();
  const dailyDir = path.join(logsDir, dateStr);
  
  if (!fs.existsSync(dailyDir)) {
    fs.mkdirSync(dailyDir, { recursive: true });
  }
  
  return dailyDir;
};

// Create log file paths with daily folders
const getDailyLogFile = (prefix = 'app') => {
  const dailyDir = getDailyLogDir();
  return path.join(dailyDir, `${prefix}-${getLogDate()}.log`);
};

// Get unique command log filename based on timestamp
const getCommandLogFile = (command) => {
  const dailyDir = getDailyLogDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedCommand = command.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
  return path.join(dailyDir, `cmd-${sanitizedCommand}-${timestamp}.log`);
};

// Store logs for the current report generation session
let currentReportLogs = [];
let reportSessionActive = false;

/**
 * Start a new report generation session
 * This will begin capturing logs for this report generation
 */
function startReportSession() {
  currentReportLogs = [];
  reportSessionActive = true;
  log('Starting new report generation session', 'info');
}

/**
 * End the current report generation session and save logs to a separate file
 * @returns {string} Path to the saved log file
 */
function endReportSession() {
  if (!reportSessionActive || currentReportLogs.length === 0) {
    log('No active report session or no logs to save', 'warn');
    return null;
  }
  
  const combinedLogsDir = getCombinedLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFilePath = path.join(combinedLogsDir, `combined_logs_${timestamp}.log`);
  
  // Write all logs to the file
  fs.writeFileSync(logFilePath, currentReportLogs.join('\n') + '\n');
  
  log(`Report session logs saved to: ${logFilePath}`, 'info');
  reportSessionActive = false;
  currentReportLogs = [];
  
  return logFilePath;
}

/**
 * Log a message to console and file
 * @param {string} message - Message to log
 * @param {string} level - Log level (debug, info, warn, error, state, command)
 */
function log(message, level = 'info') {
  const logLevel = logLevels[level] || logLevels.info;
  const timestamp = getLogTimestamp();
  const formattedMessage = `[${timestamp}] ${logLevel.prefix}: ${message}`;
  
  // Console output with color
  console.log(`${logLevel.color}${formattedMessage}${colors.reset}`);
  
  // File output without color
  const logFile = getDailyLogFile();
  fs.appendFileSync(logFile, `${formattedMessage}\n`);
  
  // Add to current report logs if session is active
  if (reportSessionActive) {
    currentReportLogs.push(formattedMessage);
  }
}

/**
 * Log a state transition
 * @param {Object} event - State transition event
 * @param {Array} targetStates - Optional array of states to filter by
 */
function logStateTransition(event, targetStates = null) {
  if (!event) return;
  
  const state = event.state || event.event;
  
  // Skip if we're filtering by target states and this state isn't in the list
  if (targetStates && !targetStates.includes(state)) return;
  
  const timestamp = event.Timestamp || event.timestamp;
  const username = event.username || 'Unknown';
  const extension = event.extension || 'Unknown';
  const formattedTime = formatTimestampDubai ? formatTimestampDubai(new Date(timestamp)) : new Date(timestamp).toLocaleString();
  
  const logEntry = `[${timestamp}] ${username} (${extension}) → ${state} at ${formattedTime}`;
  
  // Log to console with color
  console.log(`${colors.magenta} STATE: ${logEntry}${colors.reset}`);
  
  // Log to state transitions file
  const stateTransitionsLogFile = getDailyLogFile('state-transitions');
  fs.appendFileSync(stateTransitionsLogFile, `${logEntry}\n`);
  
  // Add to current report logs if session is active
  if (reportSessionActive) {
    currentReportLogs.push(`STATE: ${logEntry}`);
  }
}

/**
 * Log multiple state transitions
 * @param {Array} events - Array of state transition events
 * @param {Array} targetStates - Optional array of states to filter by
 */
function logStateTransitions(events, targetStates = null) {
  if (!Array.isArray(events) || events.length === 0) {
    log('No events to log', 'warn');
    return;
  }
  
  // Batch write to file for better performance
  const logEntries = [];
  
  events.forEach(event => {
    const state = event.state || event.event;
    
    // Skip if we're filtering by target states and this state isn't in the list
    if (targetStates && !targetStates.includes(state)) return;
    
    const timestamp = event.Timestamp || event.timestamp;
    const username = event.username || 'Unknown';
    const extension = event.extension || 'Unknown';
    const formattedTime = formatTimestampDubai ? formatTimestampDubai(new Date(timestamp)) : new Date(timestamp).toLocaleString();
    
    const logEntry = `[${timestamp}] ${username} (${extension}) → ${state} at ${formattedTime}`;
    logEntries.push(logEntry);
    
    // Log to console with color
    console.log(`${colors.magenta} STATE: ${logEntry}${colors.reset}`);
    
    // Add to current report logs if session is active
    if (reportSessionActive) {
      currentReportLogs.push(`STATE: ${logEntry}`);
    }
  });
  
  // Write all entries to file at once
  if (logEntries.length > 0) {
    const stateTransitionsLogFile = getDailyLogFile('state-transitions');
    fs.appendFileSync(stateTransitionsLogFile, logEntries.join('\n') + '\n');
  }
}

/**
 * Get the contents of the state transitions log
 * @returns {string} - Contents of the state transitions log
 */
function getStateTransitionsLog() {
  const stateTransitionsLogFile = getDailyLogFile('state-transitions');
  if (fs.existsSync(stateTransitionsLogFile)) {
    return fs.readFileSync(stateTransitionsLogFile, 'utf8');
  }
  return '';
}

/**
 * Log command execution with output to a separate file
 * @param {string} command - The command that was executed
 * @param {string} output - The command output
 * @param {number} exitCode - The command exit code
 * @returns {string} - Path to the log file
 */
function logCommandOutput(command, output, exitCode = 0) {
  const timestamp = getLogTimestamp();
  const logFile = getCommandLogFile(command);
  
  const header = [
    `Command: ${command}`,
    `Executed at: ${timestamp}`,
    `Exit code: ${exitCode}`,
    `Working directory: ${process.cwd()}`,
    '------- OUTPUT -------',
    ''
  ].join('\n');
  
  const content = header + output + '\n\n------- END OUTPUT -------\n';
  
  // Write to unique command log file
  fs.writeFileSync(logFile, content);
  
  // Also log to main log
  log(`Executed command: ${command} (exit code: ${exitCode}, log: ${logFile})`, 'command');
  
  // Add to current report logs if session is active
  if (reportSessionActive) {
    currentReportLogs.push(`COMMAND: ${command} (exit code: ${exitCode})`);
    currentReportLogs.push(content);
  }
  
  return logFile;
}

/**
 * List all log files for a specific date
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 * @returns {Array} - Array of log file paths
 */
function listLogFiles(date = getLogDate()) {
  const targetDir = path.join(logsDir, date);
  
  if (!fs.existsSync(targetDir)) {
    return [];
  }
  
  return fs.readdirSync(targetDir)
    .filter(file => file.endsWith('.log'))
    .map(file => path.join(targetDir, file));
}

/**
 * List all combined log files for report generations
 * @returns {Array} - Array of combined log file paths
 */
function listCombinedLogFiles() {
  const dateStr = getLogDate();
  const combinedLogsDir = path.join(logsDir, `combined_logs_${dateStr}`);
  
  if (!fs.existsSync(combinedLogsDir)) {
    return [];
  }
  
  return fs.readdirSync(combinedLogsDir)
    .filter(file => file.startsWith('combined_logs_'))
    .map(file => path.join(combinedLogsDir, file));
}

export { 
  log, 
  logStateTransition, 
  logStateTransitions, 
  getStateTransitionsLog,
  logCommandOutput,
  listLogFiles,
  getDailyLogDir,
  startReportSession,
  endReportSession,
  listCombinedLogFiles
};
