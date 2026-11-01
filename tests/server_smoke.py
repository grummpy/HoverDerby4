#!/usr/bin/env python3
"""Headless check that server.py serves the game."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def fetch(url: str) -> tuple[int, bytes]:
    with urllib.request.urlopen(url, timeout=2) as response:
        return response.status, response.read()


def main() -> None:
    port = free_port()
    env = os.environ.copy()
    env["HOVER_NO_BROWSER"] = "1"
    proc = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "server.py"), "--no-browser", "--port", str(port)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    log: list[str] = []

    def drain() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            log.append(line)

    threading.Thread(target=drain, daemon=True).start()
    try:
        index = None
        last_error: Exception | None = None
        for _ in range(50):
            if proc.poll() is not None:
                raise SystemExit("server exited early:\n" + "".join(log))
            try:
                index = fetch(f"http://127.0.0.1:{port}/index.html")
                break
            except Exception as error:  # noqa: BLE001 - retry until the socket accepts
                last_error = error
                time.sleep(0.1)
        else:
            raise SystemExit(f"index.html was not served: {last_error}\n" + "".join(log))

        status, body = index
        text = body.decode("utf-8")
        if status != 200:
            raise SystemExit(f"index.html status {status}")
        if "<canvas" not in text or "Hover Derby 4" not in text:
            raise SystemExit("index.html did not look like the game")

        for path in ("/src/ui/main.js", "/src/core/sim.js", "/arcade.json"):
            code, payload = fetch(f"http://127.0.0.1:{port}{path}")
            if code != 200 or len(payload) < 20:
                raise SystemExit(f"{path} was not served ({code}, {len(payload)} bytes)")
        manifest = fetch(f"http://127.0.0.1:{port}/arcade.json")[1].decode("utf-8")
        if "hoverderby4" not in manifest:
            raise SystemExit("arcade.json payload was unexpected")

        code, cover = fetch(f"http://127.0.0.1:{port}/assets/cover.jpg")
        if code != 200 or len(cover) < 1000:
            raise SystemExit("cover art was not served")
        print(f"smoke ok on port {port}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)


if __name__ == "__main__":
    main()
