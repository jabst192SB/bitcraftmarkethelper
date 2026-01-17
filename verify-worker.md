# Verify Cloudflare Worker Status

## Quick Verification Commands

Use these commands with the explicit worker name:

### 1. Check if worker is deployed
```bash
npx wrangler deployments list --name bitcraft-market-proxy
```

### 2. View real-time logs
```bash
npx wrangler tail bitcraft-market-proxy
```

### 3. Check worker status
```bash
npx wrangler whoami
```

### 4. Deploy/redeploy the worker
```bash
npx wrangler deploy --name bitcraft-market-proxy
```

## Test the Worker Endpoints

Your worker URL is: `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`

Test these endpoints:

### Test proxy endpoint (PowerShell):
```powershell
Invoke-WebRequest -Uri "https://bitcraft-market-proxy.jbaird-cb6.workers.dev/api/market?claimEntityId=288230376332988523"
```

### Test market monitor state:
```powershell
Invoke-WebRequest -Uri "https://bitcraft-market-proxy.jbaird-cb6.workers.dev/api/monitor/state"
```

### Test market monitor changes:
```powershell
Invoke-WebRequest -Uri "https://bitcraft-market-proxy.jbaird-cb6.workers.dev/api/monitor/changes"
```

## Troubleshooting

### If wrangler.toml is missing locally:
Make sure you're in the correct directory:
```bash
cd E:\Repos\bitcraftmarkethelper
ls wrangler.toml
```

### If the file doesn't exist:
You may need to pull the latest changes:
```bash
git pull origin main
```

### Quick test without worker name:
If wrangler.toml is in your current directory, these should work:
```bash
npx wrangler status
```

## Alternative: Use Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. Click on "Workers & Pages"
3. Look for "bitcraft-market-proxy" in the list
4. Click on it to see:
   - Deployment status
   - Recent requests
   - Logs
   - Cron triggers

## Expected Results

If the worker is running correctly:
- `/api/monitor/state` should return JSON with currentState, lastUpdate, changeCount
- `/api/monitor/changes` should return JSON with changes array
- Logs should show cron triggers every 5 minutes
