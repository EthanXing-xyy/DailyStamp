"""Local server for the web studio: static files + a tiny JSON API for the emblem library."""
from __future__ import annotations

import json
import mimetypes
import os
import posixpath
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from . import leaflet, library

ROOT = library.ROOT
WEB = os.path.join(ROOT, "web")

mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("application/json", ".json")

# this start's id: web/boot.js clears a browser's kept data the first time it sees a new one (None: `serve --keep`)
BOOT: str | None = None


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quieter
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    # ---- routing
    def translate_path(self, path: str) -> str:
        path = urllib.parse.urlsplit(path).path
        path = posixpath.normpath(urllib.parse.unquote(path))
        if path.startswith("/emblems/"):
            return os.path.join(library.EMBLEMS, path[len("/emblems/"):])
        if path.startswith("/terms/"):
            return os.path.join(ROOT, "terms", path[len("/terms/"):])
        if path.startswith("/posters/"):
            return os.path.join(ROOT, "posters", path[len("/posters/"):])
        if path.startswith("/backdrops/"):
            return os.path.join(ROOT, "backdrops", path[len("/backdrops/"):])
        if path.startswith("/exports/"):
            return os.path.join(ROOT, "exports", path[len("/exports/"):])
        if path == "/":
            path = "/index.html"
        return os.path.join(WEB, path.lstrip("/"))

    def do_GET(self):
        p = urllib.parse.urlsplit(self.path).path
        if p == "/api/emblems":
            return self._json(library.list_emblems())
        if p == "/api/leaflet":
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            return self._json(leaflet.status((q.get("phrase") or [""])[0].strip()))
        if p == "/boot.js":
            with open(os.path.join(WEB, "boot.js"), encoding="utf-8") as f:
                js = f.read()
            if BOOT:
                js = js.replace("'__BOOT__'", f"'{BOOT}'")
            data = js.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        self.send_header_no_cache = True
        return super().do_GET()

    def end_headers(self):
        # fonts (~23 MB) and vendored libs never change, and emblem/term images carry a ?v= stamp: let the browser keep
        # them, so the landing page doesn't re-download everything. Code and data stay uncached while developing.
        p = urllib.parse.urlsplit(self.path).path
        keep = (p.startswith(("/fonts/", "/vendor/")) and not p.endswith(".css")) or (p.startswith(("/emblems/", "/terms/", "/posters/", "/backdrops/")) and p.endswith(".png") and "v=" in urllib.parse.urlsplit(self.path).query)
        self.send_header("Cache-Control", "public, max-age=31536000, immutable" if keep else "no-store")
        super().end_headers()

    def do_POST(self):
        p = urllib.parse.urlsplit(self.path).path
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}")
        # the app never calls a model at runtime: emblems and leaflets are made ahead of time with the CLI
        if p == "/api/export":
            # the studio's 存入 button: the rendered PNGs (data URLs) into exports/<date>-<slug>/
            import base64, datetime as dt
            date = body.get("date") or dt.date.today().isoformat()
            phrase = body.get("phrase") or "stamp"
            folder = os.path.join(ROOT, "exports", f"{date}-{library.slug(phrase)}")
            os.makedirs(folder, exist_ok=True)
            saved = []
            for key in ("front", "back"):
                data = body.get(key)
                if data and data.startswith("data:image/png;base64,"):
                    with open(os.path.join(folder, key + ".png"), "wb") as f:
                        f.write(base64.b64decode(data.split(",", 1)[1]))
                    saved.append(key + ".png")
            meta = body.get("meta")
            if meta:
                with open(os.path.join(folder, "meta.json"), "w", encoding="utf-8") as f:
                    json.dump(meta, f, ensure_ascii=False, indent=2)
                saved.append("meta.json")
            return self._json({"folder": folder, "saved": saved})
        return self._json({"error": "not found"}, 404)

    def _json(self, obj, status: int = 200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def lan_ips() -> list[str]:
    """This machine's IPv4 addresses that other devices on the same Wi-Fi can reach."""
    import socket
    ips = []
    try:  # the address the default route goes out on (no packet is actually sent)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            ips.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip not in ips and not ip.startswith(("127.", "169.254.")):
                ips.append(ip)
    except OSError:
        pass
    return ips


def serve(port: int = 8765, open_browser: bool = True, host: str = "127.0.0.1", keep: bool = False):
    global BOOT
    import uuid
    BOOT = None if keep else uuid.uuid4().hex
    library.write_index()
    httpd = ThreadingHTTPServer((host, port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"每日一枚 -> {url}   (Ctrl+C to stop)")
    print("  浏览器里的使用记录会保留" if keep else "  这次启动后，浏览器第一次打开时会清空之前的使用记录（--keep 可保留）")
    if host in ("0.0.0.0", ""):
        for ip in lan_ips():
            print(f"  局域网 / LAN -> http://{ip}:{port}/")
    elif host != "127.0.0.1":
        print(f"  局域网 / LAN -> http://{host}:{port}/")
    if open_browser:
        import webbrowser
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
