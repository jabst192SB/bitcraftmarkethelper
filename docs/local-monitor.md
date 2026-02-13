# Local Market Monitor

A Node.js tool that fetches complete Bitcraft market data from bitjita.com and syncs it to Supabase, bypassing Cloudflare Worker limitations.

## Quick Start

### Initial Setup (Run Once)

```bash
node local-monitor.js setup
```

This fetches ALL ~2964 items with full order details and automatically syncs to Supabase. The website will display all data once complete.

### Continuous Monitoring (Keep Running)

```bash
node local-monitor.js monitor
```

Checks all items for changes every 2 minutes using the bulk API (~6 seconds per scan), fetches details for changed items, and auto-syncs to Supabase.

### Custom Interval

```bash
node local-monitor.js monitor 60    # Check every 1 minute
node local-monitor.js monitor 300   # Check every 5 minutes
```

## Requirements

- Node.js 18+ (for native fetch API)
- Supabase credentials configured in `.env` (see [Supabase Setup](supabase-setup.md))

## Command Reference

| Command | Description | When to Use |
|---------|-------------|-------------|
| `setup` | Fetch ALL items + sync to Supabase | First time only |
| `monitor [interval]` | Auto-check + auto-sync every N seconds (default: 120) | Keep running 24/7 |
| `sync` | Manual upload to Supabase | If auto-sync fails |
| `update-bulk [max]` | Bulk API check + fetch changed items | Manual updates without sync |
| `debug <claim>` | Show all orders for a specific claim | Verify your orders |
| `state` | Show local cache status | Check what's cached |
| `changes [limit]` | Show recent changes (default: 50) | Review market activity |
| `reset` | Clear all local + Supabase data | Start fresh |
| `help` | Show all options | Reference |

### Full Command Syntax

```bash
node local-monitor.js setup              # Initial: Fetch all + sync
node local-monitor.js monitor [interval] # Continuous: Check + sync
node local-monitor.js sync               # Manual: Upload to Supabase
node local-monitor.js update-bulk [max]  # Bulk check + fetch changed
node local-monitor.js debug <claim>      # Show orders for claim
node local-monitor.js state              # Show cache status
node local-monitor.js changes [limit]    # Show recent changes
node local-monitor.js reset              # Clear all data
node local-monitor.js help               # Show all options
```

## Typical Workflow

**Day 1 - Initial Setup:**
```bash
# Build complete cache (~15-20 minutes)
node local-monitor.js setup

# Verify your orders are found
node local-monitor.js debug "Your Claim Name"
```

**Day 2+ - Ongoing Monitoring:**
```bash
# Run in background, keeps website updated
node local-monitor.js monitor
```

## Debugging Orders

To investigate orders for a specific claim:

```bash
node local-monitor.js debug "Your Claim Name"
```

This shows:
- All orders from your claim that are currently tracked
- Which items have orders from your claim
- Quantity, price, and owner information
- If no orders are found, lists all available claims to help identify spelling differences

### Example Debug Output

```
=== Debug Claim: "Get Off My Lawn" ===

Found 5 orders across 3 items:

Iron Ore:
  Sell Orders (2):
    100 @ 5 hex (owner: YourUsername)
    50 @ 6 hex (owner: YourUsername)
  Buy Orders (1):
    200 @ 3 hex (owner: YourUsername)
```

### Common Debug Issues

- **"No orders found"** - Check the list of available claims for spelling differences
- **Region mismatch** - Verify your orders are in region 4 (Solvenar)
- **Orders missing** - Run `setup` to build complete cache first

## How the Bulk API Works

The monitor uses two API strategies:

### Bulk Price Fetch (Fast Scanning)

```
POST /api/market/prices/bulk
{ "itemIds": [1, 2, 3, ..., 100], "cargoIds": [...] }
```

Returns order counts and prices for up to 100 items per request. ~30 requests scan all ~2964 items in ~6 seconds. No claim details, but perfect for detecting changes.

### Individual Item Fetch (Detail Retrieval)

```
GET /api/market/item/{itemId}
```

Returns full order details including claim names, quantities, and prices. Only used for items where changes are detected.

### Change Detection Flow

1. Bulk API scans all items (~6 seconds)
2. Compares with previous state to detect changes
3. Fetches full details only for changed items
4. Updates local state and syncs to Supabase

## Helper Scripts

### Automated Cache Builder

```bash
node fetch-all-items.js
```

Alternative to `setup` mode. Fetches all items with progress saving (safe to interrupt and resume).

### Progress Checker

```bash
node check-progress.js
```

Shows how many items are cached vs total.

## State Management

- State persisted in `local-monitor-state.json`
- Progress saved every 100 items (resume-friendly)
- Tracks up to 1000 most recent changes
- Rate limiting: 50ms between requests, 500ms between batches
- Exponential backoff retry on 429 errors

## Troubleshooting

### "No orders found for claim X"
1. **Wrong region** - The claim's orders may not be in region 4 (Solvenar)
2. **Spelling** - Claim name must match exactly (case-sensitive)
3. **Not fetched yet** - Run `node local-monitor.js setup` first

### Node.js version error
If you get an error about `fetch` not being available:
```bash
node --version  # Must be v18.0.0 or higher
```

### "Supabase client not initialized"
Check your `.env` file has correct credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

### State file corruption
```bash
node local-monitor.js reset
```

### Orders showing locally but not on website
```bash
node local-monitor.js sync
```

### Monitor stopped
Just restart it - it resumes from where it left off:
```bash
node local-monitor.js monitor
```
