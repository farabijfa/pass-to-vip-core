#!/usr/bin/env node

/**
 * Birthday Bot Cron Script
 * 
 * This script is designed to be run by Replit Scheduled Deployments.
 * It triggers the birthday bot to award points and send notifications
 * to users with birthdays today.
 * 
 * Usage:
 *   node scripts/birthday-cron.js
 * 
 * Environment Variables:
 *   ADMIN_API_KEY - API key for authentication (default: pk_phygital_admin_2024)
 *   APP_URL - Base URL of the application (auto-detected in Replit)
 * 
 * Scheduled Deployment Setup:
 *   Cron Expression: 0 9 * * * (Daily at 9:00 AM)
 *   Run Command: node scripts/birthday-cron.js
 */

const https = require('https');
const http = require('http');

const API_KEY = process.env.ADMIN_API_KEY || 'pk_phygital_admin_2024';

function getAppUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

const APP_URL = getAppUrl();

const ENDPOINT = '/api/notify/birthday-run';

console.log('========================================');
console.log('  Birthday Bot - Scheduled Job');
console.log('========================================');
console.log(`  Time: ${new Date().toISOString()}`);
console.log(`  Target: ${APP_URL}${ENDPOINT}`);
console.log('----------------------------------------');

const url = new URL(ENDPOINT, APP_URL);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
};

const req = httpModule.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`  Status: ${res.statusCode}`);
    
    try {
      const result = JSON.parse(data);
      
      if (res.statusCode >= 400) {
        console.error('  Result: HTTP ERROR');
        console.error(`  Response: ${data}`);
        console.log('========================================');
        process.exit(1);
      }
      
      if (result.success) {
        console.log('  Result: SUCCESS');
        console.log(`  Processed: ${result.data?.processed || 0} birthdays`);
        console.log(`  Succeeded: ${result.data?.successCount || 0}`);
        console.log(`  Failed: ${result.data?.failedCount || 0}`);
        
        if (result.data?.campaignLogId) {
          console.log(`  Log ID: ${result.data.campaignLogId}`);
        }
        console.log('========================================');
        process.exit(0);
      } else {
        console.error('  Result: FAILED');
        console.error(`  Error: ${result.error?.message || 'Unknown error'}`);
        console.log('========================================');
        process.exit(1);
      }
    } catch (e) {
      console.error('  Failed to parse response:', data);
      console.log('========================================');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('  Request failed:', error.message);
  console.log('========================================');
  process.exit(1);
});

req.end();
