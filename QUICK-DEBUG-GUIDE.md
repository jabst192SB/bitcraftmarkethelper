# Quick Debug Guide for "Get Off My Lawn" Orders

Your local monitor is ready! The rate limiting issues have been fixed.

## What Changed

✅ **Slower, safer fetching**: 50ms between requests, 500ms between batches
✅ **Retry logic**: Automatically retries on 429 errors with exponential backoff
✅ **Incremental updates**: Only fetches 100 items per run by default
✅ **Progress tracking**: Shows real-time progress during fetching

## Quick Start

### 1. First Update (Safe Mode - 100 items)
```bash
node local-monitor.js update
```

This will fetch up to 100 items with proper rate limiting. You already have 200 items cached, so this will focus on changed items.

### 2. Check Your Claim
```bash
node local-monitor.js debug "Get Off My Lawn"
```

This will show:
- All orders from your claim
- Which items have your orders
- Quantities and prices

### 3. Continue Building Cache
If you want to fetch more items gradually:

```bash
# Fetch another 100 items
node local-monitor.js update

# Or fetch 50 items (even safer)
node local-monitor.js update 50

# Or fetch all remaining items (takes 15-20 min)
node local-monitor.js update --full
```

### 4. Monitor for Changes
Once you have enough items cached:

```bash
node local-monitor.js watch 60
```

This will check every 60 seconds and always prioritize changed items.

## Understanding the Output

### During Update:
```
✓ Found 2964 items with orders
✓ Detected 0 changed items
Fetching order details for up to 100 items (0 changed, 2764 missing)
⚠ Rate limiting active: 50ms between requests, 500ms between batches
  Progress: 10/100 (10%) - 10 successful
  Progress: 20/100 (20%) - 20 successful
  ...
✓ Fetched 100 item order details
⚠ Limited to 100 items (2664 remaining)
```

### Rate Limit Warning:
```
⚠ Rate limited on item 12345, waiting 1000ms (attempt 1/3)
```
This means it will automatically retry after waiting.

### Debug Output:
```
=== Debug Claim: "Get Off My Lawn" ===

Found 5 orders across 3 items:

Iron Ore:
  Sell Orders (2):
    100 @ 5 hex (owner: YourName)
    50 @ 6 hex (owner: YourName)
```

## What to Look For

### ✅ Good Signs:
- Your claim shows up in debug output
- Orders match what you expect
- Changes are detected when you add/remove orders

### ⚠️ Potential Issues:
- **"No orders found"** → Check the list of available claims for spelling differences
- **Region mismatch** → Verify your orders are in region 4 (Solvenar)
- **Orders missing** → Run more updates to build cache (changed items always fetched first)

## Comparison with Web UI

Once you've debugged locally, compare with the web UI:

1. **Local monitor** shows the raw data being tracked
2. **Web UI** (market-monitor.html) shows what the Cloudflare Worker is storing
3. If they differ, we know the issue is in the Cloudflare Worker logic

## Next Steps

After running `node local-monitor.js debug "Get Off My Lawn"`:

- **If orders found**: Compare with what's missing in the web UI
- **If no orders found**: Check the list of available claims for exact spelling
- **If partially found**: Some orders might be in different regions or not cached yet

Let me know what you find!
