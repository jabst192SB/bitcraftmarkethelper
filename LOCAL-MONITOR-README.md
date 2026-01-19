# Local Market Monitor

A Node.js version of the Cloudflare Worker market monitor that runs locally without restrictions. This tool is useful for debugging issues with order tracking and understanding exactly what's happening with your market orders.

## Features

- No Cloudflare Worker limitations (no 50 subrequest limit, no time limits)
- Full order details for ALL items (not limited to 40 per run)
- Detailed console logging showing exactly what's happening
- Debug mode to inspect orders for specific claims
- Persistent state stored in `local-monitor-state.json`
- Watch mode for continuous monitoring

## Requirements

- Node.js 18+ (for native fetch API support)

## Installation

No installation needed! Just make sure you have Node.js 18 or higher installed.

## Usage

### Basic Commands

```bash
# Update market data (fetch latest and detect changes)
node local-monitor.js update

# Show current state summary
node local-monitor.js state

# Show recent changes (default: 50)
node local-monitor.js changes

# Show more changes
node local-monitor.js changes 100

# Debug a specific claim (IMPORTANT for your issue!)
node local-monitor.js debug "Get Off My Lawn"

# Watch mode - continuously monitor (default: 60s interval)
node local-monitor.js watch

# Watch with custom interval (30 seconds)
node local-monitor.js watch 30

# Reset all stored data
node local-monitor.js reset

# Show help
node local-monitor.js help
```

## Debugging Your Claim Issue

To investigate why orders from "Get Off My Lawn" are missing:

### Step 1: Initial Update
```bash
node local-monitor.js update
```

This will fetch all current market data and show detailed logs about what's being tracked.

### Step 2: Debug Your Claim
```bash
node local-monitor.js debug "Get Off My Lawn"
```

This will show:
- All orders from your claim that are currently tracked
- Which items have orders from your claim
- The exact quantity, price, and owner information
- If no orders are found, it will list all available claims to help identify spelling differences

### Step 3: Monitor for Changes
```bash
node local-monitor.js watch 60
```

This will continuously monitor and show detailed logs every time an order changes, including:
- Which orders were added/removed
- The claim name for each order
- Quantity and price details

## Output

### Update Output
```
=== Market Update ===
Time: 2026-01-19T...
Fetching market data from: https://bitjita.com/api/market?hasOrders=true
✓ Found 145 items with orders
✓ Detected 3 changed items
Fetching order details for 3 items (3 changed, 0 missing)
✓ Fetched 3 item order details

✓ Detected 3 changes:
  - Iron Ore (order_change)
    Delta: sell +1, buy 0
    Added: 1 sell, 0 buy
      SELL: Get Off My Lawn - 100 @ 5 hex
```

### Debug Output
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

## State File

The monitor stores all state in `local-monitor-state.json` in the same directory. This file contains:
- Current market state
- Order details for all tracked items
- Change history (up to 1000 entries)
- Timestamps and metadata

You can inspect this file directly with any text editor or JSON viewer.

## Comparison with Cloudflare Worker

| Feature | Cloudflare Worker | Local Monitor |
|---------|-------------------|---------------|
| Subrequest Limit | 50 per run | Unlimited |
| Items Fetched per Run | Max 40 | Unlimited |
| Time Limit | 30s (free), 15min (paid) | Unlimited |
| Logging | Limited console.log | Full detailed logs |
| Debug Mode | No | Yes |
| State Storage | Durable Objects | JSON file |
| Cost | $5/month for DO | Free |

## Troubleshooting

### "No orders found for claim X"

This could mean:
1. **Wrong region**: The claim's orders are not in region 4 (Solvenar)
2. **Spelling**: The claim name doesn't match exactly
3. **Not fetched yet**: Run `node local-monitor.js update` first

The debug command will show all available claim names to help identify the issue.

### Node.js version error

If you get an error about `fetch` not being available, you need Node.js 18+:

```bash
node --version  # Should show v18.0.0 or higher
```

Update Node.js if needed: https://nodejs.org/

### State file corruption

If the state file gets corrupted, simply delete it:

```bash
node local-monitor.js reset
```

Or manually delete `local-monitor-state.json`.

## Tips

- Run `update` before other commands to ensure you have fresh data
- Use `debug` to verify your claim's orders are being tracked
- Use `watch` mode to see changes in real-time as they happen
- The state file persists between runs, so you don't lose history
- Compare local monitor output with the Cloudflare Worker to identify discrepancies

## Next Steps

Once you identify the issue with the local monitor, you can:
1. Fix the Cloudflare Worker code if needed
2. Update filtering logic for regions
3. Adjust claim name matching
4. Modify the order detection logic
