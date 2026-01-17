# Market Order Monitor - Deployment Guide

This guide will help you deploy the Market Order Monitor with Durable Objects support.

## Prerequisites

1. **Cloudflare Account** with Workers enabled
   - Sign up at https://dash.cloudflare.com/sign-up

2. **Wrangler CLI** installed
   ```bash
   npm install -g wrangler
   ```

3. **Authenticate with Cloudflare**
   ```bash
   wrangler login
   ```

## Important: Durable Objects Billing

⚠️ **Durable Objects requires a Workers Paid plan ($5/month)**

- **Free tier does NOT support Durable Objects**
- You'll need to upgrade to the Workers Paid plan
- Pricing details: https://developers.cloudflare.com/workers/platform/pricing/

### Durable Objects Pricing Breakdown:
- Base: Workers Paid plan ($5/month)
- Durable Objects: Included in paid plan
- Usage charges:
  - Requests: $0.15 per million requests (after 1M free)
  - Duration: $12.50 per million GB-seconds (after 400K free)

For this use case (5-minute polling), costs should stay within free tier limits.

## Deployment Steps

### Step 1: Upgrade to Workers Paid Plan

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **Plans**
3. Click **Upgrade to Paid**
4. Confirm payment method ($5/month)

### Step 2: Deploy the Worker

Navigate to your project directory and deploy:

```bash
cd /path/to/bitcraftmarkethelper
wrangler deploy
```

This will:
- Deploy the updated worker with Durable Objects support
- Create the MarketMonitor Durable Object class
- Set up the cron trigger (runs every 5 minutes)
- Apply the migrations

### Step 3: Verify Deployment

After deployment, you should see output like:

```
✨ Compiled Worker successfully
✨ Uploading...
✨ Deployment complete!
✨ https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev
```

### Step 4: Test the Monitor Endpoints

Test the new monitor endpoints:

1. **Check state endpoint:**
   ```bash
   curl https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev/api/monitor/state
   ```

2. **Check changes endpoint:**
   ```bash
   curl https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev/api/monitor/changes
   ```

On first deployment, these will return empty/null data. After the first cron run (within 5 minutes), data will appear.

### Step 5: Manual Trigger (Optional)

To manually trigger the market data fetch without waiting for cron:

```bash
wrangler deploy --test-scheduled
```

Or use the Cloudflare Dashboard:
1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Triggers** → **Cron Triggers**
4. Click **Test Trigger**

### Step 6: Deploy the Frontend

1. Add `market-monitor.html` to your repository
2. Update the API_BASE_URL in `market-monitor.html` if needed (line 261)
3. Commit and push to GitHub:
   ```bash
   git add market-monitor.html
   git commit -m "Add market order monitor"
   git push
   ```

4. Access the monitor at:
   ```
   https://YOUR_USERNAME.github.io/bitcraftmarkethelper/market-monitor.html
   ```

## Configuration

### Adjust Polling Frequency

To change how often the worker polls the market API:

Edit `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

Options:
- `*/1 * * * *` - Every 1 minute (more frequent, higher costs)
- `*/10 * * * *` - Every 10 minutes (less frequent, lower costs)
- `*/15 * * * *` - Every 15 minutes

After changing, redeploy:
```bash
wrangler deploy
```

### Change Claim Entity ID

To monitor a different claim/region, edit `cloudflare-worker.js` (line 13):

```javascript
const CLAIM_ENTITY_ID = '288230376332988523';  // Your claim ID
```

## Monitoring & Debugging

### View Worker Logs

Real-time logs:
```bash
wrangler tail
```

### Check Cron Execution

1. Go to Cloudflare Dashboard
2. Navigate to **Workers & Pages** → Your worker
3. Click **Logs**
4. Look for cron execution logs

### View Durable Object State

Use the debug endpoint:
```bash
curl https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev/api/monitor/state
```

### Reset State (if needed)

To clear all stored data and start fresh:

```bash
curl -X POST https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev/api/monitor/reset
```

## Troubleshooting

### Error: "Durable Objects not available"

**Solution:** Ensure you've upgraded to Workers Paid plan ($5/month)

### Cron Not Running

**Possible causes:**
1. Worker not deployed correctly
2. Cron trigger not configured in wrangler.toml

**Solution:**
```bash
wrangler deploy
wrangler deployments list  # Verify deployment
```

### No Data Appearing

**Causes:**
1. First cron hasn't run yet (wait 5 minutes)
2. API endpoint changed
3. Network issues

**Solution:**
- Manually trigger: `wrangler deploy --test-scheduled`
- Check logs: `wrangler tail`

### CORS Errors

The worker includes CORS headers by default. If you still get errors:

1. Verify `API_BASE_URL` in `market-monitor.html` points to your worker
2. Check browser console for specific errors
3. Ensure worker is deployed and accessible

## API Endpoints

The worker exposes these endpoints:

### Monitor API

- `GET /api/monitor/state` - Get current market state and metadata
- `GET /api/monitor/changes?limit=50` - Get recent changes (default 50)
- `POST /api/monitor/reset` - Reset all stored data (debug only)

### Proxy API (existing)

- `GET /api/market/*` - Proxies to bitjita.com with CORS headers
- `POST /api/market/*` - Proxies POST requests

## Cost Estimation

Based on the default configuration (5-minute polling):

- Cron executions: 8,640/month (every 5 min × 24h × 30 days)
- Frontend requests: ~1,000-5,000/month (depending on users)
- **Total estimated cost: $5/month (base plan only)**

Usage should stay well within free tier limits for:
- Durable Object requests: 1M free/month
- Duration: 400K GB-seconds free/month

## Upgrading

To update the worker:

1. Make changes to `cloudflare-worker.js`
2. Deploy:
   ```bash
   wrangler deploy
   ```

No data loss - Durable Objects persist data across deployments.

## Support

For issues:
1. Check Cloudflare Workers docs: https://developers.cloudflare.com/workers/
2. View worker logs: `wrangler tail`
3. Check Durable Objects docs: https://developers.cloudflare.com/durable-objects/

## Next Steps

After deployment:

1. ✅ Visit `market-monitor.html` to see live updates
2. ✅ Bookmark it for quick access
3. ✅ Share with your Bitcraft community
4. ✅ Monitor the change log for market opportunities

The system will automatically:
- Poll every 5 minutes
- Detect order changes
- Track new items with orders
- Maintain change history

Enjoy real-time market monitoring! 📊
