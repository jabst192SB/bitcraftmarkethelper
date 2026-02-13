# Troubleshooting & Fix History

Common issues and their solutions for the Bitcraft Market Helper.

## Resetting All Data

To clear everything and start fresh:

```bash
node local-monitor.js reset
```

This deletes:
- **Local**: `local-monitor-state.json` (cached market data and change history)
- **Supabase**: All rows in `market_changes`, `order_details`, `market_items` tables; resets `monitor_metadata`

### After Reset

```bash
# Rebuild complete cache (~15-20 minutes)
node local-monitor.js setup

# Start continuous monitoring
node local-monitor.js monitor 300
```

### Manual Reset (If Automated Fails)

Run in Supabase SQL Editor:
```sql
TRUNCATE TABLE market_changes CASCADE;
TRUNCATE TABLE order_details CASCADE;
TRUNCATE TABLE market_items CASCADE;
UPDATE monitor_metadata SET value = 'null'::jsonb WHERE key = 'last_update';
UPDATE monitor_metadata SET value = '0'::jsonb WHERE key = 'change_count';
```

Then delete the local file:
```bash
del local-monitor-state.json
```

---

## Item Names Displaying as IDs

**Symptom**: Market monitor shows "Item 1003" instead of "Stone Pickaxe".

**Cause**: The `market_items` table was missing metadata columns (`tier`, `rarity`, `category`). The local monitor fetched this data but wasn't uploading it to Supabase.

**Fix**: A database migration added the missing columns (`supabase-add-item-metadata.sql`), and `local-monitor.js` was updated to upload tier/rarity/category data.

**If you see this**: Run the migration SQL, then re-sync:
```bash
node local-monitor.js sync
```

---

## Item Names Missing for Items > 1000

**Symptom**: First 1000 items display correctly, but remaining items show as "Item {ID}".

**Cause**: Supabase REST API returns a maximum of 1000 rows by default. Requesting `limit=10000` still hits the project-level hard limit of 1000.

**Fix**: Implemented pagination in `market-monitor.html` via `supabaseQueryAll()` that fetches rows in batches of 1000 and combines them.

**If you see this**: Hard refresh the page (Ctrl+F5). The pagination is built into the current code.

---

## Orders Not Syncing to Supabase

**Symptom**: After `node local-monitor.js sync`, no orders appear on the website. Log shows "Filtered out 2958 orphaned order details".

**Cause**: Type mismatch in the filtering logic. `marketItemIds` Set contained strings, but `parseInt()` was converting IDs to numbers for comparison. JavaScript `Set.has()` uses strict equality, so `Set.has(1)` returns false when the Set contains `'1'`.

**Fix**: Changed filtering to use consistent string comparison:
```javascript
const marketItemIds = new Set(marketItems.map(item => String(item.item_id)));
// ...
return marketItemIds.has(String(itemId));
```

**If you see this**: The fix is in the current code. Re-run `node local-monitor.js sync`.

---

## Changes Not Displaying on Market Monitor

**Symptom**: "Recent Changes" section shows "No changes detected yet" despite changes being tracked locally.

**Cause**: The sync function was not uploading change history to the `market_changes` table. Changes were recorded in `local-monitor-state.json` but never sent to Supabase.

**Fix**: Added a step in `syncToSupabase()` to upload change history entries.

**If you see this**: Re-run `node local-monitor.js sync`.

---

## General Issues

### CORS Errors in Local Development

- Use `python proxy-server.py` (not a basic HTTP server)
- Set `API_BASE_URL = ''` in HTML files for local development
- Verify proxy server is running on port 8000

### Cached Page Not Updating

Hard refresh: Ctrl+Shift+R or Ctrl+F5

### "Supabase client not initialized"

Check `.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

### "Failed to fetch state: 401" in Browser

Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `market-monitor.html`. Use the `anon` key (not `service_role`) in the HTML file.

### "Supabase query failed: 404"

The database schema hasn't been run. Execute `supabase-schema.sql` in the Supabase SQL Editor.

### Node.js Version Error

`fetch` requires Node.js 18+:
```bash
node --version  # Must be v18.0.0 or higher
```

### Port Already in Use

Edit `proxy-server.py` and change the port:
```python
run_server(8001)  # Change 8000 to any available port
```

### Grid Misalignment in Gear Finder Tables

**Cause**: Data processing functions return objects with inconsistent properties. The `displayResults` function expects all `*Claim` properties to exist.

**Fix**: Ensure both `processBulkDataToGrid` and `processResultsToGrid` initialize identical property sets including `commonClaim`, `uncommonClaim`, `rareClaim`, `epicClaim`, `legendaryClaim` (even if null).
