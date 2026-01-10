# 🎮 Bitcraft Market Helper

A lightweight web application for browsing Bitcraft market data with real-time API integration.

## 🚀 Quick Start (Windows 11)

### Method 1: Double-Click Start (Easiest)
1. **Double-click `start-server.bat`**
2. The application will automatically open in your browser
3. Keep the command window open while using the app
4. Press `Ctrl+C` in the command window when done

### Method 2: Manual Python Server
If you have Python installed:
1. Open Command Prompt or PowerShell in this folder
2. Run: `python -m http.server 8000`
3. Open browser to: http://localhost:8000

### Method 3: Manual Node.js Server
If you have Node.js installed:
1. Open Command Prompt or PowerShell in this folder
2. Run: `npx http-server -p 8080`
3. Open browser to: http://localhost:8080

### Method 4: Use VSCode Live Server
If you have Visual Studio Code:
1. Install the "Live Server" extension
2. Right-click `index.html` and select "Open with Live Server"

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
**Solution**: Use one of the methods above to start a local web server.

### Batch file doesn't work
Make sure you have either Python or Node.js installed on your system.

### Port already in use
If port 8000 or 8080 is already in use, change the port number in the command:
- Python: `python -m http.server 8001`
- Node.js: `npx http-server -p 8081`

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
