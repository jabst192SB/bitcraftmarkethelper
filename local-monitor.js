/**
 * Local Market Monitor - Node.js version
 *
 * This is a local version of the Cloudflare Worker market monitor
 * that runs on Node.js without the restrictions of Cloudflare Workers.
 *
 * Usage:
 *   node local-monitor.js [command] [options]
 *
 * Commands:
 *   update           - Fetch and update market data (default)
 *   state            - Show current state
 *   changes [limit]  - Show recent changes (default: 50)
 *   watch [interval] - Continuously monitor (default: 60s)
 *   reset            - Reset all stored data
 *   debug <claim>    - Debug orders for a specific claim name
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load .env file

// Import Supabase client
const SupabaseClient = require('./supabase-client.js').default;

// Configuration
const TARGET_API = 'https://bitjita.com';
const MONITOR_REGION_ID = 4; // Solvenar
const STATE_FILE = path.join(__dirname, 'local-monitor-state.json');

// Initialize Supabase client
let supabaseClient = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabaseClient = new SupabaseClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    console.log('✓ Supabase client initialized');
  } else {
    console.warn('⚠ Supabase credentials not found in .env file');
  }
} catch (error) {
  console.error('✗ Failed to initialize Supabase client:', error.message);
}

// In-memory state (loaded from file)
let state = {
  currentState: null,
  orderDetails: {},
  changes: [],
  changeCount: 0,
  lastUpdate: null,
  // Track what's been synced to Supabase to avoid redundant uploads
  syncState: {
    lastSyncTime: null,
    syncedItemHashes: {},      // item_id -> hash of data
    syncedOrderHashes: {},     // item_id -> hash of order details
    lastSyncedChangeIndex: 0   // Index of last synced change entry
  }
};

// Egress tracking (not persisted, resets each run)
let totalRunEgress = 0;

/**
 * Generate a simple hash for an object to detect changes
 */
function hashObject(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Calculate byte size of data (for egress tracking)
 */
function calculateByteSize(data) {
  const str = JSON.stringify(data);
  return Buffer.byteLength(str, 'utf8');
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Load state from disk
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(data);
      console.log('✓ Loaded state from disk');
      console.log(`  - Items tracked: ${state.currentState?.items?.length || 0}`);
      console.log(`  - Order details: ${Object.keys(state.orderDetails).length}`);
      console.log(`  - Change entries: ${state.changes.length}`);
      console.log(`  - Total changes: ${state.changeCount}`);
    }
  } catch (error) {
    console.error('Error loading state:', error.message);
  }
}

/**
 * Save state to disk
 */
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('✓ Saved state to disk');
  } catch (error) {
    console.error('Error saving state:', error.message);
  }
}

/**
 * Fetch market data from bitjita API
 */
async function fetchMarketData() {
  const apiUrl = `${TARGET_API}/api/market?hasOrders=true`;

  console.log(`Fetching market data from: ${apiUrl}`);

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
 * Fetch bulk price data for multiple items at once (max 100 per request)
 * Much faster than individual requests - use this for detecting changes!
 */
async function fetchBulkPrices(itemIds, cargoIds = []) {
  const apiUrl = `${TARGET_API}/api/market/prices/bulk`;

  const body = {};
  if (itemIds.length > 0) body.itemIds = itemIds;
  if (cargoIds.length > 0) body.cargoIds = cargoIds;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Bulk API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform to easier format
  const result = {};

  // Process items
  if (data.data?.items) {
    Object.entries(data.data.items).forEach(([itemId, priceData]) => {
      result[itemId] = {
        lowestSell: priceData.lowestSellPrice,
        highestBuy: priceData.highestBuyPrice,
        sellQuantity: priceData.totalSellQuantity || 0,
        buyQuantity: priceData.totalBuyQuantity || 0,
        // Use actual order counts from API response
        sellOrders: priceData.sellOrderCount || 0,
        buyOrders: priceData.buyOrderCount || 0,
        totalOrders: (priceData.sellOrderCount || 0) + (priceData.buyOrderCount || 0)
      };
    });
  }

  // Process cargo
  if (data.data?.cargo) {
    Object.entries(data.data.cargo).forEach(([cargoId, priceData]) => {
      result[cargoId] = {
        lowestSell: priceData.lowestSellPrice,
        highestBuy: priceData.highestBuyPrice,
        sellQuantity: priceData.totalSellQuantity || 0,
        buyQuantity: priceData.totalBuyQuantity || 0,
        // Use actual order counts from API response
        sellOrders: priceData.sellOrderCount || 0,
        buyOrders: priceData.buyOrderCount || 0,
        totalOrders: (priceData.sellOrderCount || 0) + (priceData.buyOrderCount || 0)
      };
    });
  }

  return result;
}

/**
 * Fetch bulk prices in batches of 100 for all items
 */
async function fetchAllBulkPrices(items) {
  const results = {};
  const batchSize = 100;

  console.log(`Fetching bulk prices for ${items.length} items in batches of ${batchSize}...`);

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    // Convert to numbers and filter out cargo
    const itemIds = batch
      .filter(item => item.itemType !== 1)
      .map(item => typeof item.id === 'string' ? parseInt(item.id) : item.id)
      .filter(id => !isNaN(id));
    const cargoIds = batch
      .filter(item => item.itemType === 1)
      .map(item => typeof item.id === 'string' ? parseInt(item.id) : item.id)
      .filter(id => !isNaN(id));

    try {
      const batchResults = await fetchBulkPrices(itemIds, cargoIds);
      Object.assign(results, batchResults);

      const fetched = Math.min(i + batchSize, items.length);
      const percent = Math.round((fetched / items.length) * 100);
      console.log(`  Bulk progress: ${fetched}/${items.length} (${percent}%)`);
    } catch (error) {
      console.error(`  Failed to fetch bulk batch ${i}-${i + batchSize}:`, error.message);
    }

    // Small delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`✓ Fetched bulk prices for ${Object.keys(results).length} items`);

  return results;
}

/**
 * Fetch full order details for a specific item or cargo (with retry on 429)
 */
async function fetchItemOrders(itemId, itemType = 0, retries = 3) {
  const endpoint = itemType === 1 ? 'cargo' : 'item';
  const apiUrl = `${TARGET_API}/api/market/${endpoint}/${itemId}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(apiUrl);

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`⚠ Rate limited on ${endpoint} ${itemId}, waiting ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    if (!response.ok) {
      console.error(`Failed to fetch orders for ${endpoint} ${itemId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Filter orders to only include those from the monitored region
    const sellOrders = (data.sellOrders || []).filter(order => order.regionId === MONITOR_REGION_ID);
    const buyOrders = (data.buyOrders || []).filter(order => order.regionId === MONITOR_REGION_ID);

    // Keep full order data for local debugging
    const fullSellOrders = sellOrders.map(o => ({
      claimName: o.claimName,
      claimEntityId: o.claimEntityId,
      ownerName: o.ownerName || o.ownerUsername,
      ownerEntityId: o.ownerEntityId,
      quantity: o.quantity,
      priceThreshold: o.priceThreshold,
      regionId: o.regionId
    }));

    const fullBuyOrders = buyOrders.map(o => ({
      claimName: o.claimName,
      claimEntityId: o.claimEntityId,
      ownerName: o.ownerName || o.ownerUsername,
      ownerEntityId: o.ownerEntityId,
      quantity: o.quantity,
      priceThreshold: o.priceThreshold,
      regionId: o.regionId
    }));

    return {
      itemId: itemId,
      sellOrders: fullSellOrders,
      buyOrders: fullBuyOrders,
      stats: {
        lowestSell: data.stats?.lowestSell || null,
        highestBuy: data.stats?.highestBuy || null,
        totalAvailableSell: data.stats?.totalAvailableSell || 0,
        totalAvailableBuy: data.stats?.totalAvailableBuy || 0
      }
    };
  }

  // All retries exhausted
  console.error(`✗ Failed to fetch ${endpoint} ${itemId} after ${retries} attempts`);
  return null;
}

/**
 * Fetch order details for multiple items (with rate limiting)
 */
async function fetchOrdersForItems(items, maxItems = null) {
  const results = {};

  // Limit items if specified
  const itemsToFetch = maxItems ? items.slice(0, maxItems) : items;

  console.log(`Fetching order details for ${itemsToFetch.length} items...`);

  // Use smaller batches and longer delays to avoid rate limiting
  const batchSize = 10; // Reduced from 40
  const delayBetweenBatches = 500; // Increased from 100ms
  const delayBetweenRequests = 50; // Add delay between individual requests

  for (let i = 0; i < itemsToFetch.length; i += batchSize) {
    const batch = itemsToFetch.slice(i, i + batchSize);

    // Process items sequentially within batch to avoid rate limiting
    for (const item of batch) {
      const result = await fetchItemOrders(item.id, item.itemType);
      if (result) {
        results[result.itemId] = result;
      }

      // Small delay between individual requests
      if (delayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    // Show progress
    if (itemsToFetch.length > 20) {
      const fetched = Math.min(i + batchSize, itemsToFetch.length);
      const percent = Math.round((fetched / itemsToFetch.length) * 100);
      console.log(`  Progress: ${fetched}/${itemsToFetch.length} (${percent}%) - ${Object.keys(results).length} successful`);
    }

    // Delay between batches
    if (i + batchSize < itemsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`✓ Fetched ${Object.keys(results).length} item order details`);

  if (maxItems && items.length > maxItems) {
    console.log(`⚠ Limited to ${maxItems} items (${items.length - maxItems} remaining)`);
  }

  return results;
}

/**
 * Detect which item IDs have changes
 */
function detectChangedItemIds(previousState, newState) {
  const changedIds = [];

  if (!previousState || !previousState.items) {
    return changedIds;
  }

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
      if (newItem.totalOrders > 0) {
        changedIds.push(newItem.id);
      }
      continue;
    }

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
 * Detect changes between states
 */
function detectChanges(previousState, newState) {
  const changes = [];

  if (!previousState || !previousState.items) {
    return changes;
  }

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
      if (newItem.totalOrders > 0) {
        changes.push({
          type: 'new_item',
          itemId: newItem.id,
          itemName: newItem.name,
          itemType: newItem.itemType,
          tier: newItem.tier,
          rarity: newItem.rarityStr,
          sellOrders: newItem.sellOrders,
          buyOrders: newItem.buyOrders,
          totalOrders: newItem.totalOrders
        });
      }
      continue;
    }

    const sellOrderChange = newItem.sellOrders - prevItem.sellOrders;
    const buyOrderChange = newItem.buyOrders - prevItem.buyOrders;
    const totalOrderChange = newItem.totalOrders - prevItem.totalOrders;

    if (sellOrderChange !== 0 || buyOrderChange !== 0 || totalOrderChange !== 0) {
      changes.push({
        type: 'order_change',
        itemId: newItem.id,
        itemName: newItem.name,
        itemType: newItem.itemType,
        tier: newItem.tier,
        rarity: newItem.rarityStr,
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

  // Check for items that disappeared
  for (const prevItem of previousState.items) {
    if (!newMap.has(prevItem.id) && prevItem.totalOrders > 0) {
      changes.push({
        type: 'item_removed',
        itemId: prevItem.id,
        itemName: prevItem.name,
        itemType: prevItem.itemType,
        tier: prevItem.tier,
        rarity: prevItem.rarityStr,
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
 * Diff orders between previous and current
 */
function diffOrders(prevDetails, currentDetails) {
  const added = { sellOrders: [], buyOrders: [] };
  const removed = { sellOrders: [], buyOrders: [] };

  if (!prevDetails) {
    added.sellOrders = currentDetails.sellOrders || [];
    added.buyOrders = currentDetails.buyOrders || [];
    return { added, removed };
  }

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

  for (const [key, order] of currSellKeys) {
    if (!prevSellKeys.has(key)) {
      added.sellOrders.push(order);
    }
  }

  for (const [key, order] of prevSellKeys) {
    if (!currSellKeys.has(key)) {
      removed.sellOrders.push(order);
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

  for (const [key, order] of currBuyKeys) {
    if (!prevBuyKeys.has(key)) {
      added.buyOrders.push(order);
    }
  }

  for (const [key, order] of prevBuyKeys) {
    if (!currBuyKeys.has(key)) {
      removed.buyOrders.push(order);
    }
  }

  return { added, removed };
}

/**
 * Update market data and detect changes
 */
async function updateMarketData(options = {}) {
  const { maxItemsPerUpdate = 100, fullUpdate = false } = options;

  console.log('\n=== Market Update ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Fetch market data
    const marketData = await fetchMarketData();
    console.log(`✓ Found ${marketData.items.length} items with orders`);

    const previousState = state.currentState;
    const previousOrderDetails = state.orderDetails;

    // Detect changed items
    const changedItemIds = detectChangedItemIds(previousState, marketData);
    console.log(`✓ Detected ${changedItemIds.length} changed items`);

    // Build order details
    const allItemIds = marketData.items.map(item => item.id);
    let orderDetails = { ...previousOrderDetails };

    // Remove items that no longer have orders
    for (const key of Object.keys(orderDetails)) {
      if (!allItemIds.includes(key) && !allItemIds.includes(String(key))) {
        delete orderDetails[key];
      }
    }

    // Find missing items
    const missingDetailIds = allItemIds.filter(id => !orderDetails[id] && !orderDetails[String(id)]);

    // Prioritize changed items, then missing items
    const itemIdsToFetch = [...changedItemIds, ...missingDetailIds.filter(id => !changedItemIds.includes(id))];

    if (itemIdsToFetch.length > 0) {
      const itemsToFetch = marketData.items.filter(item => itemIdsToFetch.includes(item.id));

      if (fullUpdate) {
        console.log(`⚠ FULL UPDATE MODE - Fetching ALL ${itemsToFetch.length} items (this will take a while)`);
        const fetchedOrderDetails = await fetchOrdersForItems(itemsToFetch);
        orderDetails = { ...orderDetails, ...fetchedOrderDetails };
      } else {
        console.log(`Fetching order details for up to ${maxItemsPerUpdate} items (${changedItemIds.length} changed, ${missingDetailIds.length} missing)`);
        console.log(`⚠ Rate limiting active: 50ms between requests, 500ms between batches`);
        const fetchedOrderDetails = await fetchOrdersForItems(itemsToFetch, maxItemsPerUpdate);
        orderDetails = { ...orderDetails, ...fetchedOrderDetails };
      }
    }

    // Detect changes
    const detectedChanges = detectChanges(previousState, marketData);

    // Collect detailed change output to display at the end
    const changeDetailsOutput = [];

    if (detectedChanges.length > 0) {
      console.log(`\n✓ Detected ${detectedChanges.length} changes`);

      // Attach order details and diff
      let changesWithoutDetails = 0;
      const changesWithOrders = detectedChanges.map(change => {
        const currentDetails = orderDetails[change.itemId];
        const prevDetails = previousOrderDetails[change.itemId];

        const enhancedChange = { ...change };

        if (currentDetails) {
          const orderDiff = diffOrders(prevDetails, currentDetails);

          // Store only added/removed orders (diff), not full orderDetails
          // Full details are already in order_details table
          enhancedChange.addedOrders = orderDiff.added;
          enhancedChange.removedOrders = orderDiff.removed;
          // Store minimal stats for quick reference
          enhancedChange.stats = currentDetails.stats || {};

          // Collect detailed change info for later display
          const itemInfo = `${change.itemName} [T${change.tier} ${change.rarity}]`;
          changeDetailsOutput.push(`  - ${itemInfo} (${change.type})`);
          if (change.type === 'order_change') {
            changeDetailsOutput.push(`    Delta: sell ${change.delta.sellOrders > 0 ? '+' : ''}${change.delta.sellOrders}, buy ${change.delta.buyOrders > 0 ? '+' : ''}${change.delta.buyOrders}`);
          }
          if (orderDiff.added.sellOrders.length > 0 || orderDiff.added.buyOrders.length > 0) {
            changeDetailsOutput.push(`    📥 Added: ${orderDiff.added.sellOrders.length} sell, ${orderDiff.added.buyOrders.length} buy`);
            orderDiff.added.sellOrders.forEach(o => {
              changeDetailsOutput.push(`       ➕ SELL: ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
            orderDiff.added.buyOrders.forEach(o => {
              changeDetailsOutput.push(`       ➕ BUY:  ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
          }
          if (orderDiff.removed.sellOrders.length > 0 || orderDiff.removed.buyOrders.length > 0) {
            changeDetailsOutput.push(`    📤 Removed: ${orderDiff.removed.sellOrders.length} sell, ${orderDiff.removed.buyOrders.length} buy`);
            orderDiff.removed.sellOrders.forEach(o => {
              changeDetailsOutput.push(`       ➖ SELL: ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
            orderDiff.removed.buyOrders.forEach(o => {
              changeDetailsOutput.push(`       ➖ BUY:  ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
          }
        } else {
          changesWithoutDetails++;
          enhancedChange.missingOrderDetails = true;
          changeDetailsOutput.push(`  ⚠ ${change.itemName}: Change recorded without order details (not yet fetched)`);
        }

        return enhancedChange;
      });

      if (changesWithoutDetails > 0) {
        changeDetailsOutput.push(`\n⚠ WARNING: ${changesWithoutDetails}/${detectedChanges.length} changes recorded WITHOUT detailed order information`);
        changeDetailsOutput.push(`  These changes will show in the UI but won't display individual added/removed orders`);
        changeDetailsOutput.push(`  Order details will be fetched in subsequent update cycles`);
      }

      // Add to change history
      const changeEntry = {
        timestamp: Date.now(),
        changes: changesWithOrders
      };
      state.changes.push(changeEntry);

      // Keep last 1000 entries
      if (state.changes.length > 1000) {
        state.changes.shift();
      }

      state.changeCount += detectedChanges.length;
    } else {
      console.log('\n✓ No changes detected');
    }

    // Update state
    state.currentState = marketData;
    state.orderDetails = orderDetails;
    state.lastUpdate = Date.now();

    console.log(`\n✓ State updated:`);
    console.log(`  - Items with orders: ${marketData.items.length}`);
    console.log(`  - Items with order details: ${Object.keys(orderDetails).length}`);
    console.log(`  - Total changes recorded: ${state.changeCount}`);

    saveState();

    // Display detailed change information at the end
    if (changeDetailsOutput.length > 0) {
      console.log(`\n✓ Detected ${detectedChanges.length} changes with details`);
      changeDetailsOutput.forEach(line => console.log(line));
    }

  } catch (error) {
    console.error('\n✗ Error updating market data:', error);
    throw error;
  }
}

/**
 * Show current state
 */
function showState() {
  console.log('\n=== Current State ===');

  if (!state.currentState) {
    console.log('No state data available. Run "update" first.');
    return;
  }

  console.log(`Last Update: ${new Date(state.lastUpdate).toLocaleString()}`);
  console.log(`Items with orders: ${state.currentState.items.length}`);
  console.log(`Items with order details: ${Object.keys(state.orderDetails).length}`);
  console.log(`Total changes: ${state.changeCount}`);
  console.log(`Change entries: ${state.changes.length}`);

  console.log('\nTop 10 items by order count:');
  const sortedItems = [...state.currentState.items].sort((a, b) => b.totalOrders - a.totalOrders);
  sortedItems.slice(0, 10).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.name} - ${item.totalOrders} orders (${item.sellOrders} sell, ${item.buyOrders} buy)`);
  });
}

/**
 * Show recent changes
 */
function showChanges(limit = 50) {
  console.log('\n=== Recent Changes ===');

  if (state.changes.length === 0) {
    console.log('No changes recorded yet.');
    return;
  }

  const recentChanges = state.changes.slice(-limit);

  console.log(`Showing ${recentChanges.length} most recent change entries:\n`);

  for (let i = recentChanges.length - 1; i >= 0; i--) {
    const entry = recentChanges[i];
    console.log(`[${new Date(entry.timestamp).toLocaleString()}]`);

    entry.changes.forEach(change => {
      const itemInfo = `${change.itemName} [T${change.tier || '?'} ${change.rarity || 'Unknown'}]`;
      console.log(`  ${itemInfo}:`);

      if (change.type === 'new_item') {
        console.log(`    🆕 NEW - ${change.totalOrders} orders (${change.sellOrders} sell, ${change.buyOrders} buy)`);
      } else if (change.type === 'order_change') {
        console.log(`    🔄 CHANGED - sell ${change.delta.sellOrders > 0 ? '+' : ''}${change.delta.sellOrders}, buy ${change.delta.buyOrders > 0 ? '+' : ''}${change.delta.buyOrders}`);
      } else if (change.type === 'item_removed') {
        console.log(`    ❌ REMOVED - all ${change.previous.totalOrders} orders gone`);
      }

      if (change.addedOrders) {
        const totalAdded = change.addedOrders.sellOrders.length + change.addedOrders.buyOrders.length;
        if (totalAdded > 0) {
          console.log(`    📥 Added ${change.addedOrders.sellOrders.length} sell, ${change.addedOrders.buyOrders.length} buy orders`);
          change.addedOrders.sellOrders.forEach(o => {
            console.log(`       ➕ SELL: ${o.claimName} - ${o.quantity} @ ${o.priceThreshold}`);
          });
          change.addedOrders.buyOrders.forEach(o => {
            console.log(`       ➕ BUY:  ${o.claimName} - ${o.quantity} @ ${o.priceThreshold}`);
          });
        }
      }

      if (change.removedOrders) {
        const totalRemoved = change.removedOrders.sellOrders.length + change.removedOrders.buyOrders.length;
        if (totalRemoved > 0) {
          console.log(`    📤 Removed ${change.removedOrders.sellOrders.length} sell, ${change.removedOrders.buyOrders.length} buy orders`);
          change.removedOrders.sellOrders.forEach(o => {
            console.log(`       ➖ SELL: ${o.claimName} - ${o.quantity} @ ${o.priceThreshold}`);
          });
          change.removedOrders.buyOrders.forEach(o => {
            console.log(`       ➖ BUY:  ${o.claimName} - ${o.quantity} @ ${o.priceThreshold}`);
          });
        }
      }
    });

    console.log();
  }
}

/**
 * Debug orders for a specific claim
 */
async function debugClaim(claimName, options = {}) {
  console.log(`\n=== Debug Claim: "${claimName}" ===\n`);

  if (!state.currentState) {
    console.log('No state data available. Run "update" first.');
    return;
  }

  // Find all orders for this claim
  let totalOrders = 0;
  const claimOrders = [];

  for (const [itemId, details] of Object.entries(state.orderDetails)) {
    const sellOrders = (details.sellOrders || []).filter(o => o.claimName === claimName);
    const buyOrders = (details.buyOrders || []).filter(o => o.claimName === claimName);

    if (sellOrders.length > 0 || buyOrders.length > 0) {
      const item = state.currentState.items.find(i => i.id == itemId);
      claimOrders.push({
        itemId,
        itemName: item?.name || `Item ${itemId}`,
        sellOrders,
        buyOrders
      });
      totalOrders += sellOrders.length + buyOrders.length;
    }
  }

  if (claimOrders.length === 0) {
    console.log(`No orders found for claim "${claimName}" in tracked items.`);
    console.log('\nThis could mean:');
    console.log('  1. The claim has no orders in region 4 (Solvenar)');
    console.log('  2. The claim name is spelled differently');
    console.log('  3. The orders haven\'t been fetched yet');
    console.log('\nAvailable claims in current data:');

    const allClaims = new Set();
    for (const details of Object.values(state.orderDetails)) {
      [...(details.sellOrders || []), ...(details.buyOrders || [])].forEach(o => {
        if (o.claimName) allClaims.add(o.claimName);
      });
    }

    const sortedClaims = Array.from(allClaims).sort();
    sortedClaims.forEach(name => console.log(`  - ${name}`));

    // Offer to fetch missing items
    if (options.fetchMissing !== false) {
      console.log('\n💡 Tip: Your claim might be in items not yet cached.');
      console.log('   Run "node local-monitor.js update-bulk" to quickly check ALL items.');
    }

    return;
  }

  console.log(`Found ${totalOrders} orders across ${claimOrders.length} items:\n`);

  claimOrders.forEach(({ itemName, sellOrders, buyOrders }) => {
    console.log(`${itemName}:`);

    if (sellOrders.length > 0) {
      console.log(`  Sell Orders (${sellOrders.length}):`);
      sellOrders.forEach(o => {
        console.log(`    ${o.quantity} @ ${o.priceThreshold} hex (owner: ${o.ownerName})`);
      });
    }

    if (buyOrders.length > 0) {
      console.log(`  Buy Orders (${buyOrders.length}):`);
      buyOrders.forEach(o => {
        console.log(`    ${o.quantity} @ ${o.priceThreshold} hex (owner: ${o.ownerName})`);
      });
    }

    console.log();
  });
}

/**
 * Update using bulk API - much faster!
 * This fetches order counts for ALL items, then only fetches details for changed items
 */
async function updateMarketDataBulk(options = {}) {
  const { maxDetailsFetch = 100 } = options;

  console.log('\n=== Market Update (Bulk Mode) ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Step 1: Fetch list of items with orders
    const marketData = await fetchMarketData();
    console.log(`✓ Found ${marketData.items.length} items with orders`);

    // Step 2: Fetch bulk prices for ALL items (fast!)
    const bulkPrices = await fetchAllBulkPrices(marketData.items);
    console.log(`✓ Got bulk price data for ${Object.keys(bulkPrices).length} items`);

    // Step 3: Detect changes using bulk data
    const previousState = state.currentState;
    const changedItemIds = [];

    if (previousState && previousState.items) {
      const prevMap = new Map();
      previousState.items.forEach(item => {
        prevMap.set(item.id, item);
      });

      marketData.items.forEach(item => {
        const bulkData = bulkPrices[item.id];
        if (!bulkData) return;

        // Update item with bulk data
        item.sellOrders = bulkData.sellOrders;
        item.buyOrders = bulkData.buyOrders;
        item.totalOrders = bulkData.totalOrders;

        const prevItem = prevMap.get(item.id);
        if (!prevItem) {
          changedItemIds.push(item.id);
        } else if (
          item.sellOrders !== prevItem.sellOrders ||
          item.buyOrders !== prevItem.buyOrders ||
          item.totalOrders !== prevItem.totalOrders
        ) {
          changedItemIds.push(item.id);
        }
      });
    } else {
      // First run - update all items with bulk data
      marketData.items.forEach(item => {
        const bulkData = bulkPrices[item.id];
        if (bulkData) {
          item.sellOrders = bulkData.sellOrders;
          item.buyOrders = bulkData.buyOrders;
          item.totalOrders = bulkData.totalOrders;
        }
      });
    }

    console.log(`✓ Detected ${changedItemIds.length} changed items`);

    // Step 4: Fetch detailed orders only for changed items (and missing items up to limit)
    const allItemIds = marketData.items.map(item => item.id);
    let orderDetails = { ...state.orderDetails };

    // Remove items that no longer have orders
    for (const key of Object.keys(orderDetails)) {
      if (!allItemIds.includes(key) && !allItemIds.includes(String(key))) {
        delete orderDetails[key];
      }
    }

    // Find missing items
    const missingDetailIds = allItemIds.filter(id => !orderDetails[id] && !orderDetails[String(id)]);

    // PRIORITY CHANGE: Always fetch ALL changed items first to ensure accurate change diffs
    // Changed items MUST have their order details to show added/removed orders
    const changedItemsToFetch = marketData.items.filter(item => changedItemIds.includes(item.id));

    if (changedItemsToFetch.length > 0) {
      console.log(`\nFetching detailed orders for ${changedItemsToFetch.length} CHANGED items (required for accurate diffs)`);
      console.log(`⚠ Rate limiting active: 50ms between requests, 500ms between batches`);

      const fetchedOrderDetails = await fetchOrdersForItems(changedItemsToFetch);
      orderDetails = { ...orderDetails, ...fetchedOrderDetails };
    }

    // Then fetch missing items up to remaining capacity
    const remainingCapacity = maxDetailsFetch - changedItemsToFetch.length;
    if (remainingCapacity > 0 && missingDetailIds.length > 0) {
      const missingItemsToFetch = marketData.items
        .filter(item => missingDetailIds.includes(item.id))
        .slice(0, remainingCapacity);

      if (missingItemsToFetch.length > 0) {
        console.log(`\nFetching detailed orders for ${missingItemsToFetch.length} missing items (gradual backfill)`);
        const fetchedMissingDetails = await fetchOrdersForItems(missingItemsToFetch);
        orderDetails = { ...orderDetails, ...fetchedMissingDetails };
      }
    }

    // Detect changes with detailed order info
    const detectedChanges = detectChanges(previousState, marketData);

    // Collect detailed change output to display at the end
    const changeDetailsOutput = [];

    if (detectedChanges.length > 0) {
      console.log(`\n✓ Detected ${detectedChanges.length} changes`);

      // Track changes without detailed order information
      let changesWithoutDetails = 0;

      const changesWithOrders = detectedChanges.map(change => {
        const currentDetails = orderDetails[change.itemId];
        const prevDetails = state.orderDetails[change.itemId];

        const enhancedChange = { ...change };

        if (currentDetails) {
          const orderDiff = diffOrders(prevDetails, currentDetails);
          // Store only added/removed orders (diff), not full orderDetails
          // Full details are already in order_details table
          enhancedChange.addedOrders = orderDiff.added;
          enhancedChange.removedOrders = orderDiff.removed;
          // Store minimal stats for quick reference
          enhancedChange.stats = currentDetails.stats || {};

          // Collect detailed change info for later display
          const itemInfo = `${change.itemName} [T${change.tier} ${change.rarity}]`;
          changeDetailsOutput.push(`  - ${itemInfo} (${change.type})`);
          if (change.type === 'order_change') {
            changeDetailsOutput.push(`    Delta: sell ${change.delta.sellOrders > 0 ? '+' : ''}${change.delta.sellOrders}, buy ${change.delta.buyOrders > 0 ? '+' : ''}${change.delta.buyOrders}`);
          }
          if (orderDiff.added.sellOrders.length > 0 || orderDiff.added.buyOrders.length > 0) {
            changeDetailsOutput.push(`    📥 Added: ${orderDiff.added.sellOrders.length} sell, ${orderDiff.added.buyOrders.length} buy`);
            orderDiff.added.sellOrders.forEach(o => {
              changeDetailsOutput.push(`       ➕ SELL: ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
            orderDiff.added.buyOrders.forEach(o => {
              changeDetailsOutput.push(`       ➕ BUY:  ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
          }
          if (orderDiff.removed.sellOrders.length > 0 || orderDiff.removed.buyOrders.length > 0) {
            changeDetailsOutput.push(`    📤 Removed: ${orderDiff.removed.sellOrders.length} sell, ${orderDiff.removed.buyOrders.length} buy`);
            orderDiff.removed.sellOrders.forEach(o => {
              changeDetailsOutput.push(`       ➖ SELL: ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
            orderDiff.removed.buyOrders.forEach(o => {
              changeDetailsOutput.push(`       ➖ BUY:  ${o.claimName} - ${o.quantity} @ ${o.priceThreshold} hex`);
            });
          }
        } else {
          changesWithoutDetails++;
          // Mark changes without detailed order information
          enhancedChange.missingOrderDetails = true;
          changeDetailsOutput.push(`  ⚠ ${change.itemName}: Change recorded without order details (not yet fetched)`);
        }

        return enhancedChange;
      });

      if (changesWithoutDetails > 0) {
        changeDetailsOutput.push(`\n⚠ WARNING: ${changesWithoutDetails}/${detectedChanges.length} changes recorded WITHOUT detailed order information`);
        changeDetailsOutput.push(`  These changes will show in the UI but won't display individual added/removed orders`);
        changeDetailsOutput.push(`  Order details will be fetched in subsequent update cycles`);
      }

      const changeEntry = {
        timestamp: Date.now(),
        changes: changesWithOrders
      };
      state.changes.push(changeEntry);

      if (state.changes.length > 1000) {
        state.changes.shift();
      }

      state.changeCount += detectedChanges.length;
    } else {
      console.log('\n✓ No changes detected');
    }

    // Update state
    state.currentState = marketData;
    state.orderDetails = orderDetails;
    state.lastUpdate = Date.now();

    console.log(`\n✓ State updated:`);
    console.log(`  - Items with orders: ${marketData.items.length}`);
    console.log(`  - Items with detailed orders: ${Object.keys(orderDetails).length}`);
    console.log(`  - Total changes recorded: ${state.changeCount}`);

    saveState();

    // Display detailed change information at the end
    if (changeDetailsOutput.length > 0) {
      console.log(`\n✓ Detected ${detectedChanges.length} changes with details`);
      changeDetailsOutput.forEach(line => console.log(line));
    }

  } catch (error) {
    console.error('\n✗ Error updating market data:', error);
    throw error;
  }
}

/**
 * Sync local data to Supabase (OPTIMIZED - only syncs changed data)
 * Dramatically reduces egress by tracking what's already been synced
 */
async function syncToSupabase(options = {}) {
  const { forceFullSync = false } = options;

  console.log('\n=== Syncing to Supabase (Optimized) ===');

  if (!supabaseClient) {
    console.error('✗ Supabase client not initialized. Check your .env file.');
    return { success: false, egress: 0 };
  }

  if (!state.currentState || Object.keys(state.orderDetails).length === 0) {
    console.log('⚠ No data to sync. Run an update first.');
    return { success: false, egress: 0 };
  }

  const totalItems = state.currentState.items.length;
  const totalOrderDetails = Object.keys(state.orderDetails).length;

  // Track egress for this sync cycle
  let cycleEgress = 0;

  // Initialize sync state if needed
  if (!state.syncState) {
    state.syncState = {
      lastSyncTime: null,
      syncedItemHashes: {},
      syncedOrderHashes: {},
      lastSyncedChangeIndex: 0
    };
  }

  try {
    // Step 1: Find changed market items only
    console.log('\n  Step 1/4: Checking for changed market items...');

    const changedItemsMap = new Map(); // Use Map to auto-deduplicate by item ID
    const itemsMap = new Map();

    state.currentState.items.forEach(item => {
      const itemData = {
        item_id: item.id,
        item_name: item.name,
        item_type: item.itemType || 0,
        tier: item.tier || 0,
        rarity: item.rarityStr || item.rarity || '',
        category: item.tag || item.category || '',
        sell_orders: item.sellOrders,
        buy_orders: item.buyOrders,
        total_orders: item.totalOrders,
        last_updated: new Date().toISOString()
      };
      itemsMap.set(item.id, itemData);

      // Check if item has changed since last sync
      const currentHash = hashObject({
        sell_orders: item.sellOrders,
        buy_orders: item.buyOrders,
        total_orders: item.totalOrders
      });

      if (forceFullSync || state.syncState.syncedItemHashes[item.id] !== currentHash) {
        changedItemsMap.set(item.id, itemData); // Map auto-deduplicates
        state.syncState.syncedItemHashes[item.id] = currentHash;
      }
    });

    const changedItems = Array.from(changedItemsMap.values());

    if (changedItems.length > 0) {
      const itemsBytes = calculateByteSize(changedItems);
      cycleEgress += itemsBytes;
      await supabaseClient.upsertMarketItems(changedItems);
      console.log(`  ✓ Uploaded ${changedItems.length} changed items (${formatBytes(itemsBytes)}) - skipped ${totalItems - changedItems.length} unchanged`);
    } else {
      console.log(`  ✓ No market items changed - skipped upload`);
    }

    // Step 2: Find changed order details only
    console.log('\n  Step 2/4: Checking for changed order details...');

    const marketItemIds = new Set(Array.from(itemsMap.keys()).map(String));
    const changedOrderDetails = [];

    for (const [itemId, details] of Object.entries(state.orderDetails)) {
      // Skip if item no longer exists in market
      if (!marketItemIds.has(String(itemId))) {
        continue;
      }

      // Check if order details have changed
      const currentHash = hashObject(details);

      if (forceFullSync || state.syncState.syncedOrderHashes[itemId] !== currentHash) {
        changedOrderDetails.push({
          item_id: parseInt(itemId),
          sell_orders: details.sellOrders || [],
          buy_orders: details.buyOrders || [],
          stats: details.stats || {},
          last_updated: new Date().toISOString()
        });
        state.syncState.syncedOrderHashes[itemId] = currentHash;
      }
    }

    if (changedOrderDetails.length > 0) {
      // Calculate egress for all order details
      const orderDetailsBytes = calculateByteSize(changedOrderDetails);
      cycleEgress += orderDetailsBytes;

      // Upload in batches
      const BATCH_SIZE = 100;
      const numBatches = Math.ceil(changedOrderDetails.length / BATCH_SIZE);

      for (let i = 0; i < numBatches; i++) {
        const batchStart = i * BATCH_SIZE;
        const batchEnd = Math.min((i + 1) * BATCH_SIZE, changedOrderDetails.length);
        const batch = changedOrderDetails.slice(batchStart, batchEnd);

        await supabaseClient.upsertOrderDetailsBulk(batch);

        if (numBatches > 1) {
          console.log(`  ✓ Batch ${i + 1}/${numBatches}: ${batch.length} order details`);
        }

        if (i < numBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`  ✓ Uploaded ${changedOrderDetails.length} changed order details (${formatBytes(orderDetailsBytes)}) - skipped ${totalOrderDetails - changedOrderDetails.length} unchanged`);
    } else {
      console.log(`  ✓ No order details changed - skipped upload`);
    }

    // Step 3: Upload only NEW change entries (incremental)
    console.log('\n  Step 3/4: Uploading new change entries...');

    const newChanges = state.changes.slice(state.syncState.lastSyncedChangeIndex);

    if (newChanges.length > 0) {
      const changesBytes = calculateByteSize(newChanges);
      cycleEgress += changesBytes;

      for (const changeEntry of newChanges) {
        await supabaseClient.insertChange(changeEntry.changes);
      }
      state.syncState.lastSyncedChangeIndex = state.changes.length;
      console.log(`  ✓ Uploaded ${newChanges.length} new change entries (${formatBytes(changesBytes)})`);
    } else {
      console.log(`  ✓ No new changes to upload`);
    }

    // Step 4: Update metadata (always update timestamp)
    console.log('\n  Step 4/4: Updating metadata...');
    const metadataBytes = calculateByteSize({
      last_update: state.lastUpdate || Date.now(),
      change_count: state.changeCount || 0
    });
    cycleEgress += metadataBytes;
    await supabaseClient.updateMetadata('last_update', state.lastUpdate || Date.now());
    await supabaseClient.updateMetadata('change_count', state.changeCount || 0);
    console.log(`  ✓ Updated metadata`);

    // Update sync state
    state.syncState.lastSyncTime = Date.now();
    saveState();

    // Calculate what was skipped
    const itemsSaved = totalItems - changedItems.length;
    const ordersSaved = totalOrderDetails - changedOrderDetails.length;
    const changesSaved = state.changes.length - newChanges.length;

    console.log('\n✓ Optimized sync complete!');
    console.log(`  Uploaded: ${changedItems.length} items, ${changedOrderDetails.length} orders, ${newChanges.length} changes`);
    console.log(`  Skipped:  ${itemsSaved} items, ${ordersSaved} orders, ${changesSaved} changes (already synced)`);
    console.log(`  Egress used: ${formatBytes(cycleEgress)}`);

    return { success: true, egress: cycleEgress };
  } catch (error) {
    console.error('✗ Error syncing to Supabase:', error.message);
    console.error('  Stack:', error.stack);
    return { success: false, egress: cycleEgress };
  }
}

/**
 * Force a full sync to Supabase (ignores cached hashes)
 * Use this after a reset or when data seems out of sync
 */
async function syncToSupabaseFull() {
  console.log('⚠ Forcing full sync (ignoring cache)...');

  // Clear sync state to force full upload
  state.syncState = {
    lastSyncTime: null,
    syncedItemHashes: {},
    syncedOrderHashes: {},
    lastSyncedChangeIndex: 0
  };

  return syncToSupabase({ forceFullSync: true });
}

// Keep legacy function for backwards compatibility (redirects to Supabase)
async function syncToWorker() {
  console.warn('⚠ syncToWorker() is deprecated. Using syncToSupabase() instead.');
  return syncToSupabase();
}

/**
 * Initial setup mode - fetch all items and sync to Supabase
 */
async function setupMode() {
  console.log('\n=== Initial Setup Mode ===');
  console.log('This will fetch ALL market items and upload to Supabase.');
  console.log('Estimated time: 15-20 minutes\n');

  const startTime = Date.now();

  try {
    // Step 1: Fetch market data
    console.log('Step 1: Fetching market data...');
    const marketData = await fetchMarketData();
    console.log(`✓ Found ${marketData.items.length} items with orders`);

    // Step 2: Find items we haven't fetched yet
    const existingIds = new Set(Object.keys(state.orderDetails));
    const itemsToFetch = marketData.items.filter(item => !existingIds.has(String(item.id)));

    console.log(`\nAlready have details for: ${existingIds.size} items`);
    console.log(`Need to fetch: ${itemsToFetch.length} items`);

    if (itemsToFetch.length === 0) {
      console.log('\n✓ Already have all item details!');
    } else {
      // Step 3: Fetch all items with rate limiting
      console.log('\nStep 2: Fetching order details for all items...');
      console.log('⚠ Rate limiting active: 50ms between requests, 500ms between batches\n');

      let successCount = 0;
      let failCount = 0;

      const batchSize = 10;
      const delayBetweenBatches = 500;
      const delayBetweenRequests = 50;

      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);

        for (const item of batch) {
          const result = await fetchItemOrders(item.id, item.itemType);
          if (result) {
            state.orderDetails[result.itemId] = result;
            successCount++;
          } else {
            failCount++;
          }

          if (delayBetweenRequests > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }
        }

        // Show progress
        const fetched = Math.min(i + batchSize, itemsToFetch.length);
        const percent = Math.round((fetched / itemsToFetch.length) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = fetched / elapsed;
        const remaining = Math.round((itemsToFetch.length - fetched) / rate);

        console.log(`  Progress: ${fetched}/${itemsToFetch.length} (${percent}%) - ${successCount} successful, ${failCount} failed - ${elapsed}s elapsed, ~${remaining}s remaining`);

        // Save state periodically
        if (i > 0 && i % (batchSize * 10) === 0) {
          saveState();
        }

        if (i + batchSize < itemsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      console.log(`\n✓ Fetched ${successCount} item details`);
      if (failCount > 0) {
        console.log(`⚠ Failed to fetch ${failCount} items`);
      }
    }

    // Update state
    state.currentState = marketData;
    state.lastUpdate = Date.now();
    saveState();

    // Step 4: Full sync to Supabase (setup mode always does full sync)
    console.log('\nStep 3: Syncing to Supabase (full sync)...');
    const syncResult = await syncToSupabaseFull();

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n${'='.repeat(50)}`);
    console.log('✅ Initial Setup Complete!');
    console.log(`Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
    console.log(`Total items with details: ${Object.keys(state.orderDetails).length}`);

    if (syncResult && syncResult.egress) {
      console.log(`Total egress used: ${formatBytes(syncResult.egress)}`);
    }

    if (syncResult && syncResult.success) {
      console.log('\n✅ Data is now available on the website!');
      console.log('   https://jbaird-bitcraftmarkethelper.pages.dev/market-monitor.html');
    } else {
      console.log('\n⚠ Sync failed. You can retry with:');
      console.log('   node sync-to-worker.js');
    }

    console.log(`\n${'='.repeat(50)}`);

  } catch (error) {
    console.error('\n✗ Error during setup:', error);
    console.log('\nSaving partial progress...');
    saveState();
    throw error;
  }
}

/**
 * Cleanup old market changes from Supabase (older than 8 hours)
 */
async function cleanupOldChanges() {
  console.log('\n=== Cleaning up old market changes ===');

  if (!supabaseClient) {
    console.log('⚠ Supabase client not initialized. Skipping cleanup.');
    return { success: false, deletedCount: 0 };
  }

  try {
    // Calculate cutoff time (8 hours ago)
    const cutoffTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    console.log(`Deleting records older than: ${cutoffTime}`);

    // Delete old records using Supabase REST API
    // Format: timestamp=lt.{cutoffTime} means "timestamp less than cutoffTime"
    const result = await supabaseClient.request(
      'DELETE',
      `/rest/v1/market_changes?timestamp=lt.${cutoffTime}`,
      null,
      { 'Prefer': 'return=representation' }
    );

    const deletedCount = Array.isArray(result) ? result.length : 0;
    console.log(`✓ Deleted ${deletedCount} old change records`);

    return { success: true, deletedCount };
  } catch (error) {
    console.error('✗ Error cleaning up old changes:', error.message);
    return { success: false, deletedCount: 0 };
  }
}

/**
 * Monitor mode - continuously check for changes and sync to worker
 */
async function monitorMode(intervalSeconds = 120) {
  console.log('\n=== Continuous Monitor Mode ===');
  console.log(`Checking for changes every ${intervalSeconds} seconds.`);
  console.log(`Cleaning up records older than 8 hours every hour.`);
  console.log('Press Ctrl+C to stop.\n');

  let runCount = 0;
  // Reset run egress counter at the start of monitor mode
  totalRunEgress = 0;

  const doUpdate = async () => {
    runCount++;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Run #${runCount} - ${new Date().toISOString()}`);
    console.log(`${'='.repeat(50)}`);

    try {
      // Use bulk API to detect changes quickly
      await updateMarketDataBulk({ maxDetailsFetch: 200 });

      // Sync to Supabase
      console.log('\nSyncing to Supabase...');
      const syncResult = await syncToSupabase();

      // Track egress
      if (syncResult && syncResult.egress) {
        totalRunEgress += syncResult.egress;
        console.log(`\n📊 Egress Stats:`);
        console.log(`  This cycle: ${formatBytes(syncResult.egress)}`);
        console.log(`  Total run:  ${formatBytes(totalRunEgress)}`);
      }

      // Run cleanup every hour (every 30th run if interval is 120s)
      const runsPerHour = Math.ceil(3600 / intervalSeconds);
      if (runCount % runsPerHour === 0) {
        await cleanupOldChanges();
      }

      console.log(`\n✓ Update complete. Next check in ${intervalSeconds}s`);
    } catch (error) {
      console.error('\n✗ Error during update:', error.message);
      console.log(`Will retry in ${intervalSeconds}s`);
    }
  };

  // Initial update
  await doUpdate();

  // Set up interval
  setInterval(doUpdate, intervalSeconds * 1000);
}

/**
 * Watch mode - continuously monitor
 */
async function watchMode(intervalSeconds = 60) {
  console.log(`\n=== Watch Mode ===`);
  console.log(`Monitoring every ${intervalSeconds} seconds. Press Ctrl+C to stop.\n`);

  // Initial update
  await updateMarketData();

  // Set up interval
  setInterval(async () => {
    await updateMarketData();
  }, intervalSeconds * 1000);
}

/**
 * Reset state
 */
async function resetState() {
  console.log('\n=== Reset State ===');

  // Reset in-memory state (including sync tracking)
  state = {
    currentState: null,
    orderDetails: {},
    changes: [],
    changeCount: 0,
    lastUpdate: null,
    syncState: {
      lastSyncTime: null,
      syncedItemHashes: {},
      syncedOrderHashes: {},
      lastSyncedChangeIndex: 0
    }
  };

  // Delete local state file
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log('✓ Deleted local state file');
  }

  // Clear Supabase database if client is available
  if (supabaseClient) {
    try {
      console.log('\n🗑️  Clearing Supabase database...');

      // Use the REST API to delete all data
      // Supabase requires a filter to delete records - we'll use a condition that matches all
      // Delete in order due to foreign key constraints: changes, order_details, market_items

      // 1. Delete all market changes (id >= 0 matches all records)
      await supabaseClient.request('DELETE', '/rest/v1/market_changes?id=gte.0', null, {
        'Prefer': 'return=minimal'
      });
      console.log('  ✓ Cleared market_changes table');

      // 2. Delete all order details (item_id >= 0 matches all records)
      await supabaseClient.request('DELETE', '/rest/v1/order_details?item_id=gte.0', null, {
        'Prefer': 'return=minimal'
      });
      console.log('  ✓ Cleared order_details table');

      // 3. Delete all market items (item_id >= 0 matches all records)
      await supabaseClient.request('DELETE', '/rest/v1/market_items?item_id=gte.0', null, {
        'Prefer': 'return=minimal'
      });
      console.log('  ✓ Cleared market_items table');

      // 4. Reset metadata
      await supabaseClient.updateMetadata('last_update', null);
      await supabaseClient.updateMetadata('change_count', 0);
      console.log('  ✓ Reset metadata');

      console.log('\n✅ Supabase database cleared successfully');
    } catch (error) {
      console.error('⚠️  Error clearing Supabase database:', error.message);
      console.error('   You may need to manually clear the database using SQL:');
      console.error('   TRUNCATE TABLE market_changes, order_details, market_items CASCADE;');
    }
  } else {
    console.log('\n⚠️  Supabase client not initialized - skipping database clear');
    console.log('   Only local state file was deleted');
  }

  console.log('\n✓ Reset complete');
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'update';

  // Load state from disk
  loadState();

  try {
    switch (command) {
      case 'update':
        const maxItems = parseInt(args[1]) || 100;
        const fullUpdate = args.includes('--full');
        await updateMarketData({ maxItemsPerUpdate: maxItems, fullUpdate });
        break;

      case 'update-bulk':
        const maxDetailsFetch = parseInt(args[1]) || 100;
        await updateMarketDataBulk({ maxDetailsFetch });
        break;

      case 'setup':
        await setupMode();
        break;

      case 'monitor':
        const monitorInterval = parseInt(args[1]) || 120;
        await monitorMode(monitorInterval);
        break;

      case 'sync':
        {
          const syncResult = await syncToSupabase();
          if (syncResult && syncResult.egress) {
            console.log(`\n📊 Total egress used: ${formatBytes(syncResult.egress)}`);
          }
        }
        break;

      case 'sync-full':
        {
          const syncResult = await syncToSupabaseFull();
          if (syncResult && syncResult.egress) {
            console.log(`\n📊 Total egress used: ${formatBytes(syncResult.egress)}`);
          }
        }
        break;

      case 'state':
        showState();
        break;

      case 'changes':
        const limit = parseInt(args[1]) || 50;
        showChanges(limit);
        break;

      case 'watch':
        const interval = parseInt(args[1]) || 60;
        await watchMode(interval);
        break;

      case 'reset':
        await resetState();
        break;

      case 'debug':
        const claimName = args.slice(1).join(' ');
        if (!claimName) {
          console.error('Usage: node local-monitor.js debug <claim name>');
          process.exit(1);
        }
        await debugClaim(claimName);
        break;

      case 'cleanup':
        await cleanupOldChanges();
        break;

      case 'help':
      case '--help':
      case '-h':
        console.log(`
Local Market Monitor - Usage:

  node local-monitor.js [command] [options]

Commands:
  🚀 AUTOMATED MODES (Recommended):
    setup                   Initial setup: Fetch ALL items + sync to website (~15-20 min)
    monitor [interval]      Continuous: Check for changes + sync every N seconds (default: 120s)
    sync                    Optimized sync - only uploads CHANGED data to Supabase
    sync-full               Force full sync - uploads ALL data (use after reset)

  MANUAL MODES:
    update [max] [--full]   Fetch and update market data (default: 100 items per update)
    update-bulk [max]       Use bulk API to check ALL items, fetch details for changed (default: 100)
    state                   Show current state summary
    changes [limit]         Show recent changes (default: 50)
    watch [interval]        Continuously monitor locally (default: 60s, no sync)
    debug <claim>           Debug orders for a specific claim name
    cleanup                 Delete market changes older than 8 hours from Supabase
    reset                   Reset ALL data (local cache + Supabase database)
    help                    Show this help message

Options:
  --full                    Fetch ALL items (ignores max limit, takes longer)

🎯 QUICK START:
  First time setup:
    node local-monitor.js setup             # Fetch all items + upload to website

  Ongoing monitoring:
    node local-monitor.js monitor           # Auto-check every 2 min + sync to website
    node local-monitor.js monitor 60        # Auto-check every 1 min + sync to website

Manual Examples:
  node local-monitor.js update-bulk 100     # Update 100 items
  node local-monitor.js sync                # Optimized sync (only changed data)
  node local-monitor.js sync-full           # Force full sync
  node local-monitor.js debug "Get Off My Lawn"
  node local-monitor.js state

Update Modes:
  setup          - Initial: Fetch ALL items + sync to website (one-time, ~15-20 min)
  monitor        - Ongoing: Bulk check + fetch changes + sync (every 2 min by default)
  update-bulk    - Manual: Bulk API check + fetch changed items (fast, ~30 requests)
  update         - Manual: One-by-one fetch (slow, ~2964 requests for full update)

⚡ EGRESS OPTIMIZATION:
  The sync command now tracks what has been uploaded and only syncs CHANGED data:
  - Market items: Only uploads items where order counts changed
  - Order details: Only uploads items where orders were added/removed
  - Change history: Appends new changes (no longer deletes and re-uploads all)

  This dramatically reduces Supabase egress usage (typically 90-99% reduction
  during normal monitoring when few items change between syncs).

Notes:
  - "setup" mode: Run once to build complete cache and upload to website
  - "monitor" mode: Run continuously to keep website updated every 2 minutes
  - Bulk mode: Checks ALL 2964 items in ~6 seconds using /api/market/prices/bulk
  - Use "sync-full" if data seems out of sync after a reset
`);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "node local-monitor.js help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  fetchMarketData,
  fetchItemOrders,
  updateMarketData,
  debugClaim,
  syncToSupabase,
  syncToSupabaseFull,
  cleanupOldChanges
};
