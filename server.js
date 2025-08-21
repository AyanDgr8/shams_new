// server.js

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { generateSimplifiedAgentReport, generateSlotWiseAgentReportWithSeparateApiCalls } from './agentEvents.js';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import { log, logStateTransition, logStateTransitions, getStateTransitionsLog, logCommandOutput, listLogFiles, getDailyLogDir, startReportSession, endReportSession, listCombinedLogFiles } from './logger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Debug: Log environment variables to verify they're loaded correctly
log('Environment variables loaded:', 'info');
log(`PORT: ${process.env.PORT}`, 'info');
log(`HOST: ${process.env.HOST}`, 'info');
log(`PUBLIC_URL: ${process.env.PUBLIC_URL}`, 'info');

const app = express();
app.use(express.json()); // parse JSON bodies
const PORT = process.env.PORT || 5555;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 ensures the server binds to all network interfaces
const PUBLIC_URL = process.env.PUBLIC_URL || `https://${HOST}:${PORT}`;

log(`Server will start on: ${PUBLIC_URL}`, 'info');

// Use __dirname directly since we're using CommonJS
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// Slot-wise Agent Report Endpoint with Separate API Calls per Slot
app.get('/api/slot-wise-agent-report', async (req, res) => {
  const { tenant, startDateTime, endDateTime, agentName, extension } = req.query;
  
  if (!tenant || !startDateTime || !endDateTime) {
    log('Missing required parameters for slot-wise report', 'error');
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameters: tenant, startDateTime, endDateTime' 
    });
  }

  try {
    // Start a new report session to capture all logs
    startReportSession();
    
    log(`Generating slot-wise agent report with separate API calls...`, 'info');
    log(`Parameters: tenant=${tenant}, start=${startDateTime}, end=${endDateTime}`, 'info');
    log(`Filters: agentName=${agentName || 'All'}, extension=${extension || 'All'}`, 'info');

    // Set a longer timeout for this request (2 minutes)
    req.setTimeout(120000);
    
    const reportData = await generateSlotWiseAgentReportWithSeparateApiCalls(
      tenant,
      startDateTime,
      endDateTime,
      agentName,
      extension
    );

    log(`Slot-wise report generated successfully`, 'info');
    log(`Summary: ${reportData.summary?.totalAgents || 0} agents across ${reportData.summary?.totalTimeSlots || 0} time slots`, 'info');

    // End the report session and save logs to a separate file
    const logFilePath = endReportSession();
    if (logFilePath) {
      log(`Report logs saved to: ${logFilePath}`, 'info');
      // Add the log file path to the response
      reportData.logFile = path.basename(logFilePath);
    }

    // Set cache-control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json(reportData);
  } catch (error) {
    log(`Error generating slot-wise agent report: ${error.message}`, 'error');
    
    // End the report session even if there was an error
    const logFilePath = endReportSession();
    
    res.status(500).json({
      success: false,
      error: error.message,
      logFile: logFilePath ? path.basename(logFilePath) : null,
      summary: {
        totalAgents: 0,
        totalTimeSlots: 0,
        timeRange: `${startDateTime} to ${endDateTime}`
      }
    });
  }
});

// Simplified Agent Report Endpoint (main endpoint)
app.get('/api/agent-report', async (req, res) => {
  const { tenant, startDateTime, endDateTime, agentName, extension } = req.query;
  
  if (!tenant || !startDateTime || !endDateTime) {
    log('Missing required parameters for simplified report', 'error');
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameters: tenant, startDateTime, endDateTime' 
    });
  }

  try {
    // Start a new report session to capture all logs
    startReportSession();
    
    log(`Generating simplified agent report...`, 'info');
    log(`Parameters: tenant=${tenant}, start=${startDateTime}, end=${endDateTime}`, 'info');
    log(`Filters: agentName=${agentName || 'All'}, extension=${extension || 'All'}`, 'info');

    const reportData = await generateSimplifiedAgentReport(
      tenant,
      startDateTime,
      endDateTime,
      agentName,
      extension
    );

    log(`Report generated successfully`, 'info');
    log(`Summary: ${reportData.agents?.length || 0} agents, ${reportData.summary?.totalCalls || 0} total calls`, 'info');

    // End the report session and save logs to a separate file
    const logFilePath = endReportSession();
    if (logFilePath) {
      log(`Report logs saved to: ${logFilePath}`, 'info');
      // Add the log file path to the response
      reportData.logFile = path.basename(logFilePath);
    }

    // Set cache-control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json(reportData);
  } catch (error) {
    log(`Error generating simplified agent report: ${error.message}`, 'error');
    
    // End the report session even if there was an error
    const logFilePath = endReportSession();
    
    res.status(500).json({
      success: false,
      error: error.message,
      logFile: logFilePath ? path.basename(logFilePath) : null,
      agents: [],
      summary: {
        totalAgents: 0,
        totalCalls: 0,
        totalAnswered: 0,
        totalFailed: 0,
        answerRate: '0.0'
      }
    });
  }
});

// Legacy endpoint for backward compatibility
app.get('/api/agents', async (req, res) => {
  const { account, start, end, agentName, extension } = req.query;
  
  if (!account || !start || !end) {
    log('Missing required parameters for legacy report', 'error');
    return res.status(400).json({ error: 'Missing account, start or end query params' });
  }

  try {
    // Start a new report session to capture all logs
    startReportSession();
    
    const reportData = await generateSimplifiedAgentReport(
      account,
      start,
      end,
      agentName,
      extension
    );

    // End the report session and save logs to a separate file
    const logFilePath = endReportSession();

    // Return in legacy format
    res.json({
      data: reportData.agents || [],
      summary: reportData.summary,
      logFile: logFilePath ? path.basename(logFilePath) : null
    });
  } catch (error) {
    log(`Error in legacy endpoint: ${error.message}`, 'error');
    
    // End the report session even if there was an error
    const logFilePath = endReportSession();
    
    res.status(500).json({ 
      error: error.message,
      logFile: logFilePath ? path.basename(logFilePath) : null,
      data: []
    });
  }
});

// Agent Status Endpoint (for compatibility)
app.get('/api/agent-status', async (req, res) => {
  const { tenant, start, end, agentName, extension } = req.query;
  
  if (!tenant || !start || !end) {
    log('Missing required parameters for agent status report', 'error');
    return res.status(400).json({ error: 'Missing tenant, start or end query params' });
  }

  try {
    // Start a new report session to capture all logs
    startReportSession();
    
    const reportData = await generateSimplifiedAgentReport(
      tenant,
      start,
      end,
      agentName,
      extension
    );

    // End the report session and save logs to a separate file
    endReportSession();

    // Return agents array directly (not wrapped in data object)
    res.json(reportData.agents || []);
  } catch (error) {
    log(`Error in agent status endpoint: ${error.message}`, 'error');
    
    // End the report session even if there was an error
    endReportSession();
    
    res.status(500).json([]);
  }
});

// Add a new endpoint to list all combined log files
app.get('/api/combined-logs', (req, res) => {
  try {
    const combinedLogs = listCombinedLogFiles();
    res.json({
      success: true,
      logs: combinedLogs.map(filePath => ({
        name: path.basename(filePath),
        path: filePath,
        size: fs.statSync(filePath).size,
        created: fs.statSync(filePath).birthtime
      }))
    });
  } catch (error) {
    log(`Error listing combined logs: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      logs: []
    });
  }
});

// Add an endpoint to download a specific combined log file
app.get('/api/combined-logs/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const dateStr = getLogDate();
    const combinedLogsDir = path.join(logsDir, `combined_logs_${dateStr}`);
    const filePath = path.join(combinedLogsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found'
      });
    }
    
    res.download(filePath);
  } catch (error) {
    log(`Error downloading combined log: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Simplified Agent Activity Report API'
  });
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSL Certificate Management
const loadSSLCertificates = () => {
  try {
    const sslOptions = {
      key: fs.readFileSync('ssl/privkey.pem'),
      cert: fs.readFileSync('ssl/fullchain.pem')
    };
    
    log("SSL certificates loaded successfully", 'info');
    return sslOptions;
  } catch (error) {
    log(`Error loading SSL certificates: ${error.message}`, 'error');
    
    // Check if SSL files exist
    const sslFiles = ['ssl/privkey.pem', 'ssl/fullchain.pem'];
    sslFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        log(`SSL file not found: ${file}`, 'error');
      }
    });
    
    log("Falling back to HTTP server", 'warn');
    return null;
  }
};

const sslOptions = loadSSLCertificates();

// Only use HTTPS if PUBLIC_URL starts with https://
const useHTTPS = PUBLIC_URL.startsWith('https://');

if (sslOptions && useHTTPS) {
  const server = https.createServer(sslOptions, app);
  server.listen(PORT, HOST, () => {
    log(`HTTPS server running at ${PUBLIC_URL}`, 'info');
    log(`Server accessible on all network interfaces (${HOST}:${PORT})`, 'info');
  });
  
  server.on('error', (err) => {
    log(`HTTPS Server error: ${err}`, 'error');
    if (err.code === 'EADDRINUSE') {
      log(`Port ${PORT} is already in use. Try a different port.`, 'error');
    } else if (err.code === 'EACCES') {
      log(`Permission denied. Port ${PORT} might require sudo privileges.`, 'error');
    }
    process.exit(1);
  });
} else {
  const server = app.listen(PORT, HOST, () => {
    log(`HTTP server running at ${PUBLIC_URL}`, 'info');
    if (!useHTTPS) {
      log(`Running in HTTP mode (PUBLIC_URL is set to HTTP)`, 'warn');
    } else {
      log(`Running in HTTP mode (no SSL certificates found)`, 'warn');
    }
  });
  
  server.on('error', (err) => {
    log(`HTTP Server error: ${err}`, 'error');
    if (err.code === 'EADDRINUSE') {
      log(`Port ${PORT} is already in use. Try a different port.`, 'error');
    } else if (err.code === 'EACCES') {
      log(`Permission denied. Port ${PORT} might require sudo privileges.`, 'error');
    }
    process.exit(1);
  });
}
