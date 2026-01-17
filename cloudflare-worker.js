/**
 * Cloudflare Worker - CORS Proxy + Market Monitor with Durable Objects
 *
 * This worker:
 * 1. Proxies requests to bitjita.com with CORS headers
 * 2. Monitors market orders every 5 minutes via cron
 * 3. Tracks changes in buy/sell orders
 * 4. Provides real-time updates to frontend clients
 */

// Target API endpoint
const TARGET_API = 'https://bitjita.com';
const CLAIM_ENTITY_ID = '288230376332988523';

/**
 * Durable Object: MarketMonitor
 * Stores market state and tracks changes
 */
export class MarketMonitor {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle requests to the Durable Object
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/monitor/state') {
      return this.getState();
    } else if (path === '/api/monitor/changes') {
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      return this.getChanges(limit);
    } else if (path === '/api/monitor/update') {
      const data = await request.json();
      return this.updateState(data);
    } else if (path === '/api/monitor/reset') {
      return this.resetState();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Get current market state
   */
  async getState() {
    const currentState = await this.state.storage.get('currentState');
    const lastUpdate = await this.state.storage.get('lastUpdate');
    const changeCount = await this.state.storage.get('changeCount') || 0;

    return new Response(JSON.stringify({
      currentState: currentState || null,
      lastUpdate: lastUpdate || null,
      changeCount: changeCount,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get recent changes
   */
  async getChanges(limit = 50) {
    const changes = await this.state.storage.get('changes') || [];

    return new Response(JSON.stringify({
      changes: changes.slice(-limit),
      total: changes.length,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Update state with new market data and detect changes
   */
  async updateState(newData) {
    const previousState = await this.state.storage.get('currentState');
    const changes = await this.state.storage.get('changes') || [];
    let changeCount = await this.state.storage.get('changeCount') || 0;

    // Detect changes
    const detectedChanges = this.detectChanges(previousState, newData);

    if (detectedChanges.length > 0) {
      // Add changes to history
      const changeEntry = {
        timestamp: Date.now(),
        changes: detectedChanges
      };
      changes.push(changeEntry);

      // Keep only last 1000 change entries
      if (changes.length > 1000) {
        changes.shift();
      }

      changeCount += detectedChanges.length;

      // Save to storage
      await this.state.storage.put('changes', changes);
      await this.state.storage.put('changeCount', changeCount);
    }

    // Update current state
    await this.state.storage.put('currentState', newData);
    await this.state.storage.put('lastUpdate', Date.now());

    return new Response(JSON.stringify({
      success: true,
      changesDetected: detectedChanges.length,
      totalChanges: changeCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Detect changes between previous and new market states
   */
  detectChanges(previousState, newState) {
    const changes = [];

    if (!previousState || !previousState.items) {
      return changes; // First run, no changes to detect
    }

    // Create maps for quick lookup
    const prevMap = new Map();
    previousState.items.forEach(item => {
      prevMap.set(item.id, item);
    });

    const newMap = new Map();
    newState.items.forEach(item => {
      newMap.set(item.id, item);
    });

    // Check all items in new state
    for (const newItem of newState.items) {
      const prevItem = prevMap.get(newItem.id);

      if (!prevItem) {
        // New item with orders appeared
        if (newItem.totalOrders > 0) {
          changes.push({
            type: 'new_item',
            itemId: newItem.id,
            itemName: newItem.name,
            sellOrders: newItem.sellOrders,
            buyOrders: newItem.buyOrders,
            totalOrders: newItem.totalOrders
          });
        }
        continue;
      }

      // Check for changes in order counts
      const sellOrderChange = newItem.sellOrders - prevItem.sellOrders;
      const buyOrderChange = newItem.buyOrders - prevItem.buyOrders;
      const totalOrderChange = newItem.totalOrders - prevItem.totalOrders;

      if (sellOrderChange !== 0 || buyOrderChange !== 0 || totalOrderChange !== 0) {
        changes.push({
          type: 'order_change',
          itemId: newItem.id,
          itemName: newItem.name,
          previous: {
            sellOrders: prevItem.sellOrders,
            buyOrders: prevItem.buyOrders,
            totalOrders: prevItem.totalOrders
          },
          current: {
            sellOrders: newItem.sellOrders,
            buyOrders: newItem.buyOrders,
            totalOrders: newItem.totalOrders
          },
          delta: {
            sellOrders: sellOrderChange,
            buyOrders: buyOrderChange,
            totalOrders: totalOrderChange
          }
        });
      }
    }

    // Check for items that disappeared (no longer have orders)
    for (const prevItem of previousState.items) {
      if (!newMap.has(prevItem.id) && prevItem.totalOrders > 0) {
        changes.push({
          type: 'item_removed',
          itemId: prevItem.id,
          itemName: prevItem.name,
          previous: {
            sellOrders: prevItem.sellOrders,
            buyOrders: prevItem.buyOrders,
            totalOrders: prevItem.totalOrders
          }
        });
      }
    }

    return changes;
  }

  /**
   * Reset state (for debugging)
   */
  async resetState() {
    await this.state.storage.deleteAll();

    return new Response(JSON.stringify({
      success: true,
      message: 'State reset successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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

    // Market Monitor API endpoints
    if (url.pathname.startsWith('/api/monitor/')) {
      return handleMonitorRequest(request, env);
    }

    // Default: CORS proxy to bitjita.com
    return handleProxyRequest(request, env);
  },

  /**
   * Handle scheduled events (cron)
   */
  async scheduled(event, env, ctx) {
    console.log('Cron triggered at:', new Date(event.scheduledTime).toISOString());

    // Fetch market data
    try {
      const marketData = await fetchMarketData();

      // Get Durable Object instance
      const id = env.MARKET_MONITOR.idFromName('global');
      const stub = env.MARKET_MONITOR.get(id);

      // Update state
      const response = await stub.fetch(new Request('https://dummy/api/monitor/update', {
        method: 'POST',
        body: JSON.stringify(marketData),
        headers: { 'Content-Type': 'application/json' }
      }));

      const result = await response.json();
      console.log('Market update result:', result);
    } catch (error) {
      console.error('Error in scheduled task:', error);
    }
  }
};

/**
 * Handle monitor API requests
 */
async function handleMonitorRequest(request, env) {
  try {
    // Get Durable Object instance (single global instance)
    const id = env.MARKET_MONITOR.idFromName('global');
    const stub = env.MARKET_MONITOR.get(id);

    // Forward request to Durable Object
    const response = await stub.fetch(request);

    // Add CORS headers
    const newResponse = new Response(response.body, response);
    addCorsHeaders(newResponse);

    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Monitor API error',
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
 * Fetch market data from bitjita API
 */
async function fetchMarketData() {
  const apiUrl = `${TARGET_API}/api/market?claimEntityId=${CLAIM_ENTITY_ID}&hasOrders=true`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    items: data.data?.items || [],
    fetchedAt: Date.now()
  };
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
