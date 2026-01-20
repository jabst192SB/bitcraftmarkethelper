# Fix: Orders Not Syncing to Supabase

## Problem
After running `node local-monitor.js sync`, no orders were being displayed on the market-monitor.html page. The sync log showed "Filtered out 2958 orphaned order details (items no longer have orders)" - filtering out ALL order details!

## Root Cause
**Type mismatch bug in the filtering logic** at [local-monitor.js:1052-1057](local-monitor.js#L1052-L1057):

```javascript
// BUG: marketItemIds contains STRINGS, but we were checking for NUMBERS
const marketItemIds = new Set(marketItems.map(item => item.item_id)); // Set of strings: '6005', '1', etc.
const filteredOrderEntries = Object.entries(state.orderDetails).filter(([itemId]) => {
  const numericId = parseInt(itemId);  // Converts to NUMBER: 1, 2, 3, etc.
  return marketItemIds.has(numericId); // ❌ Checking if Set has NUMBER, but Set has STRINGS!
});
```

**Result:** No matches found → all order details filtered out → nothing synced to Supabase.

## Solution
Changed the filtering to use consistent string comparison:

```javascript
// FIX: Convert all IDs to strings for consistent comparison
const marketItemIds = new Set(marketItems.map(item => String(item.item_id)));
const filteredOrderEntries = Object.entries(state.orderDetails).filter(([itemId]) => {
  return marketItemIds.has(String(itemId)); // ✅ Both are strings now!
});
```

## Files Changed
- **[local-monitor.js](local-monitor.js)** - Fixed ID type comparison in sync function (lines 1052-1057)

## How to Apply the Fix

The code is already fixed. Just run:

```bash
node local-monitor.js sync
```

You should now see:
```
✓ Batch 1/30: 100 order details
✓ Batch 2/30: 100 order details
...
```

Instead of:
```
Filtered out 2958 orphaned order details (items no longer have orders)
```

## Verification

After syncing, check the market-monitor.html page - orders should now be visible!

You can also verify Supabase has the data:

```javascript
const client = new SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const orders = await client.getOrderDetails();
console.log('Order details:', orders.length); // Should be > 0
```

## Why This Happened

JavaScript's `Set` uses strict equality (`===`) for comparisons:
- `Set.has('1')` returns `true` only for the string `'1'`
- `Set.has(1)` returns `false` even if Set contains `'1'`

The bug was introduced because:
1. Item IDs from the API come as various types (strings, numbers)
2. The deduplication preserves the type
3. `parseInt()` was converting to numbers for comparison
4. But the Set still contained strings

The fix ensures both sides of the comparison use the same type (strings).
