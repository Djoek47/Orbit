#!/usr/bin/env bash
# Keep Expo Go tunnel up across ngrok drops / Metro exits.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="${EXPO_PERSISTENT_LOG_DIR:-/tmp/orbit-expo}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/persistent.log"
URL_FILE="$LOG_DIR/tunnel-url.txt"
PID_FILE="$LOG_DIR/expo.pid"

BACKOFF_SECS="${EXPO_RESTART_BACKOFF_SECS:-4}"
MAX_BACKOFF_SECS="${EXPO_RESTART_MAX_BACKOFF_SECS:-60}"
backoff="$BACKOFF_SECS"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE"
}

extract_url() {
  # 1) ngrok local inspector (most reliable in this environment)
  if command -v python3 >/dev/null 2>&1; then
    local from_ngrok
    from_ngrok="$(
      python3 - <<'PY' 2>/dev/null
import json, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as res:
        data = json.load(res)
    for tunnel in data.get("tunnels", []):
        url = tunnel.get("public_url") or ""
        if "exp.direct" in url:
            host = url.split("://", 1)[-1]
            print(f"exp://{host}")
            break
except Exception:
    pass
PY
    )"
    if [[ -n "$from_ngrok" ]]; then
      printf '%s\n' "$from_ngrok"
      return 0
    fi
  fi

  # 2) Latest Metro tunnel line from logs
  if [[ -f "$LOG_FILE" ]]; then
    rg -o 'exp://[A-Za-z0-9._:-]+' "$LOG_FILE" 2>/dev/null | tail -1 || true
  fi
}

write_qr_if_possible() {
  local url="$1"
  [[ -z "$url" ]] && return 0
  printf '%s\n' "$url" >"$URL_FILE"
  if command -v node >/dev/null 2>&1; then
    node "$ROOT/scripts/write-expo-qr.mjs" "$url" /opt/cursor/artifacts/expo-go-qr.png \
      >>"$LOG_FILE" 2>&1 || true
  fi
}

cleanup_stale() {
  # Avoid duplicate Metro on the same port. Never use broad pkill -f patterns
  # (they can match parent shells that merely mention expo in argv).
  if [[ -f "$PID_FILE" ]]; then
    local old
    old="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
      log "Stopping previous Expo pid $old"
      kill "$old" 2>/dev/null || true
      sleep 1
      kill -9 "$old" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  ps -eo pid=,cmd= | while IFS= read -r line; do
    local pid=${line%% *}
    local cmd=${line#* }
    case "$cmd" in
      *"/node_modules/.bin/expo start"*|*"ngrok-bin-linux-x64/ngrok"*)
        kill "$pid" 2>/dev/null || true
        ;;
    esac
  done
  sleep 1
}

trap 'log "Watchdog stopping"; cleanup_stale; exit 0' INT TERM

log "Persistent Expo watchdog starting in $ROOT"

while true; do
  cleanup_stale
  log "Starting Expo tunnel (backoff=${backoff}s on next failure)"

  # --go keeps Expo Go mode; no --clear so restarts stay fast.
  # Do NOT set CI=1 — that disables Metro reloads and hides the exp:// URL.
  (
    export EXPO_NO_TELEMETRY=1
    # Non-interactive stdin so Expo does not wait on keypress menus in tmux.
    npx expo start --tunnel --go </dev/null
  ) >>"$LOG_FILE" 2>&1 &
  expo_pid=$!
  echo "$expo_pid" >"$PID_FILE"
  log "Expo pid $expo_pid"

  # Wait briefly for tunnel URL, then keep watching the process.
  url_noted=0
  while kill -0 "$expo_pid" 2>/dev/null; do
    if [[ "$url_noted" -eq 0 ]]; then
      url="$(extract_url)"
      if [[ -n "$url" ]]; then
        write_qr_if_possible "$url"
        log "Tunnel ready: $url"
        backoff="$BACKOFF_SECS"
        url_noted=1
      fi
    fi
    # Also accept a healthy localhost packager even before URL scrape succeeds.
    if [[ "$url_noted" -eq 0 ]] && curl -fsS --max-time 2 "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
      # Expo often reuses the same ngrok subdomain in this environment.
      if [[ -f "$URL_FILE" ]]; then
        write_qr_if_possible "$(cat "$URL_FILE")"
        log "Packager up; using prior tunnel URL $(cat "$URL_FILE")"
        url_noted=1
        backoff="$BACKOFF_SECS"
      fi
    fi
    sleep 8
  done

  wait "$expo_pid" || true
  exit_code=$?
  rm -f "$PID_FILE"
  log "Expo exited (code=$exit_code). Restarting in ${backoff}s…"
  sleep "$backoff"
  if (( backoff < MAX_BACKOFF_SECS )); then
    backoff=$((backoff * 2))
    if (( backoff > MAX_BACKOFF_SECS )); then
      backoff=$MAX_BACKOFF_SECS
    fi
  fi
done
