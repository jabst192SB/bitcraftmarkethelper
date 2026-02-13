# Architecture Overview

## Current Architecture

```
Frontend: HTML files with embedded CSS/JS (GitHub Pages)
Backend:  Cloudflare Worker (CORS proxy only)
Database: Supabase PostgreSQL (market monitoring data)
Sync:     Node.js local monitor (fetches from bitjita.com, writes to Supabase)
```

### Data Flow

```
bitjita.com API  <--  local-monitor.js  -->  Supabase PostgreSQL
                                                     |
GitHub Pages (HTML/JS)  <---  Supabase REST API  ----+
                        <---  Cloudflare Worker (CORS proxy) <--- bitjita.com
```

- **Market search & gear finder** pages use the Cloudflare Worker as a CORS proxy to query bitjita.com directly
- **Market monitor** pages read pre-synced data from Supabase
- **local-monitor.js** runs locally, fetches all market data from bitjita.com, and syncs to Supabase

### Database Tables

| Table | Purpose |
|-------|---------|
| `market_items` | Current market prices, order counts, item metadata |
| `order_details` | Full buy/sell orders with claim names (JSONB) |
| `market_changes` | Change history events |
| `monitor_metadata` | Last update time, total change count |

### Key Components

| Component | Role |
|-----------|------|
| `cloudflare-worker.js` | CORS proxy for browser API requests to bitjita.com |
| `local-monitor.js` | Fetches market data, detects changes, syncs to Supabase |
| `supabase-client.js` | REST API client for Supabase operations |
| `shared-utils.js` | Browser-side utilities (toast, clipboard, formatting) |
| `config-browser.js` | Centralized browser configuration |

## Migration from Durable Objects (Completed Feb 2026)

The project originally used Cloudflare Durable Objects for market monitoring storage, which required a $5/month paid plan. This was replaced with Supabase's free tier.

### Before

```
Local Monitor --> Cloudflare Worker --> Durable Objects Storage
Website       --> Cloudflare Worker --> Durable Objects Storage
```

- $5/month cost (Workers Paid plan)
- 50 subrequest limit per Worker run
- 128KB per row storage limit
- ~6 hours to cache all items

### After

```
Local Monitor --> Supabase PostgreSQL (direct)
Website       --> Supabase REST API (direct)
```

- Free (Supabase free tier)
- Unlimited API requests
- 500MB database storage
- ~15-20 minutes to cache all items

### What Changed

**Created**: `supabase-schema.sql`, `supabase-client.js`, `.env.example`
**Simplified**: `cloudflare-worker.js` (CORS proxy only, no DO)
**Modified**: `local-monitor.js` (syncs to Supabase instead of Worker), `market-monitor.html` / `market-monitor-v2.html` (reads from Supabase)
**Deleted**: `sync-to-worker.js` (no longer needed)

## Code Quality Notes

### Strengths

- Zero build pipeline - edit HTML/JS directly, deploy via GitHub Pages
- Dark theme with consistent styling
- Bulk API usage for efficient batch requests
- Offline-capable with local state persistence

### Known Areas for Improvement

- ~2,100 lines of CSS duplicated across HTML files (could extract to shared stylesheet)
- Modal, toast, and tooltip implementations duplicated across pages
- All JS embedded in HTML files (no separate modules for page logic)
- `items.json` (3.3MB) loaded fresh on each page (could benefit from IndexedDB caching)

### Potential Future Enhancements

- Shared CSS file to eliminate duplication
- Virtual scrolling for large datasets (2900+ items)
- Price history charts
- Favorites/watchlist
- URL state for shareable filter configurations
