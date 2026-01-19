# Quick Start - Fix Missing Orders

Your "Get Off My Lawn" orders are missing because the website's Cloudflare Worker hasn't fetched all items yet. Here's how to fix it:

## The Problem
- Website can only fetch 40 items per 5 minutes
- Would take ~6 hours to get all 2964 items
- Your orders might be in items not yet cached

## The Solution (One Command!)

### Initial Setup (~15-20 minutes)
```bash
node local-monitor.js setup
```

This single command will:
1. ✅ Fetch ALL 2964 items with full order details
2. ✅ Show progress with time estimates
3. ✅ Automatically upload to Cloudflare Worker
4. ✅ Make data available on the website

## Done!

Visit: https://jbaird-bitcraftmarkethelper.pages.dev/market-monitor.html

Your orders should now be visible!

## Keeping Data Fresh (Automated)

Run continuous monitoring that auto-syncs to website every 2 minutes:

```bash
node local-monitor.js monitor
```

This will:
- ✅ Check ALL items for changes using bulk API (~6 seconds)
- ✅ Fetch details for changed items
- ✅ Auto-sync to website
- ✅ Repeat every 2 minutes

**Press Ctrl+C to stop**

### Custom Check Interval

```bash
node local-monitor.js monitor 60    # Check every 1 minute
node local-monitor.js monitor 300   # Check every 5 minutes
```

## Manual Updates (If Needed)

If you prefer manual control:

```bash
# Update locally
node local-monitor.js update-bulk 100

# Sync to website
node local-monitor.js sync
```

## Verify Your Orders

```bash
node local-monitor.js debug "Get Off My Lawn"
```

Should show all 50+ orders from your claim.

## Need Help?

- **Check progress**: `node check-progress.js`
- **View help**: `node local-monitor.js help`
- **Full guide**: See [SYNC-WORKFLOW.md](SYNC-WORKFLOW.md)
