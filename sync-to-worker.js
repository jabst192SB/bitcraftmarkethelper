#!/usr/bin/env node
/**
 * Sync local monitor data to Cloudflare Worker
 *
 * Usage: node sync-to-worker.js
 *
 * This uploads your locally cached market data to the Cloudflare Worker's
 * Durable Object storage, making it available to the website.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'local-monitor-state.json');
const WORKER_URL = 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev';

async function syncToWorker() {
  console.log('\n=== Sync Local Data to Cloudflare Worker ===\n');

  // Load local state
  if (!fs.existsSync(STATE_FILE)) {
    console.error('✗ No local state file found.');
    console.log('  Run "node local-monitor.js update" or "node fetch-all-items.js" first.');
    process.exit(1);
  }

  let state;
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    state = JSON.parse(data);
  } catch (error) {
    console.error('✗ Error loading state file:', error.message);
    process.exit(1);
  }

  console.log('Local state summary:');
  console.log(`  - Items tracked: ${state.currentState?.items?.length || 0}`);
  console.log(`  - Order details cached: ${Object.keys(state.orderDetails).length}`);
  console.log(`  - Change entries: ${state.changes?.length || 0}`);
  console.log();

  if (!state.currentState || Object.keys(state.orderDetails).length === 0) {
    console.error('✗ No data to sync. Run an update first.');
    process.exit(1);
  }

  // Prepare data for upload
  const payload = {
    marketData: state.currentState,
    orderDetails: state.orderDetails
  };

  console.log('Uploading to Cloudflare Worker...');
  console.log(`URL: ${WORKER_URL}/api/monitor/update`);

  try {
    const response = await fetch(`${WORKER_URL}/api/monitor/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`✗ Upload failed: ${response.status} ${response.statusText}`);
      console.error(`  Response: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();

    console.log('\n✓ Upload successful!');
    console.log(`  - Changes detected: ${result.changesDetected || 0}`);
    console.log(`  - Total changes tracked: ${result.totalChanges || 0}`);
    console.log(`  - Order details uploaded: ${result.itemsWithOrderDetails || 0}`);

    if (result.changesDetected > 0) {
      console.log(`\n📊 ${result.changesDetected} changes were detected and recorded`);
    }

    console.log('\n✅ Your data is now available on the website!');
    console.log('   Visit: https://jbaird-bitcraftmarkethelper.pages.dev/market-monitor.html');

  } catch (error) {
    console.error('\n✗ Error uploading to worker:', error.message);
    process.exit(1);
  }
}

syncToWorker().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
