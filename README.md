# 🎮 Bitcraft Market Helper

A lightweight web application for browsing Bitcraft market data with real-time API integration.

## 🚀 Quick Start (Windows 11)

### Method 1: Double-Click Start (Easiest)
1. **Double-click `start-server.bat`**
2. The application will automatically open in your browser
3. Keep the command window open while using the app
4. Press `Ctrl+C` in the command window when done

### Method 2: Manual Python Server (Recommended)
If you have Python installed:
1. Open Command Prompt or PowerShell in this folder
2. Run: `python proxy-server.py`
3. Open browser to: http://localhost:8000

**Note**: The proxy server is required to bypass CORS restrictions from the Bitjita API.

## 📋 Features

- **Item Search**: Typeahead search with up to 10 results
- **Tier Filtering**: Filter items by tier (default: All Tiers)
- **Market Statistics**: View lowest sell, highest buy, and recent order counts
- **Buy/Sell Orders**: Two-column layout for easy comparison
- **Region Filtering**: Default to Solvenar (Region 4), toggle for all regions
- **Copy to Clipboard**: Click 📋 icons to copy any price

## 🔧 Requirements

- **Browser**: Any modern browser (Chrome, Firefox, Edge)
- **Web Server**: Python OR Node.js (for running locally)
  - Python: https://www.python.org/downloads/
  - Node.js: https://nodejs.org/

## 🐛 Troubleshooting

### "Failed to load items.json"
This happens when opening `index.html` directly without a web server.
**Solution**: Use the `start-server.bat` or run `python proxy-server.py`.

### CORS Error / API requests failing
The Bitjita API doesn't allow direct browser requests due to CORS restrictions.
**Solution**: You MUST use the proxy server (`proxy-server.py`) instead of a basic HTTP server. The `start-server.bat` file automatically uses the correct server.

### Batch file doesn't work
Make sure you have Python installed on your system.
**Download**: https://www.python.org/downloads/

### Port already in use
If port 8000 is already in use, you can edit `proxy-server.py` and change the port number in the last line:
```python
run_server(8001)  # Change 8000 to 8001 or any available port
```

## 📖 Usage

1. Start the web server using any method above
2. Type an item name in the search box
3. (Optional) Select a specific tier from the dropdown
4. Click on an item from the typeahead results
5. View market statistics and orders
6. Click 📋 icons next to prices to copy to clipboard
7. Toggle "Show all regions" to see orders from all regions

## 💡 Tips

- Results are sorted by tier (ascending) in the typeahead
- Default region filter is Solvenar (Region 4)
- All prices can be copied with a single click
- The application automatically updates when you change filters

---

Built with vanilla HTML, CSS, and JavaScript for maximum simplicity and performance.
