/**
 * SSL Certificate Manager
 * 
 * This script provides a comprehensive solution for:
 * 1. Generating new self-signed certificates
 * 2. Rotating certificates with proper backups
 * 3. Validating certificate expiration
 * 4. Providing certificate status for the application
 * # Check current certificate status
node --experimental-modules ssl/ssl-manager.js status

# Generate new certificates
node --experimental-modules ssl/ssl-manager.js generate

# Or rotate certificates if needed (this will create a backup automatically)
node --experimental-modules ssl/ssl-manager.js rotate
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const stat = promisify(fs.stat);
const exists = (path) => fs.promises.access(path).then(() => true).catch(() => false);

// Constants
const SSL_DIR = path.resolve(__dirname);
const CERT_FILES = ['cert.pem', 'chain.pem', 'fullchain.pem', 'privkey.pem'];
const DEFAULT_DAYS_VALID = 365;
const WARNING_DAYS = 30; // Warn when certificate is expiring within 30 days
const MAX_RETRIES = 3; // Maximum number of retries for operations

// Certificate status enum
const CertStatus = {
  VALID: 'valid',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  MISSING: 'missing'
};

/**
 * Create a backup of current certificates
 * @param {string} backupName - Name of backup directory (default: timestamp)
 * @returns {Promise<string>} - Path to backup directory
 */
async function backupCertificates(backupName = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(SSL_DIR, backupName || `backup-${timestamp}`);
  
  try {
    // Create backup directory if it doesn't exist
    if (!await exists(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }
    
    // Copy each certificate file to backup
    for (const file of CERT_FILES) {
      const sourcePath = path.join(SSL_DIR, file);
      const destPath = path.join(backupDir, file);
      
      if (await exists(sourcePath)) {
        await copyFile(sourcePath, destPath);
        console.log(`Backed up ${file} to ${backupDir}`);
      } else {
        console.log(`Warning: ${file} not found, skipping backup`);
      }
    }
    
    return backupDir;
  } catch (error) {
    console.error('Error backing up certificates:', error);
    throw error;
  }
}

/**
 * Generate new self-signed certificates
 * @param {number} daysValid - Number of days the certificate will be valid
 * @returns {Promise<void>}
 */
async function generateCertificates(daysValid = DEFAULT_DAYS_VALID) {
  try {
    console.log('Generating new self-signed certificates...');
    
    // Generate OpenSSL config if it doesn't exist
    const opensslConfigPath = path.join(SSL_DIR, 'openssl.cnf');
    if (!await exists(opensslConfigPath)) {
      const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
      `.trim();
      
      await writeFile(opensslConfigPath, opensslConfig);
      console.log('Created OpenSSL configuration file');
    }
    
    // Generate private key
    execSync(`openssl genrsa -out privkey.pem 4096`, { cwd: SSL_DIR });
    console.log('Generated private key: privkey.pem');
    
    // Generate certificate signing request (CSR)
    execSync(`openssl req -new -key privkey.pem -out cert.csr -subj "/CN=localhost" -config openssl.cnf`, { cwd: SSL_DIR });
    console.log('Generated certificate signing request: cert.csr');
    
    // Generate self-signed certificate
    execSync(`openssl x509 -req -days ${daysValid} -in cert.csr -signkey privkey.pem -out cert.pem -extfile openssl.cnf -extensions v3_req`, { cwd: SSL_DIR });
    console.log(`Generated certificate valid for ${daysValid} days: cert.pem`);
    
    // Copy cert.pem to chain.pem and fullchain.pem for compatibility
    await copyFile(path.join(SSL_DIR, 'cert.pem'), path.join(SSL_DIR, 'chain.pem'));
    await copyFile(path.join(SSL_DIR, 'cert.pem'), path.join(SSL_DIR, 'fullchain.pem'));
    console.log('Created chain.pem and fullchain.pem');
    
    // Clean up CSR file
    fs.unlinkSync(path.join(SSL_DIR, 'cert.csr'));
    
    console.log('SSL certificate generation completed successfully!');
  } catch (error) {
    console.error('Error generating certificates:', error);
    throw error;
  }
}

/**
 * Check certificate status and expiration
 * @returns {Promise<{status: string, daysRemaining: number|null, expiryDate: Date|null}>}
 */
async function checkCertificateStatus() {
  try {
    const certPath = path.join(SSL_DIR, 'cert.pem');
    
    // Check if certificate exists
    if (!await exists(certPath)) {
      return { status: CertStatus.MISSING, daysRemaining: null, expiryDate: null };
    }
    
    // Read certificate
    const certData = await readFile(certPath);
    
    try {
      // Parse certificate
      const cert = new crypto.X509Certificate(certData);
      const expiryDate = new Date(cert.validTo);
      const now = new Date();
      
      // Calculate days remaining
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysRemaining = Math.floor((expiryDate - now) / msPerDay);
      
      // Determine status
      let status;
      if (daysRemaining < 0) {
        status = CertStatus.EXPIRED;
      } else if (daysRemaining < WARNING_DAYS) {
        status = CertStatus.EXPIRING_SOON;
      } else {
        status = CertStatus.VALID;
      }
      
      return { status, daysRemaining, expiryDate };
    } catch (error) {
      console.error('Error parsing certificate:', error);
      return { status: CertStatus.INVALID, daysRemaining: null, expiryDate: null };
    }
  } catch (error) {
    console.error('Error checking certificate status:', error);
    return { status: CertStatus.INVALID, daysRemaining: null, expiryDate: null };
  }
}

/**
 * Rotate certificates if they're expired or expiring soon
 * @param {number} daysThreshold - Rotate if fewer days remaining than this
 * @returns {Promise<{rotated: boolean, status: string, daysRemaining: number|null}>}
 */
async function rotateCertificatesIfNeeded(daysThreshold = WARNING_DAYS) {
  try {
    // Check current certificate status
    const { status, daysRemaining } = await checkCertificateStatus();
    
    // Rotate if expired, expiring soon, invalid, or missing
    if (
      status === CertStatus.EXPIRED ||
      status === CertStatus.INVALID ||
      status === CertStatus.MISSING ||
      (status === CertStatus.EXPIRING_SOON && daysRemaining < daysThreshold)
    ) {
      console.log(`Certificate ${status}, creating backup and generating new certificates...`);
      
      // Backup existing certificates if they exist
      if (status !== CertStatus.MISSING) {
        await backupCertificates();
      }
      
      // Generate new certificates
      await generateCertificates();
      
      // Check new certificate status
      const newStatus = await checkCertificateStatus();
      
      return { 
        rotated: true, 
        status: newStatus.status, 
        daysRemaining: newStatus.daysRemaining 
      };
    }
    
    console.log(`Certificate is ${status} with ${daysRemaining} days remaining. No rotation needed.`);
    return { rotated: false, status, daysRemaining };
  } catch (error) {
    console.error('Error rotating certificates:', error);
    throw error;
  }
}

/**
 * Get SSL options for HTTPS server
 * @returns {Promise<Object>} - SSL options object
 */
async function getSSLOptions() {
  try {
    // Check certificate status
    const { status } = await checkCertificateStatus();
    
    // Generate new certificates if needed
    if (status !== CertStatus.VALID && status !== CertStatus.EXPIRING_SOON) {
      console.log(`Certificate ${status}, generating new certificates...`);
      await generateCertificates();
    }
    
    // Return SSL options
    return {
      key: await readFile(path.join(SSL_DIR, 'privkey.pem')),
      cert: await readFile(path.join(SSL_DIR, 'fullchain.pem'))
    };
  } catch (error) {
    console.error('Error getting SSL options:', error);
    throw error;
  }
}

// Generate localhost-specific self-signed certificate
export const generateLocalhostCert = () => {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  try {
    console.log('🔧 Generating localhost SSL certificate...');
    
    // Create localhost certificate with proper SAN
    const certCommand = `
      openssl req -x509 -newkey rsa:4096 -keyout ssl/localhost-privkey.pem -out ssl/localhost-fullchain.pem -days 365 -nodes \
      -subj "/C=US/ST=CA/L=San Francisco/O=Development/OU=IT Department/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1"
    `;
    
    execSync(certCommand, { stdio: 'inherit' });
    console.log('✅ Localhost SSL certificate generated successfully');
    
    return {
      key: fs.readFileSync('ssl/localhost-privkey.pem'),
      cert: fs.readFileSync('ssl/localhost-fullchain.pem')
    };
  } catch (error) {
    console.error('❌ Failed to generate localhost certificate:', error.message);
    return null;
  }
};

// Export functions
export {
  backupCertificates,
  generateCertificates,
  checkCertificateStatus,
  rotateCertificatesIfNeeded,
  getSSLOptions,
  CertStatus
};

// Command line interface
const isRunningDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (isRunningDirectly) {
  const command = process.argv[2];
  
  (async () => {
    try {
      switch (command) {
        case 'backup':
          const backupName = process.argv[3];
          await backupCertificates(backupName);
          break;
          
        case 'generate':
          const daysValid = parseInt(process.argv[3]) || DEFAULT_DAYS_VALID;
          await generateCertificates(daysValid);
          break;
          
        case 'status':
          const status = await checkCertificateStatus();
          console.log('Certificate Status:', status);
          break;
          
        case 'rotate':
          const threshold = parseInt(process.argv[3]) || WARNING_DAYS;
          const result = await rotateCertificatesIfNeeded(threshold);
          console.log('Rotation Result:', result);
          break;
          
        default:
          console.log(`
SSL Certificate Manager

Usage:
  node ssl-manager.js <command> [options]

Commands:
  backup [name]      - Backup current certificates (optional backup name)
  generate [days]    - Generate new certificates (optional validity in days)
  status             - Check certificate status
  rotate [threshold] - Rotate certificates if needed (optional days threshold)
          `);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}