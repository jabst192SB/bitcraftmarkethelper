# Complete Cache Fetch Guide

Two ways to get all your orders cached:

## Option 1: Automated Script (Easiest)

Run this single command to fetch ALL items automatically:

```bash
node fetch-all-items.js
```

This will:
- Check how many items are already cached
- Fetch only the remaining items
- Show progress with time estimates
- Save progress every 100 items (so you can stop/resume)
- Take ~15-20 minutes for all 2964 items

**Features**:
- ✅ Automatic progress saving (safe to interrupt)
- ✅ Rate limiting built-in
- ✅ Progress tracking with time estimates
- ✅ Resume-friendly (won't re-fetch items you already have)

## Option 2: Manual Incremental (Step by Step)

If you prefer to fetch in smaller batches:

```bash
# Check current progress
node check-progress.js

# Fetch 500 more items
node local-monitor.js update-bulk 500

# Check progress again
node check-progress.js

# Repeat until complete
```

## After Fetching

**Step 1**: Debug your claim locally:

```bash
node local-monitor.js debug "Get Off My Lawn"
```

**Step 2**: Sync data to website:

```bash
node sync-to-worker.js
```

This uploads your complete local cache to the Cloudflare Worker, making all your orders visible on the website at:
https://jbaird-bitcraftmarkethelper.pages.dev/market-monitor.html

## Current Status

Run this anytime to see your progress:

```bash
node check-progress.js
```

Output example:
```
=== Cache Progress ===

Total items with orders: 2964
Items with cached details: 700
Remaining to fetch: 2264
Progress: 24%

Estimated time to complete: ~14 minutes
```

## If Something Goes Wrong

The scripts save progress regularly. If you need to stop:
- Press Ctrl+C
- Your progress is saved
- Run the same command again to resume

To start fresh:
```bash
node local-monitor.js reset
node fetch-all-items.js
```

## Why This Works

The bulk API (used by `update-bulk`) is fast for **detecting changes** but doesn't include claim names. To see which orders belong to your claim, we need to fetch full details for each item.

That's why:
- First run: Takes ~15-20 minutes to fetch all items
- Subsequent runs: Takes ~10 seconds using bulk API to detect changes, then fetches only changed items

## Recommendation

For your first run, use `fetch-all-items.js` to build the complete cache. After that, use `update-bulk` for fast incremental updates.
