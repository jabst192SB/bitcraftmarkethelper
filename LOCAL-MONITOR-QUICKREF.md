# Local Monitor - Quick Reference

## 🚀 Two Simple Commands

### 1. Initial Setup (Run Once)
```bash
node local-monitor.js setup
```
- Fetches ALL 2964 items (~15-20 minutes)
- Automatically uploads to website
- One-and-done solution

### 2. Continuous Monitoring (Run Always)
```bash
node local-monitor.js monitor
```
- Checks for changes every 2 minutes
- Auto-syncs to website
- Keep it running in the background

## 📊 What Each Mode Does

| Command | What It Does | When To Use |
|---------|--------------|-------------|
| `setup` | Fetch ALL items + upload | **First time only** |
| `monitor` | Auto-check + auto-sync | **Keep running 24/7** |
| `sync` | Manual upload to website | If sync fails |
| `debug <claim>` | Show orders for a claim | Verify your orders |

## 💡 Typical Workflow

**Day 1 - Initial Setup:**
```bash
# Run once to build complete cache
node local-monitor.js setup

# Verify your orders are found
node local-monitor.js debug "Get Off My Lawn"
```

**Day 2+ - Ongoing Monitoring:**
```bash
# Run in background, keeps website updated
node local-monitor.js monitor
```

That's it! The monitor will keep your website updated automatically.

## 🔧 Advanced Options

### Monitor Intervals
```bash
node local-monitor.js monitor      # Every 2 minutes (default)
node local-monitor.js monitor 60   # Every 1 minute
node local-monitor.js monitor 300  # Every 5 minutes
```

### Manual Updates
```bash
# Update local cache only (no sync)
node local-monitor.js update-bulk 100

# Manually sync to website
node local-monitor.js sync
```

### Debugging
```bash
# Show current state
node local-monitor.js state

# Show recent changes
node local-monitor.js changes 50

# Debug specific claim
node local-monitor.js debug "Your Claim Name"
```

## ✅ Quick Checks

**Is it working?**
```bash
# Check local cache
node check-progress.js

# Check your orders
node local-monitor.js debug "Get Off My Lawn"
```

**Website showing data?**
Visit: https://jbaird-bitcraftmarkethelper.pages.dev/market-monitor.html

## 🆘 Troubleshooting

**Orders not showing locally:**
- Run `node local-monitor.js setup` again
- It only fetches missing items, so it's safe to re-run

**Orders showing locally but not on website:**
- Run `node local-monitor.js sync`
- Check Cloudflare Worker logs: `wrangler tail`

**Monitor stopped:**
- Just restart it: `node local-monitor.js monitor`
- It will resume from where it left off

## 📝 All Commands

```bash
node local-monitor.js setup              # Initial: Fetch all + sync
node local-monitor.js monitor [interval] # Continuous: Check + sync
node local-monitor.js sync               # Manual: Upload to website
node local-monitor.js debug <claim>      # Show orders for claim
node local-monitor.js state              # Show cache status
node local-monitor.js changes [limit]    # Show recent changes
node local-monitor.js reset              # Clear all data
node local-monitor.js help               # Show all options
```

## 🎯 Recommended Setup

1. **First time**: `node local-monitor.js setup` (wait 15-20 min)
2. **Always running**: `node local-monitor.js monitor` (keep in background)

Done! Your website will always have current market data.
