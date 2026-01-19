#!/usr/bin/env node
/**
 * Check progress of cache building
 *
 * Usage: node check-progress.js
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'local-monitor-state.json');

if (!fs.existsSync(STATE_FILE)) {
  console.log('⚠ No state file found. Run update first.');
  process.exit(0);
}

const data = fs.readFileSync(STATE_FILE, 'utf8');
const state = JSON.parse(data);

const totalItems = state.currentState?.items?.length || 0;
const cachedItems = Object.keys(state.orderDetails).length;
const remaining = totalItems - cachedItems;
const percent = totalItems > 0 ? Math.round((cachedItems / totalItems) * 100) : 0;

console.log('\n=== Cache Progress ===\n');
console.log(`Total items with orders: ${totalItems}`);
console.log(`Items with cached details: ${cachedItems}`);
console.log(`Remaining to fetch: ${remaining}`);
console.log(`Progress: ${percent}%`);

if (remaining > 0) {
  const estimatedMinutes = Math.ceil(remaining * 0.06 / 60);
  console.log(`\nEstimated time to complete: ~${estimatedMinutes} minutes`);
  console.log('\nTo fetch remaining items, run:');
  console.log('  node fetch-all-items.js');
} else {
  console.log('\n✅ All items cached!');
  console.log('\nTo debug your claim, run:');
  console.log('  node local-monitor.js debug "Get Off My Lawn"');
}

console.log();
