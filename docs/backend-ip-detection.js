/**
 * Backend IP Detection - Implementation Examples
 * 
 * Choose ONE of the following implementations based on your backend setup
 */

// ============================================================================
// OPTION 1: Supabase Edge Function (RECOMMENDED)
// ============================================================================

/**
 * File: supabase/functions/get-client-ip/index.ts
 * 
 * Deploy with: supabase functions deploy get-client-ip
 */

// Supabase Edge Function Example:
/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Try to get IP from various headers (in order of preference)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || req.headers.get('cf-connecting-ip')  // Cloudflare
      || req.headers.get('x-client-ip')
      || 'unknown';
    
    return new Response(
      JSON.stringify({ 
        ip,
        timestamp: new Date().toISOString()
      }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        ip: 'unknown'
      }),
      { status: 500, headers }
    );
  }
});
*/

// Then update rate-limiter-service.js:
/*
async getClientIP() {
  try {
    const response = await fetch(
      'https://YOUR_PROJECT_REF.supabase.co/functions/v1/get-client-ip',
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'unknown';
  }
}
*/

// ============================================================================
// OPTION 2: Custom Backend API
// ============================================================================

/**
 * If you have a custom Node.js/Express backend
 */

// Backend Route (Express):
/*
// routes/ip.js
const express = require('express');
const router = express.Router();

router.get('/get-client-ip', (req, res) => {
  // Get IP from various possible headers
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.headers['cf-connecting-ip']  // Cloudflare
    || req.connection.remoteAddress
    || req.socket.remoteAddress
    || 'unknown';
  
  res.json({ 
    ip,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
*/

// Then in your main app:
/*
const ipRouter = require('./routes/ip');
app.use('/api', ipRouter);
*/

// Update rate-limiter-service.js:
/*
async getClientIP() {
  try {
    const response = await fetch('https://your-api.com/api/get-client-ip');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'unknown';
  }
}
*/

// ============================================================================
// OPTION 3: Python Backend (FastAPI)
// ============================================================================

/**
 * If using Python FastAPI backend
 */

// Python Backend:
/*
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/get-client-ip")
async def get_client_ip(request: Request):
    # Try to get IP from various headers
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = (
            request.headers.get("x-real-ip")
            or request.headers.get("cf-connecting-ip")
            or request.client.host
            or "unknown"
        )
    
    return {
        "ip": ip,
        "timestamp": datetime.utcnow().isoformat()
    }
*/

// Update rate-limiter-service.js:
/*
async getClientIP() {
  try {
    const response = await fetch('https://your-api.com/api/get-client-ip');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'unknown';
  }
}
*/

// ============================================================================
// OPTION 4: Third-Party Service (Development/Testing ONLY)
// ============================================================================

/**
 * WARNING: Only use for development/testing
 * - Has rate limits
 * - Adds latency
 * - External dependency
 * - NOT recommended for production
 */

// Development Only:
/*
async getClientIP() {
  try {
    // Using ipify (free tier has rate limits)
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'unknown';
  }
}
*/

// Alternative services:
// - https://api.ipify.org?format=json
// - https://api.my-ip.io/ip
// - https://ipapi.co/ip/

// ============================================================================
// OPTION 5: Cloudflare Workers (if using Cloudflare)
// ============================================================================

/**
 * If your app is behind Cloudflare
 */

// Cloudflare Worker:
/*
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Cloudflare automatically adds the client IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  return new Response(JSON.stringify({ 
    ip,
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
*/

// ============================================================================
// TESTING YOUR IMPLEMENTATION
// ============================================================================

/**
 * Test your IP detection implementation
 */

// Test function to add to your app:
/*
async function testIPDetection() {
  console.log('Testing IP detection...');
  
  const ip = await rateLimiterService.getClientIP();
  console.log('Detected IP:', ip);
  
  if (ip === 'unknown' || ip === 'client-ip') {
    console.error('❌ IP detection not properly configured!');
    console.error('Please implement one of the options in backend-ip-detection.js');
  } else {
    console.log('✅ IP detection working correctly');
  }
}

// Run on app start (development only)
if (__DEV__) {
  testIPDetection();
}
*/

// ============================================================================
// SECURITY CONSIDERATIONS
// ============================================================================

/**
 * Important Security Notes:
 * 
 * 1. TRUST PROXY HEADERS CAREFULLY
 *    - Only trust x-forwarded-for if behind a proxy you control
 *    - Can be spoofed if not properly configured
 * 
 * 2. HEADER PRIORITY
 *    Use this order:
 *    - CF-Connecting-IP (Cloudflare)
 *    - X-Forwarded-For (first IP only)
 *    - X-Real-IP (Nginx)
 *    - X-Client-IP (Other proxies)
 *    - Connection IP (fallback)
 * 
 * 3. IPv6 SUPPORT
 *    - Make sure your backend supports IPv6
 *    - IPv6 addresses look like: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
 * 
 * 4. LOCALHOST/PRIVATE IPs
 *    - Consider how to handle 127.0.0.1, 192.168.x.x, etc.
 *    - May want to skip rate limiting in development
 * 
 * 5. PROXY CONFIGURATION
 *    - If using Nginx, enable proxy headers:
 *      proxy_set_header X-Real-IP $remote_addr;
 *      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 */

// ============================================================================
// DEVELOPMENT MODE BYPASS
// ============================================================================

/**
 * Skip rate limiting in development
 */

// Add to rate-limiter-service.js:
/*
checkRateLimit(ipAddress) {
  // Skip rate limiting in development
  if (__DEV__ && (
    ipAddress === 'unknown' || 
    ipAddress === 'localhost' ||
    ipAddress === '127.0.0.1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.')
  )) {
    console.log('[DEV] Skipping rate limit for:', ipAddress);
    return { allowed: true };
  }
  
  // Continue with normal rate limiting...
  const now = Date.now();
  // ... rest of implementation
}
*/

// ============================================================================
// MONITORING & LOGGING
// ============================================================================

/**
 * Track rate limiting events for monitoring
 */

// Enhanced logging:
/*
checkRateLimit(ipAddress) {
  const result = this.performCheck(ipAddress);
  
  // Log blocked attempts
  if (!result.allowed) {
    console.warn('🚫 Rate limit exceeded:', {
      ip: ipAddress,
      reason: result.reason,
      retryAfter: result.retryAfter,
      timestamp: new Date().toISOString()
    });
    
    // Optional: Send to monitoring service
    // analyticsService.track('rate_limit_blocked', { ip: ipAddress });
  }
  
  return result;
}
*/

// ============================================================================
// NEXT STEPS
// ============================================================================

/**
 * After implementing IP detection:
 * 
 * 1. Test with actual requests from different IPs
 * 2. Monitor blocked IPs in your logs
 * 3. Verify legitimate users are not blocked
 * 4. Consider adding a whitelist for trusted IPs
 * 5. Set up monitoring/alerting for excessive blocks
 * 6. Document your chosen implementation for your team
 */

module.exports = {
    // Export for reference only
    examples: 'See comments above for implementation'
};
