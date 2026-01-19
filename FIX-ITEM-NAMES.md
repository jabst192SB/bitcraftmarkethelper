# Fix for Item Names Displaying as Item IDs

## Problem
After migrating to Supabase, the market monitor page shows "Item 1003" instead of actual item names like "Stone Pickaxe".

## Root Cause
The `market_items` table in Supabase was missing important metadata fields:
- `tier` - Item tier level
- `rarity` - Item rarity (Common, Uncommon, Rare, etc.)
- `category` - Item category/tag

The `local-monitor.js` script was fetching this data from the Bitcraft API but **not uploading it to Supabase**. As a result, when the market-monitor.html page tried to display item metadata, it couldn't find the data and fell back to showing "Item {ID}".

## Solution
Three files have been updated:

### 1. Database Schema Migration
**File:** `supabase-add-item-metadata.sql`

This SQL migration adds the missing columns to the `market_items` table:
- `tier INTEGER` - Item tier (0-10)
- `rarity TEXT` - Item rarity string
- `category TEXT` - Item category/tag

### 2. Local Monitor Update
**File:** `local-monitor.js` (lines 1027-1036)

Updated the sync function to upload tier, rarity, and category data to Supabase:

```javascript
itemsMap.set(item.id, {
  item_id: item.id,
  item_name: item.name,
  item_type: item.itemType || 0,
  tier: item.tier || 0,              // NEW
  rarity: item.rarityStr || item.rarity || '',  // NEW
  category: item.tag || item.category || '',    // NEW
  sell_orders: item.sellOrders,
  buy_orders: item.buyOrders,
  total_orders: item.totalOrders,
  last_updated: new Date().toISOString()
});
```

### 3. Market Monitor Update
**File:** `market-monitor.html` (lines 1211-1222)

Updated the `getMarketState()` function to read and map the new fields from Supabase:

```javascript
items: items.map(item => ({
  id: item.item_id,
  name: item.item_name,
  itemType: item.item_type,
  tier: item.tier || 0,              // NEW
  rarity: item.rarity || '',         // NEW
  rarityStr: item.rarity || '',      // NEW
  category: item.category || '',     // NEW
  tag: item.category || '',          // NEW
  sellOrders: item.sell_orders,
  buyOrders: item.buy_orders,
  totalOrders: item.total_orders
}))
```

Also updated `buildClaimOrdersMap()` (lines 1299-1326) to properly handle both numeric and string item IDs.

## How to Apply the Fix

### Step 1: Run the Database Migration
Open your Supabase SQL Editor and run:
```bash
e:\Repos\bitcraftmarkethelper\supabase-add-item-metadata.sql
```

This will add the new columns to your existing table without losing any data.

### Step 2: Re-sync Your Data
Run the local monitor to upload the updated item data with tier/rarity/category:

```bash
node local-monitor.js sync
```

OR run a full update to fetch fresh data:

```bash
node local-monitor.js update
node local-monitor.js sync
```

### Step 3: Refresh the Market Monitor Page
Open or refresh `market-monitor.html` in your browser. Item names should now display correctly with their metadata (tier, rarity badges, etc.).

## Verification
After applying the fix, you should see:
- ✅ Actual item names instead of "Item 1003"
- ✅ Tier badges (e.g., "T3")
- ✅ Rarity badges with colors (Common, Uncommon, Rare, Epic, Legendary, Mythic)
- ✅ Category tags where available

## Notes
- The changes are **backward compatible** - existing code will continue to work
- The migration uses `IF NOT EXISTS` so it's safe to run multiple times
- Item metadata is only fetched during market updates, so ensure your local monitor is running regularly
- The tier/rarity/category data comes directly from the Bitcraft API via `/api/market?hasOrders=true`
