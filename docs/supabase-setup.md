# Supabase Setup Guide

Supabase provides the PostgreSQL backend for the market monitoring feature. The free tier includes 500MB storage and unlimited API requests.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create an account)
2. Click "New Project"
3. Fill in:
   - **Name**: `bitcraft-market-helper`
   - **Database Password**: Choose a strong password (save it)
   - **Region**: Closest to you
4. Click "Create new project" (takes 1-2 minutes)

## Step 2: Run the Database Schema

1. Go to the **SQL Editor** in the left sidebar
2. Click "New Query"
3. Paste the contents of [`supabase-schema.sql`](../supabase-schema.sql) and click "Run"
4. You should see: "Success. No rows returned"

This creates the tables:
- `market_items` - Current market order counts and item metadata
- `order_details` - Full order details (JSONB)
- `market_changes` - Change history
- `monitor_metadata` - Last update time, change count

## Step 3: Get Your API Credentials

1. Go to **Project Settings** (gear icon) > **API**
2. Note these values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public key**: Read-only access (used in website HTML)
   - **service_role key**: Read-write access (used in local-monitor.js)

**Important**: The `service_role` key has admin access. Never commit it to Git.

## Step 4: Configure Local Monitor

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

3. Test the connection:
   ```bash
   node local-monitor.js state
   ```

## Step 5: Configure Market Monitor Website

1. Open `market-monitor.html`
2. Find and update these lines:
   ```javascript
   const SUPABASE_URL = 'https://your-project-id.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-public-key-here';
   ```

The `anon` key is safe to expose publicly (read-only).

## Step 6: Initial Data Upload

```bash
node local-monitor.js setup
```

This fetches all ~2964 items and syncs to Supabase (~15-20 minutes).

## Step 7: Start Monitoring

```bash
node local-monitor.js monitor
```

Checks for changes every 2 minutes and auto-syncs to Supabase. See [Local Monitor](local-monitor.md) for all commands.

## Verification

1. Open `market-monitor.html` in your browser
2. You should see:
   - **Status**: Active (green dot)
   - **Items with Orders**: ~2,900+ items
   - Market orders in the table
   - Recent changes in the right panel

## Troubleshooting

### "Supabase client not initialized"
- Verify `.env` has correct `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Run `node local-monitor.js state` to test

### "Failed to fetch state: 401" in browser
- Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `market-monitor.html`
- Make sure you're using the `anon` key (not `service_role`) in HTML

### "Supabase query failed: 404"
- Run the SQL schema from Step 2

### No data showing
- Run `node local-monitor.js setup` to populate the database

## Cost

| Feature | Free Tier |
|---------|-----------|
| Database Storage | 500MB (we use ~50-100MB) |
| API Requests | Unlimited |
| Monthly Cost | $0 |
| Credit Card | Not required |
