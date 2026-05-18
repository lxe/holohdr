#!/usr/bin/env python3
"""Small development server for HoloHDR.

The production app is static. This server exists only to make local browser
testing less cache-prone while iterating on HTML, CSS, and JavaScript.
"""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


ROOT = Path(__file__).resolve().parent

CACHE_BUST_FILES = (
    ROOT / "index.html",
    ROOT / "styles.css",
    ROOT / "app.js",
    ROOT / "manifest.webmanifest",
    ROOT / "ultrahdr-worker.js",
    ROOT / "pixel-worker.js",
)

ASSET_PATHS = {
    "/app.js",
    "/styles.css",
    "/manifest.webmanifest",
    "/ultrahdr-worker.js",
    "/pixel-worker.js",
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self._redirect_stale_cache_bust():
            return

        parsed = urlparse(self.path)
        if parsed.path in ("", "/", "/index.html"):
            self._serve_index(head_only=False)
            return

        super().do_GET()

    def do_HEAD(self):
        if self._redirect_stale_cache_bust():
            return

        parsed = urlparse(self.path)
        if parsed.path in ("", "/", "/index.html"):
            self._serve_index(head_only=True)
            return

        super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _redirect_stale_cache_bust(self):
        parsed = urlparse(self.path)
        if parsed.path not in ("", "/", "/index.html", *ASSET_PATHS):
            return False

        token = cache_token()
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if query.get("v") == token:
            return False

        query["v"] = token
        location = urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", urlencode(query), ""))
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()
        return True

    def _serve_index(self, head_only):
        token = cache_token()
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        html = html.replace('./manifest.webmanifest"', f'./manifest.webmanifest?v={token}"')
        html = html.replace('./styles.css"', f'./styles.css?v={token}"')
        html = html.replace('./app.js"', f'./app.js?v={token}"')
        data = html.encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if not head_only:
            self.wfile.write(data)


def cache_token():
    mtimes = []
    for path in CACHE_BUST_FILES:
        try:
            mtimes.append(path.stat().st_mtime_ns)
        except FileNotFoundError:
            pass
    return str(max(mtimes) if mtimes else 0)


def main():
    parser = argparse.ArgumentParser(description="Serve HoloHDR locally for development.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving HoloHDR on http://{args.host}:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
