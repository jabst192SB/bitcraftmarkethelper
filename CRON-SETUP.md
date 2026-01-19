# External Cron Setup with cron-job.org

## Why External Cron?

Cloudflare Workers free tier has CPU time limits that cause the scheduled market monitor to fail with "Exceeded CPU Limit" errors. Using an external cron service to call our `/api/monitor/trigger` endpoint avoids these limits while providing reliable scheduled updates.

## Setup Instructions

### 1. Create Account at cron-job.org

1. Visit https://cron-job.org/
2. Click "Sign up" (free account)
3. Verify your email address
4. Log in to dashboard

### 2. Create Cron Job

1. Click **"Create cronjob"** button
2. Fill in the form:

   **Title:** `Bitcraft Market Monitor`

   **Address (URL):** `https://bitcraft-market-proxy.jbaird-cb6.workers.dev/api/monitor/trigger`

   **Execution schedule:**
   - Select "Every 5 minutes" from dropdown
   - Or use custom: `*/5 * * * *`

   **Request method:** `POST`

   **Request timeout:** `30 seconds` (default)

   **Save responses:** `Enabled` (optional, useful for debugging)

3. Click **"Create cronjob"**

### 3. Test the Job

1. After creating, click the job name in the dashboard
2. Click **"Run now"** to test immediately
3. Check the execution history:
   - Status should be `200 OK`
   - Response should show: `{"success":true,"changesDetected":X,"totalChanges":Y,...}`

### 4. Monitor Execution

- Dashboard shows recent executions
- Green checkmark = success
- Red X = failure (check logs)
- Execution history saved for debugging

## Cron Schedule Options

Choose based on your needs:

- `*/5 * * * *` - Every 5 minutes (recommended)
- `*/10 * * * *` - Every 10 minutes
- `*/15 * * * *` - Every 15 minutes
- `*/30 * * * *` - Every 30 minutes

## Troubleshooting

### Job Returns 500 Error
- Check Cloudflare Worker logs: `wrangler tail`
- Worker may be experiencing issues
- Try manual trigger: `curl -X POST https://bitcraft-market-proxy.jbaird-cb6.workers.dev/api/monitor/trigger`

### No Changes Detected
- This is normal if market hasn't changed
- Check response: `"changesDetected": 0` is valid

### Job Timeout
- Increase timeout to 60 seconds in job settings
- Worker may be processing many items

## Verifying It's Working

1. Open [market-monitor.html](https://jbaird-cb6.github.io/bitcraftmarkethelper/market-monitor.html)
2. Check "Last Update" timestamp updates every 5 minutes
3. View change history to see detected market changes

## Alternative Services

If cron-job.org doesn't work for you:

1. **UptimeRobot** (https://uptimerobot.com)
   - Free: 5-minute intervals
   - Set up HTTP monitor with POST request

2. **EasyCron** (https://www.easycron.com)
   - Free tier available
   - 1-minute intervals supported

3. **GitHub Actions** (if you prefer code-based)
   - Create workflow with cron schedule
   - Use curl to hit trigger endpoint
