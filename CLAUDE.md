# Bitcraft Market Helper

A lightweight web application for browsing Bitcraft market data with real-time API integration to bitjita.com.

## Tech Stack

### Frontend
- **HTML5/CSS3/Vanilla JavaScript** - No frameworks, all scripts embedded in HTML files
- **localStorage API** - Browser-based persistence for saved searches
- **Fetch API** - HTTP requests to backend APIs

### Backend/Infrastructure
- **Cloudflare Workers** - Serverless CORS proxy and market monitoring
- **Durable Objects** - Persistent state for market order change tracking
- **GitHub Pages** - Production hosting
- **Python 3** - Local development server with CORS support

### External APIs
- **bitjita.com** - Bitcraft market data provider
  - API Documentation: https://bitjita.com/docs/api
  - `/api/market/item/{itemId}` - Individual item details
  - `/api/market/prices/bulk` - Bulk price lookup (POST, max 100 items)
  - `/api/market` - Market data with filters

## Project Structure

```
├── index.html              # Main market search page
├── gear-finder.html        # Gear finder/analyzer
├── market-monitor.html     # Market order monitor (Durable Objects)
├── help.html               # Help & FAQ
├── cloudflare-worker.js    # Cloudflare Workers proxy + monitor logic
├── local-monitor.js        # Local market monitor (no restrictions)
├── fetch-all-items.js      # Automated complete cache builder
├── sync-to-worker.js       # Upload local data to Cloudflare Worker
├── check-progress.js       # Check local cache progress
├── proxy-server.py         # Local Python CORS proxy
├── savedSearches.js        # localStorage management module
├── wrangler.toml           # Cloudflare Workers config
├── start-server.bat        # Windows local startup script
├── items.json              # Item database (2.5MB)
└── *.md                    # Documentation files
```

## Commands

### Local Development
```bash
# Start local server (Windows)
start-server.bat

# Or manually with Python
python proxy-server.py
# Opens at http://localhost:8000
```

### Local Market Monitor
```bash
# AUTOMATED MODES (Recommended):
node local-monitor.js setup              # Initial: Fetch ALL items + sync to website (~15-20 min)
node local-monitor.js monitor [interval] # Continuous: Check changes + sync every N seconds (default: 120s)
node local-monitor.js sync               # Manual: Upload current data to Cloudflare Worker

# MANUAL MODES:
node local-monitor.js update-bulk [max]  # Bulk API check + fetch changed items (fast)
node local-monitor.js debug <claim>      # Show orders for specific claim
node local-monitor.js state              # Show cache status
node local-monitor.js changes [limit]    # Show recent changes
node local-monitor.js reset              # Clear all data
node local-monitor.js help               # Show all options

# HELPER SCRIPTS:
node fetch-all-items.js                  # Automated complete cache builder
node sync-to-worker.js                   # Upload local data to worker
node check-progress.js                   # Check local cache progress
```

### Cloudflare Worker Deployment
```bash
# Deploy worker
wrangler deploy

# View live logs
wrangler tail

# List deployments
wrangler deployments list --name bitcraft-market-proxy

# Test scheduled events (cron)
wrangler deploy --test-scheduled
```

### GitHub Pages
```bash
git add . && git commit -m "message" && git push origin main
# Auto-deploys to GitHub Pages
```

## Key Configuration

### Worker URL
Production worker: `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`

### API Base URL (in HTML files)
```javascript
const API_BASE_URL = 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev';
// Leave empty ('') for local development with proxy-server.py
```

### Wrangler Config (wrangler.toml)
- Worker name: `bitcraft-market-proxy`
- Durable Objects class: `MarketMonitor`
- Cron schedule: Every 5 minutes (`*/5 * * * *`)
- Requires paid Cloudflare plan ($5/month) for Durable Objects

## Code Conventions

### JavaScript
- camelCase for variables and functions
- ES6+ features (arrow functions, template literals, async/await)
- Event listeners for UI interactivity
- Modular functions grouped by feature

### CSS
- kebab-case for class names
- Dark theme: `#1a1a1a` background, `#e0e0e0` text
- Primary accent: `#4a9eff` (blue)
- Status colors: Green `#4ade80`, Red `#f87171`, Orange `#fb923c`
- Prefixed selectors: `.typeahead-`, `.order-`, `.stat-`, `.modal-`
- Rarity classes: `.rarity-common`, `.rarity-uncommon`, `.rarity-rare`, `.rarity-epic`, `.rarity-legendary`, `.rarity-mythic`

### HTML
- All CSS and JS embedded in HTML files (no build step)
- Semantic HTML5 structure
- Mobile-first responsive design

## Data Structures

### Item (from items.json)
```javascript
{
  id: number,
  name: string,
  tier: number,
  rarityStr: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic",
  compendiumEntry: boolean  // Only compendium items are searchable
}
```

### Market Order Response
```javascript
{
  stats: {
    lowestSell: number,
    highestBuy: number,
    recentSellOrders: number,
    recentBuyOrders: number
  },
  buyOrders: [{ claimName, regionId, quantity, priceThreshold }],
  sellOrders: [{ claimName, regionId, quantity, priceThreshold }]
}
```

### Bulk Price Response
```javascript
{
  data: {
    items: {
      [itemId]: {
        highestBuyPrice: number | null,
        lowestSellPrice: number | null,
        totalBuyQuantity: number,
        totalSellQuantity: number,
        sellOrderCount: number,
        buyOrderCount: number
      }
    },
    cargo: {
      [cargoId]: {
        // Same structure as items
      }
    }
  }
}
```

## Important Notes

### Regional Filtering
- Default region: Solvenar (regionId: 4)
- Region filter toggle available in UI
- Orders filtered client-side by regionId

### API Constraints
- Bulk endpoint: Max 100 items per request (batched automatically)
- Cloudflare free tier: 100,000 requests/day
- Durable Objects require paid plan

### localStorage
- Max 20 saved searches
- Namespaced keys with version migration support
- Export/Import JSON functionality

### CORS
- Worker allows all origins (`*`)
- Safe for read-only API proxy
- No authentication required

## Feature Pages

1. **index.html** - Market Search
   - Typeahead search with tier filtering
   - Buy/sell order display with claim names
   - Saved searches with management modal
   - Multi-item table search

2. **gear-finder.html** - Gear Finder
   - Advanced filtering (tier, category, rarity)
   - Bulk price lookup
   - Table results display

3. **market-monitor.html** - Market Monitor
   - Real-time change detection (5-min polling)
   - Order count delta tracking
   - Change history (up to 1000 entries)
   - Durable Objects state persistence

4. **help.html** - Help & FAQ
   - Feature documentation
   - Troubleshooting guides

## Local Monitor Architecture

The local monitor (`local-monitor.js`) provides unlimited market data fetching without Cloudflare restrictions:

### Key Features
- **No subrequest limits** - Can fetch all 2964 items (Worker limited to 40 per run)
- **Bulk API support** - Uses `/api/market/prices/bulk` to check all items in ~6 seconds
- **Rate limiting** - Built-in delays (50ms between requests, 500ms between batches)
- **Auto-sync** - Can automatically upload data to Cloudflare Worker
- **State persistence** - Stores data in `local-monitor-state.json`
- **Resume-friendly** - Can interrupt and resume without data loss

### Modes

#### 1. Setup Mode (`node local-monitor.js setup`)
- **Purpose**: Initial cache build
- **Duration**: ~15-20 minutes
- **Process**:
  1. Fetches list of 2964 items with orders
  2. Fetches full order details for each item (with rate limiting)
  3. Automatically syncs to Cloudflare Worker
  4. Makes data available on website

#### 2. Monitor Mode (`node local-monitor.js monitor [interval]`)
- **Purpose**: Continuous monitoring with auto-sync
- **Default interval**: 120 seconds (2 minutes)
- **Process**:
  1. Uses bulk API to check all items (~6 seconds)
  2. Fetches details only for changed items
  3. Automatically syncs to Cloudflare Worker
  4. Repeats on interval

#### 3. Manual Modes
- **update-bulk**: Bulk API check + fetch changed items (no auto-sync)
- **sync**: Manual upload to worker
- **debug**: Show orders for specific claim
- **state/changes**: View local cache status

### Sync Process
The local monitor syncs data to Cloudflare Worker via:
```
POST https://bitcraft-market-proxy.jbaird-cb6.workers.dev/api/monitor/update
Body: { marketData, orderDetails }
```

This allows the website to display complete market data immediately, bypassing the Worker's 40 items/run limitation.

### Workflow Comparison

| Aspect | Cloudflare Worker | Local Monitor |
|--------|-------------------|---------------|
| Speed | 40 items per 5 min | 2964 items in 15-20 min |
| Limits | 50 subrequests/run | None |
| Initial cache | ~6 hours | ~20 minutes |
| Ongoing updates | Incremental (40/run) | Bulk check + changed items |
| Use case | Production maintenance | Initial setup + dev |

**Best practice**: Use local monitor for initial setup, then let both systems run (Worker for automatic updates, local monitor for immediate sync when needed).

## Cloudflare Worker Architecture

The worker (`cloudflare-worker.js`) provides:
- **CORS proxy** - Routes requests to bitjita.com with proper headers
- **MarketMonitor Durable Object** - Persistent market state tracking
- **Cron trigger** - Polls market data every 5 minutes
- **Change detection** - Compares snapshots, tracks deltas

### Monitor Endpoints
```
GET  /api/monitor/state           # Current market state
GET  /api/monitor/changes?limit=N # Change history
POST /api/monitor/update          # Trigger manual update (also used by local monitor)
POST /api/monitor/reset           # Reset all state
```

## Development Workflow

- PR-based workflow with descriptive branch names
- No build pipeline - edit HTML/JS directly
- Test locally with `proxy-server.py` before deploying
- Deploy worker changes with `wrangler deploy`
- Push to main for GitHub Pages auto-deploy

## Quick Start Guides

### For Users - Fix Missing Orders
**Problem**: Orders not showing on website (Worker hasn't cached all items yet)

**Solution**:
```bash
# One-time setup (~15-20 minutes)
node local-monitor.js setup

# Continuous monitoring (keep running)
node local-monitor.js monitor
```

See [QUICK-START.md](QUICK-START.md) for details.

### For Developers - Local Monitor Development

**Initial setup**:
```bash
# Build complete local cache
node local-monitor.js setup
```

**Testing changes**:
```bash
# Manual update + sync
node local-monitor.js update-bulk 100
node local-monitor.js sync

# Debug specific claim
node local-monitor.js debug "Claim Name"
```

**Production monitoring**:
```bash
# Auto-sync every 2 minutes
node local-monitor.js monitor
```

See [LOCAL-MONITOR-QUICKREF.md](LOCAL-MONITOR-QUICKREF.md) for all commands.

## Key Files and Documentation

### User Guides
- [QUICK-START.md](QUICK-START.md) - Fix missing orders in 1 command
- [LOCAL-MONITOR-QUICKREF.md](LOCAL-MONITOR-QUICKREF.md) - Command reference
- [SYNC-WORKFLOW.md](SYNC-WORKFLOW.md) - Detailed sync workflow
- [FETCH-ALL-GUIDE.md](FETCH-ALL-GUIDE.md) - Alternative manual approach

### Technical Documentation
- [LOCAL-MONITOR-README.md](LOCAL-MONITOR-README.md) - Local monitor details
- [BULK-UPDATE-GUIDE.md](BULK-UPDATE-GUIDE.md) - Bulk API explanation
- [QUICK-DEBUG-GUIDE.md](QUICK-DEBUG-GUIDE.md) - Debugging orders

### Core Files
- `local-monitor.js` - Main local monitor (2 automated modes + manual tools)
- `fetch-all-items.js` - Standalone complete cache builder
- `sync-to-worker.js` - Standalone sync utility
- `check-progress.js` - Cache progress checker
