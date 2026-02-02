# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Bitcraft Market Helper

A lightweight web application for browsing Bitcraft market data with real-time API integration to bitjita.com.

## Tech Stack

### Frontend
- **HTML5/CSS3/Vanilla JavaScript** - No frameworks, all scripts embedded in HTML files
- **localStorage API** - Browser-based persistence for saved searches
- **Fetch API** - HTTP requests to backend APIs

### Backend/Infrastructure
- **Cloudflare Workers** - Serverless CORS proxy (free tier)
- **Supabase** - PostgreSQL database for market monitoring (free tier)
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
├── market-monitor.html     # Market order monitor (Supabase)
├── market-monitor-v2.html  # Market order monitor v2 (Supabase)
├── dashboard.html          # Dashboard overview
├── help.html               # Help & FAQ
├── shared-utils.js         # Shared JavaScript utilities (BitcraftUtils)
├── savedSearches.js        # localStorage management module
├── config-browser.js       # Centralized browser config (BitcraftConfig)
├── cloudflare-worker.js    # Cloudflare Workers CORS proxy (simple)
├── supabase-client.js      # Supabase REST API client
├── local-monitor.js        # Local market monitor (syncs to Supabase)
├── fetch-all-items.js      # Automated complete cache builder
├── check-progress.js       # Check local cache progress
├── proxy-server.py         # Local Python CORS proxy
├── wrangler.toml           # Cloudflare Workers config
├── start-server.bat        # Windows local startup script
├── items.json              # Item database (2.5MB)
├── resource_desc.json      # Resource descriptions (39K lines)
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
- Free tier: 100,000 requests/day
- No paid plan required (CORS proxy only)

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

## Architecture Overview

### Frontend Pages (Embedded JS/CSS)
All HTML files contain embedded JavaScript and CSS with no build step. Each page follows a consistent pattern:

1. **Configuration** - `API_BASE_URL` constant at top (Cloudflare Worker URL or empty for local)
2. **Shared Utilities** - `BitcraftUtils` module provides common functions (toast, clipboard, URL params, price formatting)
3. **Data Loading** - Fetch `items.json` on page load
4. **UI State Management** - Event listeners update DOM directly (no frameworks)
5. **API Integration** - Fetch data from bitjita.com via Cloudflare Worker proxy

### Shared Utilities Module (`shared-utils.js`)
The `BitcraftUtils` object provides cross-page functionality:
- **Toast notifications**: `showToast(message, type, duration)`
- **Clipboard**: `copyToClipboard(text, showNotification)`
- **URL parameters**: `getUrlParams()`, `setUrlParams(params, replace)`
- **Price formatting**: `formatPrice(price)` - converts to "1,234 hex" format
- **Debouncing**: `debounce(func, delay)`
- **Items cache**: Browser localStorage caching for items.json

Configuration is centralized in `config-browser.js` and accessed via `window.BitcraftConfig`.

### Critical Data Flow Pattern (gear-finder.html)

The gear finder has **two distinct data processing paths** that must return identical data structures:

#### Path 1: Bulk API (No Regional Filter)
```javascript
// Uses bulk endpoint (/api/market/prices/bulk) - fast, no claim names
gridData = processBulkDataToGrid(items, mergedBulkData);
```

#### Path 2: Individual API (Regional Filter Enabled)
```javascript
// Uses individual endpoints (/api/market/item/{id}) - slow, has claim names
gridData = processResultsToGrid(results, allRegionsChecked, targetRegionId);
```

**CRITICAL**: Both functions must initialize the same properties in their grouped data objects:
```javascript
{
  itemName, itemId, tier, category, isCargo,
  common, commonItemId, commonClaim,        // All 3 required
  uncommon, uncommonItemId, uncommonClaim,  // All 3 required
  rare, rareItemId, rareClaim,              // All 3 required
  epic, epicItemId, epicClaim,              // All 3 required
  legendary, legendaryItemId, legendaryClaim // All 3 required
}
```

**Common Bug**: Missing `*Claim` property initialization in `processBulkDataToGrid` causes undefined property access in `displayResults`, leading to table structure corruption and grid misalignment.

### Display Results Override Pattern
Several pages override the original `displayResults` function to add enhanced formatting:
```javascript
const originalDisplayResults = displayResults;
displayResults = function(data) {
    // Enhanced version with BitcraftUtils.formatPrice() and claim names
};
```

When modifying `displayResults`, ensure both the original and enhanced versions stay in sync.

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
- Cloudflare free tier: 100,000 requests/day (CORS proxy only)
- Supabase free tier: 500MB database, 2GB bandwidth/month

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
   - Saved searches with management modal (savedSearches.js)
   - Multi-item table search
   - Uses individual item API endpoints

2. **gear-finder.html** - Gear Finder
   - Advanced filtering (tier, category, rarity)
   - Two data paths: bulk API (fast) vs individual API (regional filter)
   - Table results display with sortable columns
   - Export to CSV functionality
   - Column filtering modal

3. **market-monitor.html** - Market Monitor
   - Real-time change detection via Supabase
   - Order count delta tracking
   - Change history (up to 1000 entries)
   - Supabase PostgreSQL backend

4. **dashboard.html** - Dashboard
   - Overview of market statistics
   - Uses BitcraftUtils for shared functionality

5. **help.html** - Help & FAQ
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
- **sync**: Manual upload to Supabase
- **debug**: Show orders for specific claim
- **state/changes**: View local cache status

### Sync Process
The local monitor syncs data directly to Supabase via REST API:
- Uploads market state to `market_state` table
- Uploads order details to `order_details` table
- Uploads changes to `change_history` table

This allows the website to display complete market data immediately.

### Workflow

The local monitor is now the primary data sync mechanism:
- **Initial setup**: `node local-monitor.js setup` (~15-20 minutes)
- **Continuous monitoring**: `node local-monitor.js monitor` (runs indefinitely, syncs to Supabase)
- **Manual sync**: `node local-monitor.js sync` (upload current state to Supabase)

The Cloudflare Worker only provides CORS proxy functionality - it does not store or monitor market data.

## Architecture

### Cloudflare Worker
The worker (`cloudflare-worker.js`) provides:
- **CORS proxy** - Routes requests to bitjita.com with proper headers
- Free tier: 100,000 requests/day
- No server-side state or monitoring (migrated to Supabase)

### Supabase Backend
Market monitoring is now handled by Supabase:
- **PostgreSQL database** - Stores market state, order details, and change history
- **REST API** - Frontend queries data directly from Supabase
- **local-monitor.js** - Syncs market data from bitjita.com to Supabase
- Free tier: 500MB database, 2GB bandwidth/month

### Database Tables
```
market_state     - Current market prices and statistics
order_details    - Buy/sell orders with claim names
change_history   - Market change events
```

## Development Workflow

- PR-based workflow with descriptive branch names
- No build pipeline - edit HTML/JS directly
- Test locally with `proxy-server.py` before deploying
- Deploy worker changes with `wrangler deploy`
- Push to main for GitHub Pages auto-deploy

## Common Pitfalls

### Grid Misalignment in Tables
**Symptom**: Table columns shift, content appears in wrong columns (e.g., "Leather Clothing" in LEGENDARY column instead of CATEGORY)

**Cause**: Data processing functions return objects with inconsistent properties. The `displayResults` function expects all `*Claim` properties to exist (even if null).

**Fix**: Ensure both `processBulkDataToGrid` and `processResultsToGrid` initialize identical property sets:
```javascript
grouped[key] = {
    // ... other properties
    commonClaim: null,      // REQUIRED - even if bulk API doesn't provide it
    uncommonClaim: null,
    rareClaim: null,
    epicClaim: null,
    legendaryClaim: null
};
```

### CORS Errors in Local Development
**Symptom**: API requests fail with CORS errors when testing locally

**Cause**: Not using the proxy server, or `API_BASE_URL` is set to worker URL instead of empty string

**Fix**:
1. Use `python proxy-server.py` (not a basic HTTP server)
2. Set `API_BASE_URL = ''` in HTML files for local development
3. Verify proxy server is running on port 8000

### Cached Data Issues
**Symptom**: Changes not appearing after editing HTML files

**Fix**: Hard refresh browser (Ctrl+Shift+R or Ctrl+F5) to bypass cache

### Display Function Overrides
**Symptom**: Changes to `displayResults` don't take effect, or inconsistent behavior

**Cause**: Multiple HTML files have two versions of `displayResults` - original and enhanced override

**Fix**: When modifying display logic, update both versions (search for `displayResults =` and `function displayResults`)

### Bulk API ID Type Mismatch
**Symptom**: Price data not found for items when using bulk API, even though API returns data

**Cause**: Item IDs in `items.json` may be strings (e.g., `"6180012"`) while the bulk API response may key data by integers or vice versa. JavaScript object property lookup is type-sensitive for non-coerced comparisons.

**Fix**: Always check both string and integer keys when looking up bulk API data:
```javascript
const priceData = bulkData.data.items[item.id] || bulkData.data.items[parseInt(item.id)];
```

### Cargo Items in Bulk API
**Symptom**: Cargo items show no price data even when bulk API returns their data

**Cause**: Cargo item prices are returned in `bulkData.data.cargo`, not `bulkData.data.items`. Code that only checks `items` will miss all cargo data.

**Fix**: Check the correct data object based on item type:
```javascript
const priceData = item.itemType === 'cargo'
    ? (bulkData.data.cargo?.[item.id] || bulkData.data.cargo?.[parseInt(item.id)])
    : (bulkData.data.items?.[item.id] || bulkData.data.items?.[parseInt(item.id)]);
```

### HTML Escaping in Table Templates
**Symptom**: Table grid misalignment, content appearing in wrong columns, or broken HTML

**Cause**: Dynamic content (item names, claim names, categories) containing special HTML characters (`<`, `>`, `&`, quotes) can corrupt the table structure when inserted via template literals.

**Fix**: Always use `BitcraftUtils.escapeHtml()` for user-generated or API-sourced text in HTML templates:
```javascript
<td>${BitcraftUtils.escapeHtml(row.itemName)}</td>
${row.commonClaim ? `<div class="claim-name">${BitcraftUtils.escapeHtml(row.commonClaim)}</div>` : ''}
```

## Testing Changes

### Local Testing Workflow
1. Set `API_BASE_URL = ''` in HTML file being tested
2. Start proxy server: `python proxy-server.py`
3. Open http://localhost:8000/[page].html in browser
4. Test functionality with various filters/inputs
5. Check browser console for errors
6. Hard refresh (Ctrl+Shift+R) after each code change

### Testing Gear Finder Grid
To verify grid alignment is correct:
1. Open gear-finder.html
2. Select a category with multiple rarities (e.g., "Leather Clothing")
3. Select a tier (e.g., Tier 6)
4. Click Search
5. Verify:
   - Category names appear in rightmost CATEGORY column
   - Each price cell contains only one price value
   - No content overflow into adjacent columns
   - All 8 columns properly aligned

### Before Deploying
1. Set `API_BASE_URL = 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev'` in all HTML files
2. Test locally one more time with worker URL
3. Commit and push to main
4. Wait ~1 minute for GitHub Pages deployment
5. Test live site to verify changes

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
- `local-monitor.js` - Main local monitor (2 automated modes + manual tools, syncs to Supabase)
- `supabase-client.js` - Supabase REST API client
- `fetch-all-items.js` - Standalone complete cache builder
- `check-progress.js` - Cache progress checker
