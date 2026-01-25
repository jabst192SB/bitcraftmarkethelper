const SupabaseClient = require('./supabase-client.js').default;
require('dotenv').config();

async function verify() {
  const client = new SupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  console.log('Verifying Supabase data...\n');

  // Check market_items
  const items = await client.getMarketItems();
  console.log(`✓ market_items table: ${items.length} rows`);

  // Check order_details
  const orders = await client.getOrderDetails();
  console.log(`✓ order_details table: ${orders.length} rows`);

  // Check market_changes
  const changes = await client.getChanges(1000);
  console.log(`✓ market_changes table: ${changes.length} rows`);

  // Check metadata
  const lastUpdate = await client.getMetadata('last_update');
  const changeCount = await client.getMetadata('change_count');
  console.log(`\n✓ Metadata:`);
  console.log(`  - last_update: ${lastUpdate ? new Date(lastUpdate).toLocaleString() : 'null'}`);
  console.log(`  - change_count: ${changeCount}`);

  // Show sample change
  if (changes.length > 0) {
    const latestChange = changes[0];
    console.log(`\n✓ Latest change entry:`);
    console.log(`  - Timestamp: ${new Date(latestChange.timestamp).toLocaleString()}`);
    console.log(`  - Changes count: ${latestChange.changes.length}`);
    if (latestChange.changes.length > 0) {
      const firstChange = latestChange.changes[0];
      console.log(`  - Example: ${firstChange.itemName} (${firstChange.type})`);
    }
  }
}

verify().catch(console.error);
