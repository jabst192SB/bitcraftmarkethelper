# Cloudflare Worker Setup Guide

This guide will help you deploy the CORS proxy to Cloudflare Workers so your GitHub Pages site can make API calls to bitjita.com.

## Prerequisites

- A Cloudflare account (free tier is fine - no credit card required)
- Node.js installed on your computer (for deployment)

## Step-by-Step Deployment

### Option 1: Quick Deploy via Dashboard (Easiest - 5 minutes)

1. **Create a Cloudflare Account**
   - Go to https://dash.cloudflare.com/sign-up
   - Sign up for a free account (no credit card needed)
   - Verify your email

2. **Create a New Worker**
   - Go to https://dash.cloudflare.com/
   - Click "Workers & Pages" in the left sidebar
   - Click "Create Application"
   - Click "Create Worker"
   - Give it a name like `bitcraft-market-proxy`
   - Click "Deploy"

3. **Replace the Worker Code**
   - After deployment, click "Edit Code"
   - Delete all the existing code in the editor
   - Copy the entire contents of `cloudflare-worker.js` from this repository
   - Paste it into the worker editor
   - Click "Save and Deploy"

4. **Copy Your Worker URL**
   - You'll see a URL like: `https://bitcraft-market-proxy.YOUR_SUBDOMAIN.workers.dev`
   - For this project, the URL is: `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`
   - Copy this URL - you'll need it in the next step

5. **Update Your HTML Files**
   - Open `index.html` in a text editor
   - Find the line near the top that says: `const API_BASE_URL = '';`
   - Replace it with: `const API_BASE_URL = 'https://bitcraft-market-proxy.jbaird-cb6.workers.dev';`
   - Do the same for `gear-finder.html` and `market-monitor.html`
   - Save all files

   **Note:** For this repository, the API_BASE_URL is already configured to `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`

6. **Commit and Push to GitHub**
   ```bash
   git add index.html gear-finder.html
   git commit -m "Configure Cloudflare Worker API proxy"
   git push
   ```

7. **Test Your GitHub Pages Site**
   - Visit your GitHub Pages URL
   - Try searching for an item
   - It should now work without 405 errors!

---

### Option 2: Deploy via CLI (For Developers)

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```
   This will open a browser window to authorize the CLI.

3. **Deploy the Worker**
   ```bash
   cd /path/to/bitcraftmarkethelper
   wrangler deploy
   ```

4. **Get Your Worker URL**
   After deployment, Wrangler will show your worker URL:
   ```
   Published bitcraft-market-proxy (X.XX sec)
   https://bitcraft-market-proxy.jbaird-cb6.workers.dev
   ```

5. **Update HTML Files**
   - Follow step 5 from Option 1 above
   - Update `index.html`, `gear-finder.html`, and `market-monitor.html` with your worker URL

   **Note:** For this repository, the worker URL is already configured as `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`

6. **Deploy to GitHub Pages**
   - Commit and push your changes
   - Your site should now work!

---

## Verification

After setup, verify everything works:

1. Open browser Developer Tools (F12)
2. Go to the Network tab
3. Visit your GitHub Pages site
4. Search for an item
5. Check the network requests - they should go to your Cloudflare Worker URL
6. Status should be 200 (not 405)

## Troubleshooting

### Getting 405 Errors Still?
- Make sure you updated the `API_BASE_URL` in ALL HTML files (`index.html`, `gear-finder.html`, and `market-monitor.html`)
- The configured URL should be: `https://bitcraft-market-proxy.jbaird-cb6.workers.dev`
- Make sure you saved and pushed the changes to GitHub
- Wait a few minutes for GitHub Pages to rebuild (check the Actions tab)

### Worker Not Responding?
- Check the worker is deployed: Go to Workers & Pages in Cloudflare dashboard
- Check the worker code is correct: Click "Edit Code" and verify it matches `cloudflare-worker.js`
- Check the worker logs: Click on your worker, go to "Logs" tab (Real-time Logs)

### Still Having Issues?
- Check browser console for errors (F12 → Console tab)
- Check Cloudflare Worker logs for errors
- Make sure the worker URL doesn't have a trailing slash

## Cost

**Cloudflare Workers Free Tier:**
- ✅ 100,000 requests per day
- ✅ No credit card required
- ✅ No time limit
- ✅ More than enough for personal use

Your market helper app will likely use less than 1,000 requests per day, so you're well within the free tier limits.

## Updating the Worker

If you need to update the worker code later:

**Via Dashboard:**
1. Go to Workers & Pages
2. Click your worker name
3. Click "Edit Code"
4. Make changes
5. Click "Save and Deploy"

**Via CLI:**
```bash
wrangler deploy
```

## Security Notes

- The worker allows CORS from any origin (`*`) - this is safe for a public read-only API proxy
- If you want to restrict access to only your GitHub Pages site, change the `Access-Control-Allow-Origin` header in the worker code to your specific domain
- The worker doesn't store any data or credentials

## Next Steps

Once deployed:
1. ✅ Your GitHub Pages site will work properly
2. ✅ No more 405 errors
3. ✅ Fast API responses (Cloudflare's edge network)
4. ✅ Global CDN for better performance

Enjoy your working Bitcraft Market Helper! 🎉
