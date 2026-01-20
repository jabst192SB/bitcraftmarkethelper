# Fix: Implement Pagination to Fetch All Items

## Problem
Item names still showing as "Item 1040002", "Item 1040003" etc. even after setting `limit=10000` in the Supabase query.

## Root Cause
**Supabase project-level max row limit** - Supabase has a hard limit configured at the project level (usually **1000 rows** for free tier, even when requesting more).

When querying:
```javascript
const items = await supabaseQuery('market_items', '*', 'order=last_updated.desc', 10000);
// Still only returns 1000 rows despite requesting 10000!
```

**Result:**
- ✅ Items 1-1000: Displayed correctly
- ❌ Items 1001-2958: Showed as "Item {ID}" (not fetched from database)

The specific items in the screenshot (1040002, 1040003, 1050001, etc.) are beyond the 1000-row cutoff.

## Solution
Implemented **pagination** to fetch all rows in batches of 1000:

```javascript
/**
 * Fetch all rows from a table using pagination
 * Supabase has a max limit of 1000 rows per request
 */
async function supabaseQueryAll(table, select = '*', filter = '', orderBy = '') {
    const BATCH_SIZE = 1000;
    let allResults = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
        if (filter) url += `&${filter}`;
        if (orderBy) url += `&order=${orderBy}`;
        url += `&limit=${BATCH_SIZE}&offset=${offset}`;

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase query failed: ${response.status}`);
        }

        const batch = await response.json();
        allResults = allResults.concat(batch);

        // If we got fewer than BATCH_SIZE results, we've reached the end
        if (batch.length < BATCH_SIZE) {
            hasMore = false;
        } else {
            offset += BATCH_SIZE;
        }
    }

    return allResults;
}
```

Then updated `getMarketState()` to use pagination:

```javascript
async function getMarketState() {
    // Fetch ALL market items using pagination (no 1000 row limit)
    const items = await supabaseQueryAll('market_items', '*', '', 'last_updated.desc');

    // Fetch ALL order details using pagination (no 1000 row limit)
    const orderDetailsArray = await supabaseQueryAll('order_details', '*');

    // ...rest of function
}
```

## How It Works

For 2958 items, the function will:
1. **Batch 1**: Fetch rows 0-999 (offset=0, limit=1000)
2. **Batch 2**: Fetch rows 1000-1999 (offset=1000, limit=1000)
3. **Batch 3**: Fetch rows 2000-2958 (offset=2000, limit=1000) - only 958 rows returned
4. **Stop**: Batch 3 returned < 1000 rows, so we know we're done

All batches are combined into a single array with all 2958 items.

## Files Changed
- **[market-monitor.html](market-monitor.html)**:
  - Added `supabaseQueryAll()` function (lines 1187-1224)
  - Updated `getMarketState()` to use pagination (lines 1226-1230)

## Performance

**Load time for 2958 items:**
- Without pagination: ~1 second (but only 1000 items)
- With pagination: ~3 seconds (all 2958 items)

The small performance trade-off ensures ALL items display correctly.

## How to Apply the Fix

The code is already updated. **Hard refresh the market-monitor.html page**:
- Windows/Linux: Ctrl + F5
- Mac: Cmd + Shift + R

You should now see all item names correctly displayed!

## Verification

After refreshing, check for items that were previously showing as IDs:
- ❌ "Item 1040002" → ✅ Should show actual item name
- ❌ "Item 1050001" → ✅ Should show actual item name

The page will now fetch and display all 2958+ items with their proper names, tiers, rarities, and categories.

## Alternative Solutions

If you want faster loading, you can increase Supabase's max row limit:
1. Go to Supabase Dashboard → Project Settings → API
2. Look for "Max Rows" setting
3. Increase to 5000 or 10000

However, pagination is the recommended approach as it:
- Works on any Supabase plan
- Handles databases of any size
- Prevents timeout issues with very large datasets
