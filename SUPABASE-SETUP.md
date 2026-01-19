# Supabase Setup Guide

This guide will help you set up Supabase as the backend for the Bitcraft Market Helper's market monitoring feature.

## Why Supabase?

The project originally used Cloudflare Durable Objects for market monitoring, but this required a paid plan ($5/month). Supabase's free tier provides:

- **500MB database storage** (we only need ~50-100MB)
- **Unlimited API requests** (huge win over Cloudflare's 50 subrequests/run limit)
- **PostgreSQL database** with real-time subscriptions
- **No credit card required**

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create an account)
2. Click "New Project"
3. Fill in the details:
   - **Name**: `bitcraft-market-helper` (or any name you like)
   - **Database Password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose the closest region to you
4. Click "Create new project" (this takes 1-2 minutes)

## Step 2: Run the Database Schema

1. Once your project is ready, go to the **SQL Editor** in the left sidebar
2. Click "New Query"
3. Copy the entire contents of [`supabase-schema.sql`](supabase-schema.sql) and paste it into the editor
4. Click "Run" (or press Ctrl+Enter)
5. You should see a success message: "Success. No rows returned"

This creates all the necessary tables:
- `market_items` - Current market order counts
- `order_details` - Full order details (JSONB)
- `market_changes` - Change history
- `monitor_metadata` - Last update time, change count

## Step 3: Get Your API Credentials

1. Go to **Project Settings** (gear icon in left sidebar)
2. Click **API** in the sidebar
3. You'll see two important values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public key**: For read-only access (used in website)
   - **service_role key**: For read-write access (used in local-monitor.js)

**IMPORTANT**: The `service_role` key has admin access. **Never** commit it to Git or expose it publicly!

## Step 4: Configure Local Monitor

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

3. Save the file

4. Test the connection:
   ```bash
   node local-monitor.js state
   ```

   You should see: "✓ Supabase client initialized"

## Step 5: Configure Market Monitor Website

1. Open `market-monitor.html` in your code editor
2. Find these lines near the top of the `<script>` section:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
   ```

3. Replace with your actual values:
   ```javascript
   const SUPABASE_URL = 'https://your-project-id.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-public-key-here';
   ```

4. Save the file

**Note**: The `anon` key is safe to expose publicly (it's read-only).

## Step 6: Initial Data Upload

Now let's populate your Supabase database with market data:

```bash
# Fetch all market items and sync to Supabase (~15-20 minutes)
node local-monitor.js setup
```

This will:
1. Fetch list of all items with orders (~2,964 items)
2. Fetch detailed order information for each item
3. Upload everything to Supabase

## Step 7: Start Monitoring

Once the initial setup is complete, start continuous monitoring:

```bash
# Check for changes every 2 minutes and sync to Supabase
node local-monitor.js monitor
```

Keep this running in the background. It will:
- Check all items using the bulk API (~6 seconds per check)
- Fetch details only for changed items
- Automatically sync to Supabase
- Repeat every 2 minutes (default)

## Step 8: Deploy Worker (Optional)

The Cloudflare Worker is now just a simple CORS proxy (no Durable Objects):

```bash
# Deploy the simplified worker
wrangler deploy -c wrangler-simple.toml
```

This allows the main search pages (index.html, gear-finder.html) to work without CORS issues.

## Verification

1. Open `market-monitor.html` in your browser (or visit your GitHub Pages URL)
2. You should see:
   - **Status**: Active (green dot)
   - **Items with Orders**: ~2,900+ items
   - **Total Changes**: Number of tracked changes
   - Market orders displayed in the table
   - Recent changes in the right panel

3. If you see errors:
   - Check browser console (F12) for error messages
   - Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `market-monitor.html`
   - Check that the SQL schema was executed successfully

## Commands Reference

### Local Monitor
```bash
# Initial setup (run once)
node local-monitor.js setup

# Continuous monitoring (keep running)
node local-monitor.js monitor [interval]

# Manual sync to Supabase
node local-monitor.js sync

# Check local state
node local-monitor.js state

# View recent changes
node local-monitor.js changes [limit]

# Debug specific claim
node local-monitor.js debug "Claim Name"

# Reset all data
node local-monitor.js reset
```

### Worker Deployment
```bash
# Deploy simplified worker (CORS proxy only)
wrangler deploy -c wrangler-simple.toml

# View logs
wrangler tail
```

## Troubleshooting

### "Supabase client not initialized"
- Make sure `.env` file exists and has correct credentials
- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
- Run `node local-monitor.js state` to test connection

### "Failed to fetch state: 401" in browser
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `market-monitor.html`
- Make sure you're using the `anon` key (not service_role) in the HTML file

### "Supabase query failed: 404"
- Make sure you ran the SQL schema in Step 2
- Check that all tables exist in Supabase SQL Editor

### Local monitor shows no data
- Run `node local-monitor.js setup` first to populate the database
- Check local state: `node local-monitor.js state`

## Migration from Cloudflare Durable Objects

If you were previously using the Durable Objects version:

1. Your local state file (`local-monitor-state.json`) still works
2. Run `node local-monitor.js sync` to upload existing data to Supabase
3. The old worker endpoints (`/api/monitor/state`, etc.) no longer work
4. Update `market-monitor.html` as described in Step 5

## Cost Comparison

| Feature | Cloudflare (Old) | Supabase (New) |
|---------|-----------------|----------------|
| Monthly Cost | $5 (Durable Objects) | **$0 (Free tier)** |
| Database Storage | 128KB per row limit | 500MB total |
| API Requests | 50 subrequests/run | **Unlimited** |
| Initial Cache Time | ~6 hours (40 items per 5min) | ~15-20 min (all items) |
| Setup Complexity | Medium | Low |

## Questions?

- Check the [main README](README.md) for general project info
- See [LOCAL-MONITOR-README.md](LOCAL-MONITOR-README.md) for local monitor details
- File an issue on GitHub if you encounter problems
