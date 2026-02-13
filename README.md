# Bitcraft Market Helper

A lightweight web application for browsing Bitcraft market data with real-time API integration.

## Deployment Options

### Option 1: GitHub Pages (Recommended for Hosting)

Deploy to GitHub Pages with Cloudflare Workers as a free API proxy.

**[Cloudflare Setup Guide](docs/cloudflare-setup.md)**

- Free hosting on GitHub Pages
- Free API proxy via Cloudflare Workers (100,000 requests/day)
- No server maintenance required

### Option 2: Local Development

Run the app locally using the Python proxy server.

## Quick Start (Local Development)

### Method 1: Double-Click Start (Easiest)
1. Double-click `start-server.bat`
2. The application opens in your browser
3. Keep the command window open while using the app

### Method 2: Manual Python Server
1. Open Command Prompt or PowerShell in this folder
2. Run: `python proxy-server.py`
3. Open browser to: http://localhost:8000

The proxy server is required to bypass CORS restrictions from the Bitjita API.

## Market Monitoring

To populate and keep the market monitor updated:

```bash
# Initial setup (~15-20 minutes)
node local-monitor.js setup

# Continuous monitoring (keep running)
node local-monitor.js monitor
```

See the [Local Monitor Guide](docs/local-monitor.md) for all commands and options.

## Features

- **Item Search**: Typeahead search with tier filtering
- **Market Statistics**: Lowest sell, highest buy, and order counts
- **Buy/Sell Orders**: Two-column layout with claim names
- **Region Filtering**: Default to Solvenar (Region 4)
- **Gear Finder**: Advanced filtering by tier, category, and rarity
- **Market Monitor**: Real-time change detection via Supabase

## Requirements

- **Browser**: Chrome, Firefox, or Edge
- **Local development**: Python 3 (for proxy server)
- **Market monitoring**: Node.js 18+ (for local monitor)

## Documentation

| Guide | Description |
|-------|-------------|
| [Local Monitor](docs/local-monitor.md) | Fetching and syncing market data |
| [Supabase Setup](docs/supabase-setup.md) | Database backend for market monitoring |
| [Cloudflare Setup](docs/cloudflare-setup.md) | CORS proxy deployment |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and fixes |
| [Architecture](docs/architecture.md) | System design and migration history |

## Repository Files

- `index.html` - Main market search page
- `gear-finder.html` - Gear finder / market analyzer
- `market-monitor.html` - Market order monitor
- `dashboard.html` - Dashboard overview
- `help.html` - Help & FAQ
- `items.json` - Item database (2.5MB)
- `proxy-server.py` - Local Python CORS proxy
- `cloudflare-worker.js` - Cloudflare Worker CORS proxy
- `local-monitor.js` - Local market monitor (syncs to Supabase)
- `supabase-client.js` - Supabase REST API client

## Switching Between Local and GitHub Pages

- **Local Development**: `API_BASE_URL = ''` in HTML files
- **GitHub Pages**: `API_BASE_URL = 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev'`

Update `API_BASE_URL` at the top of `index.html`, `gear-finder.html`, and `market-monitor.html`.

---

Built with vanilla HTML, CSS, and JavaScript.
