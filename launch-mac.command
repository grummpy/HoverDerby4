#!/usr/bin/env bash
# One-click launcher for Hover Derby 4 on macOS. Double-click in Finder.
cd "$(dirname "$0")" || exit 1

echo "Hover Derby 4"

PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
fi

if [ -z "$PY" ]; then
  echo "Python 3 is required to launch Hover Derby 4."
  echo "Install it from https://www.python.org/downloads/ and run this launcher again."
  if [ -t 0 ]; then
    printf "Press Enter to close."
    read -r _
  fi
  exit 1
fi

echo "Starting local server. Close this window to stop."
exec "$PY" server.py
