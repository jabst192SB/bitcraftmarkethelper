#!/usr/bin/env node
/**
 * Fetch ALL item details - Run this once to build complete cache
 *
 * Usage: node fetch-all-items.js
 *
 * This will fetch full order details for ALL 2964 items with proper rate limiting.
 * Takes ~15-20 minutes but you only need to run it once.
 */

const fs = require('fs');
const path = require('path');

const TARGET_API = 'https://bitjita.com';
const MONITOR_REGION_ID = 4; // Solvenar
const STATE_FILE = path.join(__dirname, 'local-monitor-state.json');

let state = {
  currentState: null,
  orderDetails: {},
  changes: [],
  changeCount: 0,
  lastUpdate: null
};

// Load existing state
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(data);
      console.log('✓ Loaded state from disk');
      console.log(`  - Items tracked: ${state.currentState?.items?.length || 0}`);
      console.log(`  - Order details: ${Object.keys(state.orderDetails).length}`);
    } catch (error) {
      console.error('⚠ Error loading state:', error.message);
    }
  }
}

// Save state
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('✓ Saved state to disk');
  } catch (error) {
    console.error('✗ Error saving state:', error.message);
  }
}

// Fetch market data
async function fetchMarketData() {
  const apiUrl = `${TARGET_API}/api/market?hasOrders=true`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.status}`);
  }

  const data = await response.json();

  return {
    items: data.data?.items || [],
    fetchedAt: Date.now()
  };
}

// Fetch full order details for a specific item or cargo (with retry on 429)
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

// Main function
async function fetchAllItems() {
  console.log('\n=== Fetch ALL Items (Complete Cache) ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Load existing state
    loadState();

    // Fetch market data
    console.log('\nFetching market data...');
    const marketData = await fetchMarketData();
    console.log(`✓ Found ${marketData.items.length} items with orders`);

    // Find items we haven't fetched yet
    const existingIds = new Set(Object.keys(state.orderDetails));
    const itemsToFetch = marketData.items.filter(item => !existingIds.has(String(item.id)));

    console.log(`\nAlready have details for: ${existingIds.size} items`);
    console.log(`Need to fetch: ${itemsToFetch.length} items`);

    if (itemsToFetch.length === 0) {
      console.log('\n✓ Already have all item details!');
      return;
    }

    // Estimate time
    const estimatedMinutes = Math.ceil(itemsToFetch.length * 0.06 / 60); // ~60ms per item
    console.log(`\nEstimated time: ~${estimatedMinutes} minutes`);
    console.log('⚠ Rate limiting active: 50ms between requests, 500ms between batches\n');

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Fetch items with rate limiting
    const batchSize = 10;
    const delayBetweenBatches = 500;
    const delayBetweenRequests = 50;

    for (let i = 0; i < itemsToFetch.length; i += batchSize) {
      const batch = itemsToFetch.slice(i, i + batchSize);

      // Process items sequentially within batch
      for (const item of batch) {
        const result = await fetchItemOrders(item.id, item.itemType);
        if (result) {
          state.orderDetails[result.itemId] = result;
          successCount++;
        } else {
          failCount++;
        }

        // Small delay between individual requests
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

      // Save state periodically (every 10 batches = 100 items)
      if (i > 0 && i % (batchSize * 10) === 0) {
        saveState();
      }

      // Delay between batches
      if (i + batchSize < itemsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Update state
    state.currentState = marketData;
    state.lastUpdate = Date.now();

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n✓ Complete!`);
    console.log(`  - Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
    console.log(`  - Successfully fetched: ${successCount} items`);
    console.log(`  - Failed: ${failCount} items`);
    console.log(`  - Total items with details: ${Object.keys(state.orderDetails).length}`);

    saveState();

    console.log('\n✅ All done!');
    console.log('\nNext steps:');
    console.log('   1. Debug your claim: node local-monitor.js debug "Get Off My Lawn"');
    console.log('   2. Sync to website: node sync-to-worker.js');

  } catch (error) {
    console.error('\n✗ Error:', error);
    console.log('\nSaving partial progress...');
    saveState();
    throw error;
  }
}

// Run it
fetchAllItems().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
