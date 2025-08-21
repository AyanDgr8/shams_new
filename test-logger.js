// test-logger.js - Test script to verify logger functionality
import logger from './logger.js';
import fs from 'fs';
import path from 'path';

// Test basic logging
console.log('Testing basic logging...');
logger.log('This is a test info message', 'info');
logger.log('This is a test debug message', 'debug');
logger.log('This is a test warning message', 'warn');
logger.log('This is a test error message', 'error');

// Test state transition logging
console.log('Testing state transition logging...');
const testEvent = {
  state: 'available',
  Timestamp: Date.now(),
  username: 'Test User',
  extension: '1234'
};
logger.logStateTransition(testEvent);

// Test multiple state transitions
console.log('Testing multiple state transitions...');
const testEvents = [
  {
    state: 'available',
    Timestamp: Date.now(),
    username: 'Test User 1',
    extension: '1234'
  },
  {
    state: 'Not Available',
    Timestamp: Date.now() + 1000,
    username: 'Test User 2',
    extension: '5678'
  }
];
logger.logStateTransitions(testEvents);

// Test command output logging
console.log('Testing command output logging...');
const commandLogFile = logger.logCommandOutput('test-command', 'This is test command output', 0);
console.log(`Command log file created: ${commandLogFile}`);

// List log files
console.log('Listing log files...');
const logFiles = logger.listLogFiles();
console.log(`Found ${logFiles.length} log files:`);
logFiles.forEach(file => console.log(` - ${file}`));

// Show logs directory
const logsDir = logger.getDailyLogDir();
console.log(`Logs directory: ${logsDir}`);
console.log(`Directory exists: ${fs.existsSync(logsDir)}`);

// List directory contents if it exists
if (fs.existsSync(logsDir)) {
  console.log('Directory contents:');
  fs.readdirSync(logsDir).forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    console.log(` - ${file} (${stats.isDirectory() ? 'directory' : 'file'}, ${stats.size} bytes)`);
  });
}
