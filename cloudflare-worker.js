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

// Region ID for Solvenar (used to filter orders)
const MONITOR_REGION_ID = 4;

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
      return this.updateState(data.marketData, data.orderDetails || {});
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
    const orderDetails = await this.state.storage.get('orderDetails') || {};
    const lastUpdate = await this.state.storage.get('lastUpdate');
    const changeCount = await this.state.storage.get('changeCount') || 0;

    return new Response(JSON.stringify({
      currentState: currentState || null,
      orderDetails: orderDetails,
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
   * @param {Object} newData - Market data with items array
   * @param {Object} orderDetails - Optional order details keyed by item ID
   */
  async updateState(newData, orderDetails = {}) {
    const previousState = await this.state.storage.get('currentState');
    const previousOrderDetails = await this.state.storage.get('orderDetails') || {};
    const changes = await this.state.storage.get('changes') || [];
    let changeCount = await this.state.storage.get('changeCount') || 0;

    // Detect changes
    const detectedChanges = this.detectChanges(previousState, newData);

    if (detectedChanges.length > 0) {
      // Attach order details and diff individual orders
      const changesWithOrders = detectedChanges.map(change => {
        const currentDetails = orderDetails[change.itemId];
        const prevDetails = previousOrderDetails[change.itemId];

        if (currentDetails) {
          // Diff individual orders to find added/removed
          const orderDiff = this.diffOrders(prevDetails, currentDetails);

          return {
            ...change,
            orderDetails: {
              sellOrders: currentDetails.sellOrders,
              buyOrders: currentDetails.buyOrders,
              stats: currentDetails.stats
            },
            addedOrders: orderDiff.added,
            removedOrders: orderDiff.removed
          };
        }
        return change;
      });

      // Add changes to history
      const changeEntry = {
        timestamp: Date.now(),
        changes: changesWithOrders
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

    // Update current state and order details
    await this.state.storage.put('currentState', newData);
    await this.state.storage.put('orderDetails', orderDetails);
    await this.state.storage.put('lastUpdate', Date.now());

    return new Response(JSON.stringify({
      success: true,
      changesDetected: detectedChanges.length,
      totalChanges: changeCount,
      itemsWithOrderDetails: Object.keys(orderDetails).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Diff orders between previous and current state to find added/removed orders
   */
  diffOrders(prevDetails, currentDetails) {
    const added = { sellOrders: [], buyOrders: [] };
    const removed = { sellOrders: [], buyOrders: [] };

    if (!prevDetails) {
      // All current orders are new
      added.sellOrders = (currentDetails.sellOrders || []).map(order => ({
        claimName: order.claimName,
        claimEntityId: order.claimEntityId,
        ownerName: order.ownerName || order.playerName,
        ownerEntityId: order.ownerEntityId || order.playerEntityId,
        quantity: order.quantity,
        priceThreshold: order.priceThreshold,
        regionId: order.regionId
      }));
      added.buyOrders = (currentDetails.buyOrders || []).map(order => ({
        claimName: order.claimName,
        claimEntityId: order.claimEntityId,
        ownerName: order.ownerName || order.playerName,
        ownerEntityId: order.ownerEntityId || order.playerEntityId,
        quantity: order.quantity,
        priceThreshold: order.priceThreshold,
        regionId: order.regionId
      }));
      return { added, removed };
    }

    // Create order keys for comparison (claimEntityId + price + type is unique enough)
    const createOrderKey = (order) =>
      `${order.claimEntityId || order.claimName}_${order.priceThreshold}_${order.quantity}`;

    // Diff sell orders
    const prevSellKeys = new Map();
    (prevDetails.sellOrders || []).forEach(order => {
      prevSellKeys.set(createOrderKey(order), order);
    });

    const currSellKeys = new Map();
    (currentDetails.sellOrders || []).forEach(order => {
      currSellKeys.set(createOrderKey(order), order);
    });

    // Find added sell orders
    for (const [key, order] of currSellKeys) {
      if (!prevSellKeys.has(key)) {
        added.sellOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }

    // Find removed sell orders
    for (const [key, order] of prevSellKeys) {
      if (!currSellKeys.has(key)) {
        removed.sellOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }

    // Diff buy orders
    const prevBuyKeys = new Map();
    (prevDetails.buyOrders || []).forEach(order => {
      prevBuyKeys.set(createOrderKey(order), order);
    });

    const currBuyKeys = new Map();
    (currentDetails.buyOrders || []).forEach(order => {
      currBuyKeys.set(createOrderKey(order), order);
    });

    // Find added buy orders
    for (const [key, order] of currBuyKeys) {
      if (!prevBuyKeys.has(key)) {
        added.buyOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }

    // Find removed buy orders
    for (const [key, order] of prevBuyKeys) {
      if (!currBuyKeys.has(key)) {
        removed.buyOrders.push({
          claimName: order.claimName,
          claimEntityId: order.claimEntityId,
          ownerName: order.ownerName || order.playerName,
          ownerEntityId: order.ownerEntityId || order.playerEntityId,
          quantity: order.quantity,
          priceThreshold: order.priceThreshold,
          regionId: order.regionId
        });
      }
    }

    return { added, removed };
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
      // Manual trigger endpoint
      if (url.pathname === '/api/monitor/trigger' && request.method === 'POST') {
        return handleManualTrigger(env);
      }
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

    try {
      // Get Durable Object instance
      const id = env.MARKET_MONITOR.idFromName('global');
      const stub = env.MARKET_MONITOR.get(id);

      // Get current state for incremental update
      const stateResponse = await stub.fetch(new Request('https://dummy/api/monitor/state'));
      const stateData = await stateResponse.json();

      // Incremental update - fetches changed items and gradually fills in missing items
      console.log('Running incremental update...');

      // Fetch current market data (list of items with orders)
      const marketData = await fetchMarketData();
      console.log(`Found ${marketData.items.length} items with orders`);

      const previousState = stateData.currentState;
      const previousOrderDetails = stateData.orderDetails || {};

      // Detect which items have changes
      const changedItemIds = detectChangedItemIds(previousState, marketData);
      console.log(`Detected ${changedItemIds.length} changed items`);

      // Build order details: keep previous data, fetch only changed items
      const allItemIds = marketData.items.map(item => item.id);
      let orderDetails = { ...previousOrderDetails };

      // Remove items that no longer have orders
      // Note: allItemIds are strings from the API
      for (const key of Object.keys(orderDetails)) {
        if (!allItemIds.includes(key) && !allItemIds.includes(String(key))) {
          delete orderDetails[key];
        }
      }

      // Fetch order details for changed items AND items we don't have details for yet
      // Limit to 40 items per run to stay under Cloudflare's 50 subrequest limit
      const MAX_ITEMS_PER_RUN = 40;

      // Find items we don't have order details for yet
      const missingDetailIds = allItemIds.filter(id => !orderDetails[id] && !orderDetails[String(id)]);

      // Prioritize changed items, then fill with missing items
      const itemIdsToFetch = [
        ...changedItemIds.slice(0, MAX_ITEMS_PER_RUN),
        ...missingDetailIds.slice(0, Math.max(0, MAX_ITEMS_PER_RUN - changedItemIds.length))
      ].slice(0, MAX_ITEMS_PER_RUN);

      if (itemIdsToFetch.length > 0) {
        console.log(`Fetching order details for ${itemIdsToFetch.length} items (${changedItemIds.length} changed, ${missingDetailIds.length} missing)`);
        // Get full item objects with itemType for the fetch
        const itemsToFetch = marketData.items.filter(item => itemIdsToFetch.includes(item.id));
        const fetchedOrderDetails = await fetchOrdersForItems(itemsToFetch);
        // Merge fetched items into full order details
        orderDetails = { ...orderDetails, ...fetchedOrderDetails };
        console.log(`Updated order details for ${Object.keys(fetchedOrderDetails).length} items`);
      }

      console.log(`Total order details: ${Object.keys(orderDetails).length} items`);

      // Update state with market data and order details
      const response = await stub.fetch(new Request('https://dummy/api/monitor/update', {
        method: 'POST',
        body: JSON.stringify({
          marketData: marketData,
          orderDetails: orderDetails
        }),
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
 * Handle manual trigger of market update (same as cron)
 */
async function handleManualTrigger(env) {
  try {
    console.log('Manual trigger at:', new Date().toISOString());

    // Fetch current market data (list of items with orders)
    const marketData = await fetchMarketData();
    console.log(`Found ${marketData.items.length} items with orders`);

    // Get Durable Object instance
    const id = env.MARKET_MONITOR.idFromName('global');
    const stub = env.MARKET_MONITOR.get(id);

    // Get previous state to detect changes
    const stateResponse = await stub.fetch(new Request('https://dummy/api/monitor/state'));
    const stateData = await stateResponse.json();
    const previousState = stateData.currentState;
    const previousOrderDetails = stateData.orderDetails || {};

    // Detect which items have changes
    const changedItemIds = detectChangedItemIds(previousState, marketData);
    console.log(`Detected ${changedItemIds.length} changed items`);

    // Build order details: keep previous data, fetch only changed items
    const allItemIds = marketData.items.map(item => item.id);
    let orderDetails = { ...previousOrderDetails };

    // Remove items that no longer have orders
    // Note: allItemIds are strings from the API
    for (const key of Object.keys(orderDetails)) {
      if (!allItemIds.includes(key) && !allItemIds.includes(String(key))) {
        delete orderDetails[key];
      }
    }

    // Fetch order details for changed items AND items we don't have details for yet
    // Limit to 40 items per run to stay under Cloudflare's 50 subrequest limit
    const MAX_ITEMS_PER_RUN = 40;

    // Find items we don't have order details for yet
    const missingDetailIds = allItemIds.filter(id => !orderDetails[id] && !orderDetails[String(id)]);

    // Prioritize changed items, then fill with missing items
    const itemIdsToFetch = [
      ...changedItemIds.slice(0, MAX_ITEMS_PER_RUN),
      ...missingDetailIds.slice(0, Math.max(0, MAX_ITEMS_PER_RUN - changedItemIds.length))
    ].slice(0, MAX_ITEMS_PER_RUN);

    if (itemIdsToFetch.length > 0) {
      console.log(`Fetching order details for ${itemIdsToFetch.length} items (${changedItemIds.length} changed, ${missingDetailIds.length} missing)`);
      // Get full item objects with itemType for the fetch
      const itemsToFetch = marketData.items.filter(item => itemIdsToFetch.includes(item.id));
      const fetchedOrderDetails = await fetchOrdersForItems(itemsToFetch);
      // Merge fetched items into full order details
      orderDetails = { ...orderDetails, ...fetchedOrderDetails };
      console.log(`Updated order details for ${Object.keys(fetchedOrderDetails).length} items`);
    }

    console.log(`Total order details: ${Object.keys(orderDetails).length} items`);

    // Update state with market data and order details
    const response = await stub.fetch(new Request('https://dummy/api/monitor/update', {
      method: 'POST',
      body: JSON.stringify({
        marketData: marketData,
        orderDetails: orderDetails
      }),
      headers: { 'Content-Type': 'application/json' }
    }));

    const result = await response.json();
    console.log('Market update result:', result);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      triggeredAt: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Error in manual trigger:', error);
    return new Response(JSON.stringify({
      error: 'Manual trigger failed',
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
 * Detect which item IDs have changes between previous and new market states
 * (Standalone function for use in cron before updating Durable Object)
 */
function detectChangedItemIds(previousState, newState) {
  const changedIds = [];

  if (!previousState || !previousState.items) {
    return changedIds; // First run, no changes to detect
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
      // New item appeared
      if (newItem.totalOrders > 0) {
        changedIds.push(newItem.id);
      }
      continue;
    }

    // Check for changes in order counts
    const sellOrderChange = newItem.sellOrders - prevItem.sellOrders;
    const buyOrderChange = newItem.buyOrders - prevItem.buyOrders;
    const totalOrderChange = newItem.totalOrders - prevItem.totalOrders;

    if (sellOrderChange !== 0 || buyOrderChange !== 0 || totalOrderChange !== 0) {
      changedIds.push(newItem.id);
    }
  }

  // Check for items that disappeared
  for (const prevItem of previousState.items) {
    if (!newMap.has(prevItem.id) && prevItem.totalOrders > 0) {
      changedIds.push(prevItem.id);
    }
  }

  return changedIds;
}

/**
 * Fetch market data from bitjita API
 */
async function fetchMarketData() {
  // Fetch all items with orders (no claim filter - we'll filter by region instead)
  const apiUrl = `${TARGET_API}/api/market?hasOrders=true`;

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
 * Fetch full order details for a specific item or cargo
 * @param {number} itemId - The item/cargo ID
 * @param {number} itemType - The item type (1 for cargo, other values for regular items)
 */
async function fetchItemOrders(itemId, itemType = 0) {
  // Use cargo endpoint if itemType is 1, otherwise use item endpoint
  const endpoint = itemType === 1 ? 'cargo' : 'item';
  const apiUrl = `${TARGET_API}/api/market/${endpoint}/${itemId}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    console.error(`Failed to fetch orders for ${endpoint} ${itemId}: ${response.status}`);
    return null;
  }

  const data = await response.json();

  // Filter orders to only include those from the monitored region (Solvenar)
  const sellOrders = (data.sellOrders || []).filter(order => order.regionId === MONITOR_REGION_ID);
  const buyOrders = (data.buyOrders || []).filter(order => order.regionId === MONITOR_REGION_ID);

  return {
    itemId: itemId,
    sellOrders: sellOrders,
    buyOrders: buyOrders,
    stats: data.stats || {}
  };
}

/**
 * Fetch order details for multiple items (with rate limiting)
 * @param {Array} items - Array of item objects with id and itemType properties
 */
async function fetchOrdersForItems(items) {
  const results = {};

  console.log(`Need to fetch ${items.length} items`);

  // Fetch in batches of 40 to stay under Cloudflare's 50 subrequest limit
  const batchSize = 40;
  const delayBetweenBatches = 100; // ms

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const promises = batch.map(item => fetchItemOrders(item.id, item.itemType));
    const batchResults = await Promise.all(promises);

    batchResults.forEach(result => {
      if (result) {
        results[result.itemId] = result;
      }
    });

    // Log progress every 50 items
    if (items.length > 20 && (i + batchSize) % 50 === 0) {
      console.log(`Fetched ${Math.min(i + batchSize, items.length)}/${items.length} items`);
    }

    // Delay between batches to stay under rate limit
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
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
