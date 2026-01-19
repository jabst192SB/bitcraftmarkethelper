# Local Monitor → Website Sync Workflow

## Overview

The local monitor and the Cloudflare Worker (website) are two separate systems:

- **Local Monitor**: Runs on your computer, no limits, can fetch ALL items
- **Cloudflare Worker**: Runs in the cloud, powers the website, has 50 subrequest limit per run

This guide shows how to use the local monitor to build a complete cache, then sync it to the website.

## The Problem

The Cloudflare Worker can only fetch 40 items per run (5-minute intervals) due to the 50 subrequest limit. At this rate, it would take:
- **~6 hours** to fetch all 2964 items
- Your "Get Off My Lawn" orders might not appear for hours

## The Solution

Use the local monitor to fetch everything quickly, then sync to the website:

```
Local Monitor (unlimited) → Fetch ALL items in 15-20 min → Sync to Worker → Website shows all data
```

## Complete Workflow

### Step 1: Build Local Cache

Run the automated fetch script:

```bash
node fetch-all-items.js
```

This will:
- ✅ Fetch all 2964 items with proper rate limiting (~15-20 minutes)
- ✅ Save progress every 100 items (safe to interrupt)
- ✅ Show progress with time estimates

### Step 2: Verify Data Locally

Check your claim's orders:

```bash
node local-monitor.js debug "Get Off My Lawn"
```

You should now see ALL your orders (not just 4, but potentially 50+).

### Step 3: Sync to Website

Upload your complete cache to the Cloudflare Worker:

```bash
node sync-to-worker.js
```

This uploads:
- ✅ All 2964 items with order counts
- ✅ Full order details with claim names
- ✅ Your complete local cache

### Step 4: Verify on Website

Visit the market monitor:
https://jbaird-bitcraftmarkethelper.pages.dev/market-monitor.html

Your "Get Off My Lawn" orders should now be visible!

## Keeping Data Fresh

### Option A: Manual Sync (Recommended for now)

When you want to update the website:

```bash
# Quick bulk update (checks all items, fetches changed ones)
node local-monitor.js update-bulk 100

# Sync to website
node sync-to-worker.js
```

Takes ~15 seconds to detect changes across all items, then syncs.

### Option B: Continuous Local Monitor

Run the watch mode locally:

```bash
node local-monitor.js watch 60
```

Then sync manually when you see changes, or create a scheduled task to sync periodically.

### Option C: Let Cloudflare Worker Catch Up

The worker will continue its incremental updates (40 items per 5 minutes). Over time it will build its own complete cache, but this takes ~6 hours initially.

## Why This Approach?

| Aspect | Local Monitor | Cloudflare Worker |
|--------|---------------|-------------------|
| Speed | ⚡ 2964 items in 15-20 min | 🐌 2964 items in ~6 hours |
| Limits | ✅ None | ⚠️ 50 subrequests per run |
| Control | ✅ Run anytime | ⏰ Runs every 5 minutes |
| Debugging | ✅ Full console logs | ⚠️ Limited logging |
| Initial cache | ✅ Fast | ❌ Slow |
| Ongoing updates | ✅ Fast with bulk API | ✅ Good for maintenance |

**Best practice**:
1. Use local monitor for initial cache build
2. Sync to website
3. Let Cloudflare Worker handle ongoing updates
4. Re-sync locally if you need immediate updates

## Sync Details

The `sync-to-worker.js` script:
- Reads `local-monitor-state.json`
- POSTs data to `/api/monitor/update` endpoint
- Worker stores in Durable Object
- Website immediately reflects new data

**Important**: Syncing uploads the FULL state, replacing what's in the worker. This is safe and ensures the website has your complete local cache.

## Troubleshooting

### "No local state file found"
Run an update first:
```bash
node fetch-all-items.js
```

### "Upload failed: 413 Payload Too Large"
The payload might be too large. This shouldn't happen with 2964 items, but if it does, the worker may need a size limit increase or chunked uploads.

### "Changes not showing on website"
- Clear your browser cache
- Check the browser console for errors
- Verify sync completed successfully
- Check worker logs: `wrangler tail`

### "Still missing orders"
- Verify they're in local cache: `node local-monitor.js debug "Get Off My Lawn"`
- If missing locally, run more updates: `node fetch-all-items.js`
- If present locally but not on website, try syncing again

## Advanced: Automated Sync

Create a scheduled task (Windows Task Scheduler, cron, etc.) to run:

```bash
node local-monitor.js update-bulk 200 && node sync-to-worker.js
```

This will:
1. Check all items for changes
2. Fetch details for changed items
3. Sync to website

Run this every hour or as needed.

## Summary

**First time setup**:
```bash
node fetch-all-items.js      # 15-20 minutes
node sync-to-worker.js        # 5 seconds
```

**Regular updates**:
```bash
node local-monitor.js update-bulk 100    # 15 seconds
node sync-to-worker.js                    # 5 seconds
```

**Result**: Website always has your complete, up-to-date market data! 🎉
