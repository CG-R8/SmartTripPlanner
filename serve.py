#!/usr/bin/env python3
"""
Simple local HTTP server for ChetanSmartTrip PWA.

Run this on your laptop, then open the URL on your Samsung S23
(must be on the same WiFi network).

Usage:
    python3 serve.py

Then open in Chrome on your phone:
    http://<your-laptop-ip>:8080/app/
"""

import http.server
import socketserver
import os
import socket
import signal
import subprocess
import sys

PORT = 8080


def kill_existing_on_port(port):
    """Kill any process already listening on the given port."""
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True
        )
        pids = result.stdout.strip()
        if pids:
            for pid in pids.splitlines():
                pid = pid.strip()
                if pid:
                    print(f"⚠️  Port {port} in use by PID {pid} — killing it...")
                    os.kill(int(pid), signal.SIGKILL)
            # Brief pause to let the OS release the port
            import time
            time.sleep(0.5)
            print(f"✅ Port {port} is now free.")
        else:
            print(f"✅ Port {port} is available.")
    except Exception as e:
        print(f"⚠️  Could not check/kill port {port}: {e}")

def get_local_ip():
    """Get the local IP address for network access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler with CORS and correct MIME types."""

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webmanifest': 'application/manifest+json',
    }

if __name__ == '__main__':
    # Change to project root directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Free up the port if something is already running on it
    kill_existing_on_port(PORT)

    local_ip = get_local_ip()

    print(f"""
╔══════════════════════════════════════════════════════╗
║         🗺️  ChetanSmartTrip — Local Server          ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  Local:   http://localhost:{PORT}/app/                ║
║  Network: http://{local_ip}:{PORT}/app/       ║
║                                                      ║
║  📱 Open the Network URL on your Samsung S23         ║
║     (must be on same WiFi)                           ║
║                                                      ║
║  To install as PWA:                                  ║
║  1. Open URL in Chrome on phone                      ║
║  2. Tap ⋮ menu → "Add to Home Screen"               ║
║  3. App is now installable & works offline!          ║
║                                                      ║
║  Press Ctrl+C to stop                                ║
╚══════════════════════════════════════════════════════╝
""")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CORSHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped.")
            httpd.shutdown()
