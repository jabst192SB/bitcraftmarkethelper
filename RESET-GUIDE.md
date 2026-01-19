# Reset Guide - Clear All Market Data

## Quick Reset (Recommended)

Simply run:

```bash
node local-monitor.js reset
```

This will:
- ✅ Delete local cache file (`local-monitor-state.json`)
- ✅ Clear **all** Supabase tables (`market_items`, `order_details`, `market_changes`)
- ✅ Reset metadata (last update time, change count)

## After Reset - Fresh Start

```bash
# Build complete cache and sync to Supabase (~15-20 minutes)
node local-monitor.js setup

# Then start continuous monitoring (every 5 minutes)
node local-monitor.js monitor 300
```

## Manual Reset (If Needed)

If the automated reset fails, you can manually clear Supabase:

### Open Supabase SQL Editor and run:

```sql
-- Delete all data from tables
TRUNCATE TABLE market_changes CASCADE;
TRUNCATE TABLE order_details CASCADE;
TRUNCATE TABLE market_items CASCADE;

-- Reset metadata
UPDATE monitor_metadata SET value = 'null'::jsonb WHERE key = 'last_update';
UPDATE monitor_metadata SET value = '0'::jsonb WHERE key = 'change_count';
```

### Then delete local cache:

```bash
# Windows
del local-monitor-state.json

# Linux/Mac
rm local-monitor-state.json
```

## What Gets Deleted

When you run `node local-monitor.js reset`:

### Local Files
- `local-monitor-state.json` - All cached market data and change history

### Supabase Tables
- `market_changes` - All change history entries
- `order_details` - All detailed order information
- `market_items` - All item listings with order counts
- `monitor_metadata` - Reset to defaults (last_update = null, change_count = 0)

## Troubleshooting

### Error: "Supabase client not initialized"
Make sure your `.env` file has:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

### Reset only clears local cache
If you see "Supabase client not initialized - skipping database clear", the command only deleted the local file. You'll need to manually run the SQL commands above in Supabase.

### Permission errors
Make sure you're using the **service role key** (not the anon key) in your `.env` file for full database access.
