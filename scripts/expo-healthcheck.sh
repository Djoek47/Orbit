#!/usr/bin/env bash
# Exit 0 when Expo packager + public tunnel edge are healthy.
# Usage:
#   bash scripts/expo-healthcheck.sh           # quiet, exit code only
#   bash scripts/expo-healthcheck.sh --verbose
#   bash scripts/expo-healthcheck.sh --json
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${EXPO_PERSISTENT_LOG_DIR:-/tmp/orbit-expo}"
URL_FILE="$LOG_DIR/tunnel-url.txt"
STATUS_FILE="$LOG_DIR/status.txt"
PORT_FILE="$LOG_DIR/metro-port.txt"
VERBOSE=0
JSON=0

for arg in "$@"; do
  case "$arg" in
    --verbose|-v) VERBOSE=1 ;;
    --json) JSON=1 ;;
  esac
done

say() {
  if [[ "$VERBOSE" -eq 1 && "$JSON" -eq 0 ]]; then
    printf '%s\n' "$*"
  fi
}

metro_port="${EXPO_METRO_PORT:-}"
if [[ -z "$metro_port" && -f "$PORT_FILE" ]]; then
  metro_port="$(tr -d '[:space:]' <"$PORT_FILE")"
fi
metro_port="${metro_port:-8081}"

packager_code=000
public_code=000
url=""
host=""
packager_ok=0
public_ok=0
reason="unknown"

if curl -fsS --max-time 2 "http://127.0.0.1:${metro_port}/status" 2>/dev/null | grep -q 'packager-status:running'; then
  packager_ok=1
  packager_code=200
  say "packager: ok (port $metro_port)"
else
  packager_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${metro_port}/status" 2>/dev/null || echo 000)"
  reason="packager_down"
  say "packager: down (HTTP $packager_code, port $metro_port)"
fi

if [[ -f "$URL_FILE" ]]; then
  url="$(tr -d '[:space:]' <"$URL_FILE")"
fi
if [[ -z "$url" ]] && [[ -f "$LOG_DIR/persistent.log" ]]; then
  url="$(rg -o 'exp://[A-Za-z0-9._:-]+\.exp\.direct' "$LOG_DIR/persistent.log" 2>/dev/null | tail -1 || true)"
fi
# Prefer live ngrok inspector URL when available.
if command -v python3 >/dev/null 2>&1; then
  live="$(
    python3 - <<'PY' 2>/dev/null
import json, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as res:
        data = json.load(res)
    for tunnel in data.get("tunnels", []):
        u = tunnel.get("public_url") or ""
        if "exp.direct" in u:
            print("exp://" + u.split("://", 1)[-1])
            break
except Exception:
    pass
PY
  )"
  if [[ -n "$live" ]]; then
    url="$live"
  fi
fi

if [[ -n "$url" ]]; then
  host="${url#exp://}"
  host="${host%%:*}"
  body="$(mktemp)"
  public_code="$(curl -sS -o "$body" -w '%{http_code}' --max-time 10 "https://${host}/status" 2>/dev/null || echo 000)"
  if [[ "$public_code" == "200" ]] && grep -q 'packager-status:running' "$body"; then
    public_ok=1
    say "public: ok ($url)"
  else
    if grep -q 'ERR_NGROK_3200\|endpoint .* is offline' "$body" 2>/dev/null; then
      reason="ngrok_3200_offline"
      say "public: ERR_NGROK_3200 offline ($url)"
    else
      reason="public_unreachable"
      say "public: fail HTTP $public_code ($url)"
    fi
  fi
  rm -f "$body"
else
  reason="no_tunnel_url"
  say "public: no tunnel URL"
fi

if [[ "$packager_ok" -eq 1 && "$public_ok" -eq 1 ]]; then
  reason="healthy"
  # Stamp last success for supervisors.
  mkdir -p "$LOG_DIR"
  printf '%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >"$LOG_DIR/last-public-ok.txt"
  if [[ -n "$url" ]]; then
    printf '%s\n' "$url" >"$URL_FILE"
  fi
fi

if [[ "$JSON" -eq 1 ]]; then
  python3 - <<PY
import json
print(json.dumps({
  "ok": bool($packager_ok and $public_ok),
  "packagerOk": bool($packager_ok),
  "publicOk": bool($public_ok),
  "packagerCode": "$packager_code",
  "publicCode": "$public_code",
  "url": "$url",
  "reason": "$reason",
  "statusFile": """$(tr '\n' ' ' <"$STATUS_FILE" 2>/dev/null || true)""".strip(),
}))
PY
fi

if [[ "$packager_ok" -eq 1 && "$public_ok" -eq 1 ]]; then
  exit 0
fi
exit 1
