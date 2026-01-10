#!/usr/bin/env python3
"""
Simple CORS proxy server for Bitcraft Market Helper
This server forwards API requests to bitjita.com and adds CORS headers
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.error
import json
import os

class CORSProxyHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Check if this is an API request
        if self.path.startswith('/api/market/item/'):
            try:
                # Extract item ID from path
                item_id = self.path.replace('/api/market/item/', '')

                # Fetch data from bitjita.com
                api_url = f'https://bitjita.com/api/market/item/{item_id}'
                print(f'Fetching: {api_url}')

                with urllib.request.urlopen(api_url) as response:
                    data = response.read()

                # Send successful response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)

            except urllib.error.HTTPError as e:
                # Handle HTTP errors from the API
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_msg = json.dumps({'error': f'API returned status {e.code}'})
                self.wfile.write(error_msg.encode())

            except Exception as e:
                # Handle other errors
                print(f'Error: {str(e)}')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_msg = json.dumps({'error': str(e)})
                self.wfile.write(error_msg.encode())
        else:
            # Serve static files (HTML, JSON, etc.)
            super().do_GET()

    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.log_date_time_string()}] {format % args}")

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSProxyHandler)

    print(f"""
╔══════════════════════════════════════════════════════════╗
║     🎮 Bitcraft Market Helper - Proxy Server Running     ║
╚══════════════════════════════════════════════════════════╝

📡 Server Address: http://localhost:{port}
🌐 Open in browser: http://localhost:{port}

✅ CORS proxy is active - API requests will work!
❌ Press Ctrl+C to stop the server

Waiting for connections...
""")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
        httpd.shutdown()

if __name__ == '__main__':
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    run_server(8000)
