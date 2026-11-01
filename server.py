#!/usr/bin/env python3
"""Local static server for Hover Derby 4.

Binds 127.0.0.1, prefers the port in arcade.json, and steps to the next free
port if that one is taken. Opens the default browser unless --no-browser is
set or HOVER_NO_BROWSER=1.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
FALLBACK_PORT = 8802


def default_port() -> int:
    path = os.path.join(ROOT, "arcade.json")
    try:
        with open(path, encoding="utf-8") as handle:
            port = int(json.load(handle)["port"])
    except (OSError, ValueError, KeyError, TypeError):
        return FALLBACK_PORT
    if port < 1 or port > 65535:
        return FALLBACK_PORT
    return port


def find_port(start: int, host: str = HOST) -> int:
    for port in range(start, min(start + 50, 65536)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise SystemExit(f"No free port found near {start} on {host}.")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("hoverderby4: " + (fmt % args) + "\n")


def serve(port: int | None = None, open_browser: bool = True) -> None:
    requested = default_port() if port is None else port
    chosen = find_port(requested)
    if chosen != requested:
        print(f"Port {requested} is busy. Hover Derby 4 is using {chosen}.", flush=True)
    httpd = ThreadingHTTPServer((HOST, chosen), Handler)
    url = f"http://{HOST}:{chosen}/"
    print(f"Hover Derby 4 running at {url}", flush=True)
    print("Close this window to stop the server.", flush=True)
    if open_browser:
        threading.Timer(0.35, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        httpd.server_close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Serve Hover Derby 4 locally.")
    parser.add_argument("--port", type=int, default=None, help="Preferred port (default: arcade.json)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser window")
    args = parser.parse_args(argv)
    if args.port is not None and not (1 <= args.port <= 65535):
        raise SystemExit("--port must be between 1 and 65535")
    skip = args.no_browser or os.environ.get("HOVER_NO_BROWSER") == "1"
    serve(args.port, open_browser=not skip)


if __name__ == "__main__":
    main()
