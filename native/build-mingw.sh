#!/usr/bin/env bash
# Cross-build Windows DLL (e.g. macOS Homebrew: brew install mingw-w64)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MINGW_BIN="${MINGW_BIN:-}"
if [[ -z "${MINGW_BIN}" ]]; then
  for d in /opt/homebrew/opt/mingw-w64/bin /usr/local/opt/mingw-w64/bin; do
    if [[ -x "$d/x86_64-w64-mingw32-gcc" ]]; then
      MINGW_BIN="$d"
      break
    fi
  done
fi
if [[ -z "${MINGW_BIN}" ]]; then
  echo "Set MINGW_BIN to the directory containing x86_64-w64-mingw32-gcc" >&2
  exit 1
fi
CC="${MINGW_BIN}/x86_64-w64-mingw32-gcc"
OUT="${ROOT}/native/EzflplnBridge.dll"
"${CC}" -shared -O2 -o "${OUT}" "${ROOT}/native/src/EzflplnBridge.c"
echo "Built: ${OUT}"
file "${OUT}" || true
