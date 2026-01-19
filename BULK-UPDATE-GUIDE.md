# 🚀 Bulk Update Guide - The Fast Way!

You're absolutely right - using the bulk API is **much faster**! The local monitor now supports bulk updates.

## The Problem with the Old Approach

❌ **Old way**: Fetching 2964 items one-by-one
- 2964 individual API requests
- ~3-4 minutes with rate limiting
- High risk of hitting 429 rate limits

✅ **New way**: Using bulk API
- ~30 bulk API requests (100 items per batch)
- ~6 seconds to scan ALL items
- Then fetch details only for changed items
- **50x faster!**

## Quick Start

### 1. Fast Bulk Update (Recommended)
```bash
node local-monitor.js update-bulk
```

This will:
1. **Fetch list of items** (~1 second)
2. **Bulk fetch prices for ALL 2964 items** (~6 seconds, 30 requests)
3. **Detect changes** using bulk data
4. **Fetch detailed orders** for up to 100 changed items

**Total time**: ~10-15 seconds instead of 3-4 minutes!

### 2. Debug Your Claim
```bash
node local-monitor.js debug "Get Off My Lawn"
```

If your orders aren't found, the tool will suggest running `update-bulk` to quickly check all items.

### 3. Continue Monitoring
```bash
# Fetch more details for items we haven't cached yet
node local-monitor.js update-bulk 200

# Or use watch mode with bulk updates
node local-monitor.js watch 60
```

## How Bulk Mode Works

### Step 1: Bulk Price Fetch
```
POST /api/market/prices/bulk
{
  "itemIds": [1, 2, 3, ..., 100],
  "cargoIds": [...]
}
```

Returns order counts and prices for up to 100 items at once. No claim details, but perfect for detecting changes!

### Step 2: Smart Detail Fetching
Only fetches full order details (with claim names) for:
- Items that have changed order counts
- Items we don't have details for yet (up to limit)

### Step 3: Change Detection
Compares bulk data with previous state to detect:
- New items with orders
- Changed order counts
- Removed items

## Output Example

```
=== Market Update (Bulk Mode) ===
Time: 2026-01-19T...
Fetching market data from: https://bitjita.com/api/market?hasOrders=true
✓ Found 2964 items with orders
Fetching bulk prices for 2964 items in batches of 100...
  Bulk progress: 100/2964 (3%)
  Bulk progress: 200/2964 (7%)
  ...
  Bulk progress: 2964/2964 (100%)
✓ Fetched bulk prices for 2964 items
✓ Got bulk price data for 2964 items
✓ Detected 15 changed items

Fetching detailed orders for 15 items (15 changed, 0 missing)
⚠ Rate limiting active: 50ms between requests, 500ms between batches
  Progress: 10/15 (67%) - 10 successful
  Progress: 15/15 (100%) - 15 successful
✓ Fetched 15 item order details

✓ Detected 15 changes with details
✓ State updated:
  - Items with orders: 2964
  - Items with detailed orders: 215
  - Total changes recorded: 15
```

## Comparison

| Mode | Time | Requests | Use Case |
|------|------|----------|----------|
| `update` | 3-4 min | ~2964 | Legacy mode, not recommended |
| `update 100` | 10 sec | 100 | Incremental updates |
| `update --full` | 15-20 min | ~2964 | Full refresh (slow!) |
| `update-bulk` | **10 sec** | **~30** | **✅ Best for everything!** |
| `update-bulk 200` | 20 sec | ~30 + 200 | More details per run |

## Why This Solves Your Problem

Before, you were seeing:
```
Failed to fetch orders for item 3170007: 429
Failed to fetch orders for item 3170006: 429
```

This happened because we were making 2964 individual requests.

Now with bulk mode:
- Only **~30 bulk requests** to check ALL items
- Then fetches details only for **changed items**
- Your "Get Off My Lawn" orders will be found much faster
- Much less likely to hit rate limits

## Next Steps

1. **Run bulk update:**
   ```bash
   node local-monitor.js update-bulk
   ```

2. **Check your claim:**
   ```bash
   node local-monitor.js debug "Get Off My Lawn"
   ```

3. **If you need more details:**
   ```bash
   # Fetch details for 200 more items
   node local-monitor.js update-bulk 200

   # Or keep running bulk updates until you have all details
   node local-monitor.js update-bulk 300
   ```

## Bulk API Details

The bulk endpoint `/api/market/prices/bulk` returns:
- `lowestSellPrice` - Lowest sell price across all orders
- `highestBuyPrice` - Highest buy price across all orders
- `totalSellQuantity` - Total items available to sell
- `totalBuyQuantity` - Total items wanted to buy
- `sellOrderCount` - Number of sell orders
- `buyOrderCount` - Number of buy orders

Perfect for detecting changes, but doesn't include claim names. That's why we fetch individual item details only for changed items!

## Future: Update Cloudflare Worker

Once we confirm this works for you, we should update the Cloudflare Worker to use the same bulk API approach. It will be much faster and avoid the 50-subrequest limit!
