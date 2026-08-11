"""Local static server with correct MIME types for ES modules."""
from __future__ import annotations

import mimetypes
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Windows often maps .js → text/plain, which blocks <script type="module">
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/wasm", ".wasm")


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"LieLine server: http://127.0.0.1:{port}")
    print("Phone (same Wi-Fi): http://<PC-IP>:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")


if __name__ == "__main__":
    main()
