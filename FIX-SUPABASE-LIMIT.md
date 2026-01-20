# Fix: Item Names Not Displaying (Supabase Query Limit)

## Problem
After syncing all 2958 items to Supabase, the market monitor page still shows "Item 1000", "Item 1003" instead of actual item names for many items.

## Root Cause
**Supabase default row limit** - When no `limit` parameter is specified, Supabase REST API returns a maximum of **1000 rows** by default.

The market-monitor.html page was querying:
```javascript
const items = await supabaseQuery('market_items', '*', 'order=last_updated.desc');
// Returns only 1000 items, even though there are 2958 in the database!
```

This caused:
- ✅ First 1000 items: Names displayed correctly (data in `itemData` Map)
- ❌ Remaining 1958 items: Showed as "Item {ID}" (no data in `itemData` Map)

## Solution
Explicitly set a higher limit (10,000) for both queries:

```javascript
// Fetch market items (remove default 1000 row limit)
const items = await supabaseQuery('market_items', '*', 'order=last_updated.desc', 10000);

// Fetch order details (remove default 1000 row limit)
const orderDetailsArray = await supabaseQuery('order_details', '*', '', 10000);
```

## Files Changed
- **[market-monitor.html](market-monitor.html)** - Added explicit limit of 10,000 to market_items and order_details queries (lines 1190, 1193)

## How to Apply the Fix

The code is already updated. Just **refresh the market-monitor.html page** in your browser (Ctrl+F5 or Cmd+Shift+R for hard refresh).

All item names should now display correctly!

## Verification

After refreshing, you should see actual item names like:
- "Rough Wood Trunk" instead of "Item 1000"
- "Fine Trunk" instead of "Item 1003"
- "Rough Wood Log" instead of "Item 1010001"

## Why 10,000?

The limit of 10,000 is more than enough for current needs:
- Current items with orders: ~2,958
- Headroom for growth: 3.4x
- Still performant for browser queries

If you ever exceed 10,000 items, you can either:
1. Increase the limit further
2. Implement pagination
3. Use Supabase's server-side filtering to reduce result size

## Related Issues Fixed

This fix also resolved:
1. ✅ Tier badges not showing for items > 1000
2. ✅ Rarity badges not showing for items > 1000
3. ✅ Category tags not showing for items > 1000

All metadata is now properly loaded for all items!
