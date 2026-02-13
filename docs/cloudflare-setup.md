# Cloudflare Worker Setup Guide

The Cloudflare Worker provides a CORS proxy so GitHub Pages can make API calls to bitjita.com. It does not store any data.

## Prerequisites

- Cloudflare account (free tier, no credit card required)
- Node.js installed (for CLI deployment)

## Option 1: Quick Deploy via Dashboard

1. **Create a Cloudflare Account** at https://dash.cloudflare.com/sign-up

2. **Create a New Worker**
   - Go to Workers & Pages > Create Application > Create Worker
   - Name it `bitcraft-market-proxy`
   - Click Deploy

3. **Replace the Worker Code**
   - Click "Edit Code"
   - Delete all existing code
   - Paste the contents of `cloudflare-worker.js`
   - Click "Save and Deploy"

4. **Copy Your Worker URL**
   - Format: `https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev`
   - This project uses: `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`

5. **Update HTML Files**
   - In `index.html`, `gear-finder.html`, and `market-monitor.html`:
   ```javascript
   const API_BASE_URL = 'https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev';
   ```

6. **Push to GitHub**
   ```bash
   git add index.html gear-finder.html market-monitor.html
   git commit -m "Configure Cloudflare Worker API proxy"
   git push
   ```

## Option 2: Deploy via CLI

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Wrangler will display your worker URL after deployment.

## Verification

1. Open browser Developer Tools (F12) > Network tab
2. Visit your GitHub Pages site and search for an item
3. Requests should go to your Worker URL with status 200

## Updating the Worker

**Via Dashboard**: Workers & Pages > your worker > Edit Code > Save and Deploy

**Via CLI**:
```bash
wrangler deploy
```

## Troubleshooting

### 405 Errors
- Verify `API_BASE_URL` is set in ALL HTML files
- Ensure changes are pushed to GitHub
- Wait for GitHub Pages to rebuild

### Worker Not Responding
- Check Workers & Pages in Cloudflare dashboard
- Verify the code matches `cloudflare-worker.js`
- Check worker logs

## Cost

| Feature | Free Tier |
|---------|-----------|
| Requests/day | 100,000 |
| Monthly Cost | $0 |
| Credit Card | Not required |

Typical usage is well under 1,000 requests/day.

## Security

- CORS allows all origins (`*`) - safe for a read-only API proxy
- To restrict to your domain, change `Access-Control-Allow-Origin` in the worker code
- The worker stores no data or credentials
