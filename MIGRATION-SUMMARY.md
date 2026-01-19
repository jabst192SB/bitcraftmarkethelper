# Migration to Supabase - Summary

## What Changed

The Bitcraft Market Helper has been migrated from **Cloudflare Durable Objects** to **Supabase** for market monitoring storage.

### Why?
- Cloudflare Durable Objects required a **$5/month paid plan**
- You hit the free tier write limit, causing the 500 error
- Supabase's free tier is more than sufficient for this use case

## Quick Start

### 1. Set up Supabase (5 minutes)
See full guide: [SUPABASE-SETUP.md](SUPABASE-SETUP.md)

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Run supabase-schema.sql in SQL Editor
# 3. Copy .env.example to .env and add your credentials
cp .env.example .env
# Edit .env with your SUPABASE_URL and SUPABASE_SERVICE_KEY
```

### 2. Initial data sync (15-20 minutes)
```bash
npm install dotenv  # Already done for you
node local-monitor.js setup
```

### 3. Start continuous monitoring
```bash
node local-monitor.js monitor
```

### 4. Update website
Edit `market-monitor.html` lines 1111-1112 with your Supabase URL and anon key.

### 5. Deploy simplified worker (optional)
```bash
wrangler deploy -c wrangler-simple.toml
```

## Files Created

- `supabase-schema.sql` - Database schema to run in Supabase
- `supabase-client.js` - REST API client for Node.js
- `cloudflare-worker-simple.js` - Simplified CORS-only worker
- `wrangler-simple.toml` - Worker config without Durable Objects
- `.env.example` - Template for Supabase credentials
- `SUPABASE-SETUP.md` - Detailed setup instructions
- `MIGRATION-SUMMARY.md` - This file

## Files Modified

- `local-monitor.js` - Now syncs to Supabase instead of worker
- `market-monitor.html` - Now reads from Supabase REST API
- `.gitignore` - Added `.env` to prevent credential leaks

## Files Unchanged

- `index.html` - Still uses worker for CORS proxy
- `gear-finder.html` - Still uses worker for CORS proxy
- `items.json` - Item database unchanged
- All other search/display functionality unchanged

## Architecture

### Before (Cloudflare Durable Objects)
```
Local Monitor → Cloudflare Worker → Durable Objects Storage
Website → Cloudflare Worker → Durable Objects Storage
```

### After (Supabase)
```
Local Monitor → Supabase PostgreSQL
Website → Supabase REST API (direct)
```

## Benefits

✅ **Free**: No monthly costs (Supabase free tier)
✅ **Faster initial setup**: 15-20 min vs 6 hours
✅ **Unlimited API requests**: No more 50 subrequest limits
✅ **More storage**: 500MB vs 128KB per row
✅ **Better queries**: PostgreSQL with indexes
✅ **Real-time subscriptions**: Can add live updates later

## Next Steps

1. Follow [SUPABASE-SETUP.md](SUPABASE-SETUP.md) to set up your database
2. Run initial sync: `node local-monitor.js setup`
3. Start monitoring: `node local-monitor.js monitor`
4. Test the website: Open `market-monitor.html` in your browser
5. Deploy the simplified worker (optional)

## Need Help?

- Check [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for detailed setup
- See [LOCAL-MONITOR-README.md](LOCAL-MONITOR-README.md) for monitor commands
- Review [CLAUDE.md](CLAUDE.md) for overall project architecture
