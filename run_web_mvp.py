"""
Runner script for DeepHalo / Suite ADLMS Web MVP.
Starts a local HTTP server and automatically opens the application in the default web browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

PORT = 8000
WEB_DIR = Path(__file__).resolve().parent / "mvp_web"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, format, *args):
        # Keep console output clean
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run():
    os.chdir(str(WEB_DIR))
    url = f"http://localhost:{PORT}/index.html"
    
    print("=" * 65)
    print("  DeepHalo / Suite ADLMS - Clinical Microbiology AST Web MVP")
    print("=" * 65)
    print(f" Serving directory : {WEB_DIR}")
    print(f" Local URL          : {url}")
    print(" Press Ctrl+C to terminate the local server.")
    print("=" * 65)
    
    # Auto-open browser
    webbrowser.open(url)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down DeepHalo Web Server. Goodbye!")
            httpd.server_close()

if __name__ == "__main__":
    run()
