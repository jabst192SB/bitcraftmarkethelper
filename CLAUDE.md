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
        totalSellQuantity: number
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
POST /api/monitor/update          # Trigger manual update
POST /api/monitor/reset           # Reset all state
```

## Development Workflow

- PR-based workflow with descriptive branch names
- No build pipeline - edit HTML/JS directly
- Test locally with `proxy-server.py` before deploying
- Deploy worker changes with `wrangler deploy`
- Push to main for GitHub Pages auto-deploy
