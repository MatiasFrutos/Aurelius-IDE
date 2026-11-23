#!/usr/bin/env bash
# Ejecuta las pruebas en la app REAL (Tauri + WebKitGTK) con un display virtual.
# Requisitos (Debian/Ubuntu): xvfb xdotool webkit2gtk-driver · cargo install tauri-driver --locked · npm i selenium-webdriver (en esta carpeta)
# Uso: ./scripts/e2e-real/run.sh [terminal|editor]   (sin argumento: ambas)
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
export DISPLAY="${DISPLAY:-:99}"

[ -x "$ROOT/src-tauri/target/debug/aurelius-ide" ] || (cd "$ROOT/src-tauri" && cargo build)
[ -d node_modules/selenium-webdriver ] || (echo "{}" > package.json 2>/dev/null; npm i --no-save selenium-webdriver >/dev/null)

pgrep Xvfb >/dev/null || (Xvfb "$DISPLAY" -screen 0 1440x900x24 >/dev/null 2>&1 &)
curl -sf http://127.0.0.1:1420 >/dev/null || (cd "$ROOT" && npx vite --host 127.0.0.1 --port 1420 >/tmp/vite-real.log 2>&1 &)
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:1420 >/dev/null && break; sleep 1; done

status=0
for t in ${1:-terminal editor mouse}; do
  pkill -f tauri-driver || true; pkill -f WebKitWebDriver || true; pkill -f target/debug/aurelius-ide || true; sleep 1
  (tauri-driver >/tmp/tauri-driver.log 2>&1 &)
  sleep 2
  echo "== $t"
  timeout 240 node "$t.cjs" || status=1
done
pkill -f tauri-driver || true; pkill -f WebKitWebDriver || true; pkill -f target/debug/aurelius-ide || true
exit $status
