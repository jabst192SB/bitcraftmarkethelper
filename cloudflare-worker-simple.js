/**
 * Cloudflare Worker - Simple CORS Proxy
 *
 * This worker only proxies requests to bitjita.com with CORS headers.
 * Market monitoring is now handled by Supabase (via local-monitor.js).
 */

// Target API endpoint
const TARGET_API = 'https://bitjita.com';

/**
 * Main Worker
 */
export default {
  /**
   * Handle fetch requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Default: CORS proxy to bitjita.com
    return handleProxyRequest(request, env);
  }
};

/**
 * Handle proxy requests to bitjita.com
 */
async function handleProxyRequest(request, env) {
  const url = new URL(request.url);

  try {
    // Build the target URL
    const targetUrl = TARGET_API + url.pathname + url.search;

    console.log(`Proxying ${request.method} request to: ${targetUrl}`);

    // Create new request with same method, headers, and body
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    });

    // Forward the request to the target API
    const response = await fetch(proxyRequest);

    // Create a new response with CORS headers
    const newResponse = new Response(response.body, response);
    addCorsHeaders(newResponse);

    return newResponse;

  } catch (error) {
    // Return error with CORS headers
    return new Response(JSON.stringify({
      error: 'Proxy error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Handle CORS preflight OPTIONS requests
 */
function handleOptions(request) {
  const headers = request.headers;

  // Make sure the necessary headers are present for this to be a valid pre-flight request
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS preflight request
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers'),
        'Access-Control-Max-Age': '86400', // 24 hours
      }
    });
  } else {
    // Handle standard OPTIONS request
    return new Response(null, {
      headers: {
        'Allow': 'GET, POST, PUT, DELETE, OPTIONS',
      }
    });
  }
}
