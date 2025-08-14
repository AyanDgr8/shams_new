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

// Simplified Agent Report Endpoint - Main endpoint for the simplified report
app.get('/api/agent-report', async (req, res) => {
  const { tenant, startDateTime, endDateTime, agentName, extension } = req.query;
  
  if (!tenant || !startDateTime || !endDateTime) {
    return res.status(400).json({ 
      error: 'Missing required parameters: tenant, startDateTime, endDateTime' 
    });
  }

  try {
    console.log('🔍 Processing simplified agent report request:');
    console.log(`   Tenant: ${tenant}`);
    console.log(`   Time Range: ${startDateTime} to ${endDateTime}`);
    console.log(`   Agent Filter: ${agentName || 'All agents'}`);
    console.log(`   Extension Filter: ${extension || 'All extensions'}`);

    // Generate the simplified report
    const reportData = await generateSimplifiedAgentReport(
      tenant,
      startDateTime,
      endDateTime,
      agentName || null,
      extension || null
    );

    console.log(`✅ Generated simplified report with ${reportData.agents.length} agents`);
    
    res.json(reportData);
    
  } catch (err) {
    console.error('Error generating simplified agent report:', err.response?.data || err.stack || err.message);
    res.status(500).json({ 
      error: err.message || 'Failed to generate agent report' 
    });
  }
});

// Agent Status Endpoint (new endpoint to match frontend)
app.get('/api/agent-status', async (req, res) => {
  const { tenant, start, end, agentName, extension } = req.query;
  if (!tenant || !start || !end) {
    return res.status(400).json({ error: 'Missing tenant, start or end query params' });
  }
  const startDate = Date.parse(start);
  const endDate = Date.parse(end);
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  try {
    // Convert to Unix timestamps for the API
    const startTimestamp = Math.floor(startDate / 1000);
    const endTimestamp = Math.floor(endDate / 1000);
    
    // Get portal token for authentication
    const token = await getPortalToken(process.env.TENANT);
    
    // Fetch agent call center statistics directly from the API
    const statsUrl = `https://uc.ira-shams-sj.ucprem.voicemeetme.com:9443/api/v2/reports/callcenter/agents/stats?startDate=${startTimestamp}&endDate=${endTimestamp}`;
    
    const response = await axios.get(statsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });
    
    const statsData = response.data;
    
    // Convert the stats data to the format expected by the frontend
    let agentArray = Object.entries(statsData).map(([extension, agent]) => ({
      name: agent.name,
      extension: extension,
      total_calls: agent.total_calls || 0,
      answered_calls: agent.answered_calls || 0,
      registered_time: agent.registered_time || 0,
      not_available_time: agent.not_available_time || 0,
      wrap_up_time: agent.wrap_up_time || 0,
      hold_time: agent.hold_time || 0,
      on_call_time: agent.on_call_time || 0,
      idle_time: agent.idle_time || 0,
      not_available_detailed_report: agent.not_available_detailed_report || {}
    }));
    
    // Apply filters if provided
    if (agentName) {
      agentArray = agentArray.filter(agent => 
        agent.name.toLowerCase().includes(agentName.toLowerCase())
      );
    }
    
    if (extension) {
      agentArray = agentArray.filter(agent => 
        agent.extension.toString().includes(extension)
      );
    }
    
    res.json(agentArray);
  } catch (err) {
    console.error('Error fetching agent stats:', err.response?.data || err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// Agent Status Endpoint (legacy endpoint for compatibility)
app.get('/api/agents', async (req, res) => {
  const { account, start, end } = req.query;
  if (!account || !start || !end) {
    return res.status(400).json({ error: 'Missing account, start or end query params' });
  }
  const startDate = Date.parse(start);
  const endDate = Date.parse(end);
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  try {
    // Convert to Unix timestamps for the API
    const startTimestamp = Math.floor(startDate / 1000);
    const endTimestamp = Math.floor(endDate / 1000);
    
    // Get portal token for authentication
    const token = await getPortalToken(process.env.TENANT);
    
    // Fetch agent call center statistics directly from the API
    const statsUrl = `https://uc.ira-shams-sj.ucprem.voicemeetme.com:9443/api/v2/reports/callcenter/agents/stats?startDate=${startTimestamp}&endDate=${endTimestamp}`;
    
    const response = await axios.get(statsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });
    
    const statsData = response.data;
    
    // Convert the stats data to the format expected by the frontend
    const agentArray = Object.entries(statsData).map(([extension, agent]) => ({
      name: agent.name,
      extension: extension,
      total_calls: agent.total_calls || 0,
      answered_calls: agent.answered_calls || 0,
      registered_time: agent.registered_time || 0,
      not_available_time: agent.not_available_time || 0,
      wrap_up_time: agent.wrap_up_time || 0,
      hold_time: agent.hold_time || 0,
      on_call_time: agent.on_call_time || 0,
      idle_time: agent.idle_time || 0,
      not_available_detailed_report: agent.not_available_detailed_report || {}
    }));
    
    res.json({ data: agentArray });
  } catch (err) {
    console.error('Error fetching agent stats:', err.response?.data || err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events?account=shams&startDate=1753251240&endDate=1753258440
app.get('/api/events', async (req, res) => {
  const { account = 'shams', startDate, endDate, timeRange, pageSize } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Missing startDate or endDate query params' });
  }
  
  const start = parseInt(startDate);
  const end = parseInt(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return res.status(400).json({ error: 'Invalid timestamp format for startDate or endDate' });
  }
  
  try {
    // Fetch all raw events (not filtered) to get login/logoff data
    const allEventsData = await fetchAgentEvents(account, { 
      startDate: start, 
      endDate: end,
      timeRange,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      filterResults: false
    });
    
    // Extract login/logoff times per agent
    const loginLogoffData = getAgentLoginLogoffTimes(allEventsData || []);
    
    res.json({ data: loginLogoffData });
  } catch (err) {
    console.error(err.response?.data || err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
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
