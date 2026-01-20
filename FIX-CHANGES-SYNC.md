# Fix: Changes Not Displaying on Market Monitor

## Problem
The "Recent Changes" section on the market-monitor.html page was empty, showing "No changes detected yet" even though changes were being tracked locally.

## Root Cause
The `syncToSupabase()` function was **not uploading change history** to the `market_changes` table. It only uploaded:
1. ✅ Market items → `market_items` table
2. ✅ Order details → `order_details` table
3. ✅ Metadata → `monitor_metadata` table
4. ❌ **Changes were never uploaded** → `market_changes` table was empty!

The changes were being tracked in the local state file (`local-monitor-state.json`) with 20 change entries, but they weren't being synced to Supabase, so the web page couldn't display them.

## Solution
Added Step 3 to the sync function to upload change history:

```javascript
// Step 3: Upload change history
console.log('\n  Step 3/4: Uploading change history...');
if (state.changes && state.changes.length > 0) {
  // Clear existing changes first to avoid duplicates
  await supabaseClient.request('DELETE', '/rest/v1/market_changes?id=gte.0', null, {
    'Prefer': 'return=minimal'
  });

  // Upload each change entry
  for (const changeEntry of state.changes) {
    await supabaseClient.insertChange(changeEntry.changes);
  }
  console.log(`  ✓ Uploaded ${state.changes.length} change entries`);
} else {
  console.log(`  ✓ No changes to upload`);
}
```

## Files Changed
- **[local-monitor.js](local-monitor.js)** - Added change history upload to `syncToSupabase()` function (lines 1089-1104)

## How to Apply the Fix

The code is already updated. Just run:

```bash
node local-monitor.js sync
```

You should see:
```
Step 3/4: Uploading change history...
✓ Uploaded 20 change entries
```

Then **refresh the market-monitor.html page** (Ctrl+F5) and you should see recent changes displayed!

## What Gets Synced Now

After this fix, the sync command uploads everything:

1. **Market Items** (market_items table)
   - Item ID, name, tier, rarity, category
   - Sell/buy order counts

2. **Order Details** (order_details table)
   - Full sell and buy orders for each item
   - Stats (lowest sell, highest buy, etc.)

3. **Change History** (market_changes table) ← **NOW SYNCED!**
   - New items added
   - Order count changes
   - Items removed
   - Added/removed individual orders

4. **Metadata** (monitor_metadata table)
   - Last update timestamp
   - Total change count

## Verification

After syncing and refreshing the page, you should see:

### Recent Changes Panel
- ✅ Shows recent market activity
- ✅ Displays item names with tier/rarity badges
- ✅ Shows sell/buy order changes
- ✅ Lists individual orders added/removed
- ✅ Updates in real-time as monitor runs

### Example Changes
- "New Item: Salt (Tier 1, Common)"
- "Updated: Simple Animal Hair - Buy: +2, Sell: -1"
- Individual orders with claim names, quantities, and prices

## Future Syncs

Going forward, when you run:
- `node local-monitor.js monitor` - Auto-syncs changes every interval
- `node local-monitor.js sync` - Manually syncs all data including changes
- `node local-monitor.js setup` - Initial setup syncs everything

All changes will now be automatically uploaded to Supabase and displayed on the web page!

## Notes

- The sync clears existing changes before uploading to avoid duplicates
- Only the most recent changes from local state are kept (up to 1000 in Supabase)
- Older changes are automatically cleaned up by the database trigger
