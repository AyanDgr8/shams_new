// server.js

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { fetchAgentStatus } from './agentStatus.js';
import { generateSimplifiedAgentReport } from './agentEvents.js';
import { getPortalToken, httpsAgent } from './tokenService.js';
import axios from 'axios';
import https from 'https';
import fs from 'fs';

dotenv.config();

// Debug: Log environment variables to verify they're loaded correctly
console.log('🔧 Environment variables loaded:');
console.log(`   PORT: ${process.env.PORT}`);
console.log(`   HOST: ${process.env.HOST}`);
console.log(`   PUBLIC_URL: ${process.env.PUBLIC_URL}`);

const app = express();
app.use(express.json()); // parse JSON bodies
const PORT = process.env.PORT || 5555;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 ensures the server binds to all network interfaces
const PUBLIC_URL = process.env.PUBLIC_URL || `https://${HOST}:${PORT}`;

console.log(`🚀 Server will start on: ${PUBLIC_URL}`);

// Helper to resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// Simplified Agent Report Endpoint (main endpoint)
app.get('/api/agent-report', async (req, res) => {
  const { tenant, startDateTime, endDateTime, agentName, extension } = req.query;
  
  if (!tenant || !startDateTime || !endDateTime) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameters: tenant, startDateTime, endDateTime' 
    });
  }

  try {
    console.log(`📊 Generating simplified agent report...`);
    console.log(`📅 Parameters: tenant=${tenant}, start=${startDateTime}, end=${endDateTime}`);
    console.log(`🎯 Filters: agentName=${agentName || 'All'}, extension=${extension || 'All'}`);

    const reportData = await generateSimplifiedAgentReport(
      tenant,
      startDateTime,
      endDateTime,
      agentName,
      extension
    );

    console.log(`✅ Report generated successfully`);
    console.log(`📊 Summary: ${reportData.agents?.length || 0} agents, ${reportData.summary?.totalCalls || 0} total calls`);

    res.json(reportData);
  } catch (error) {
    console.error('❌ Error generating simplified agent report:', error);
    res.status(500).json({
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
    });
  }
});

// Legacy endpoint for backward compatibility
app.get('/api/agents', async (req, res) => {
  const { account, start, end, agentName, extension } = req.query;
  
  if (!account || !start || !end) {
    return res.status(400).json({ error: 'Missing account, start or end query params' });
  }

  try {
    const reportData = await generateSimplifiedAgentReport(
      account,
      start,
      end,
      agentName,
      extension
    );

    // Return in legacy format
    res.json({
      data: reportData.agents || [],
      summary: reportData.summary
    });
  } catch (error) {
    console.error('❌ Error in legacy endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      data: []
    });
  }
});

// Agent Status Endpoint (for compatibility)
app.get('/api/agent-status', async (req, res) => {
  const { tenant, start, end, agentName, extension } = req.query;
  
  if (!tenant || !start || !end) {
    return res.status(400).json({ error: 'Missing tenant, start or end query params' });
  }

  try {
    const reportData = await generateSimplifiedAgentReport(
      tenant,
      start,
      end,
      agentName,
      extension
    );

    // Return agents array directly (not wrapped in data object)
    res.json(reportData.agents || []);
  } catch (error) {
    console.error('❌ Error in agent status endpoint:', error);
    res.status(500).json([]);
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
    
    console.log("🔒 SSL certificates loaded successfully");
    return sslOptions;
  } catch (error) {
    console.error("❌ Error loading SSL certificates:", error.message);
    
    // Check if SSL files exist
    const sslFiles = ['ssl/privkey.pem', 'ssl/fullchain.pem'];
    sslFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        console.error(`❌ SSL file not found: ${file}`);
      }
    });
    
    console.log("⚠️  Falling back to HTTP server");
    return null;
  }
};

const sslOptions = loadSSLCertificates();

// Only use HTTPS if PUBLIC_URL starts with https://
const useHTTPS = PUBLIC_URL.startsWith('https://');

if (sslOptions && useHTTPS) {
  const server = https.createServer(sslOptions, app);
  server.listen(PORT, HOST, () => {
    console.log(`🔐 HTTPS server running at ${PUBLIC_URL}`);
    console.log(`🌐 Server accessible on all network interfaces (${HOST}:${PORT})`);
  });
  
  server.on('error', (err) => {
    console.error('❌ HTTPS Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
    } else if (err.code === 'EACCES') {
      console.error(`❌ Permission denied. Port ${PORT} might require sudo privileges.`);
    }
    process.exit(1);
  });
} else {
  const server = app.listen(PORT, HOST, () => {
    console.log(`🌐 HTTP server running at ${PUBLIC_URL}`);
    if (!useHTTPS) {
      console.log(`⚠️  Running in HTTP mode (PUBLIC_URL is set to HTTP)`);
    } else {
      console.log(`⚠️  Running in HTTP mode (no SSL certificates found)`);
    }
  });
  
  server.on('error', (err) => {
    console.error('❌ HTTP Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
    } else if (err.code === 'EACCES') {
      console.error(`❌ Permission denied. Port ${PORT} might require sudo privileges.`);
    }
    process.exit(1);
  });
}
