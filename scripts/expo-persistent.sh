#!/usr/bin/env bash
# Keep Expo Go tunnel up across ngrok drops, agent reconnects, and Metro exits.
# Safe to re-run: a second instance exits without killing a healthy packager.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="${EXPO_PERSISTENT_LOG_DIR:-/tmp/orbit-expo}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/persistent.log"
URL_FILE="$LOG_DIR/tunnel-url.txt"
PID_FILE="$LOG_DIR/expo.pid"
WATCHDOG_PID_FILE="$LOG_DIR/watchdog.pid"
LOCK_FILE="$LOG_DIR/watchdog.lock"
STATUS_FILE="$LOG_DIR/status.txt"

BACKOFF_SECS="${EXPO_RESTART_BACKOFF_SECS:-4}"
MAX_BACKOFF_SECS="${EXPO_RESTART_MAX_BACKOFF_SECS:-60}"
TUNNEL_FAIL_LIMIT="${EXPO_TUNNEL_FAIL_LIMIT:-3}"
backoff="$BACKOFF_SECS"

# Survive agent shell hangups / closed stdin. Do not kill Expo on our own exit.
trap '' HUP
trap 'log "Watchdog detaching (Expo left running)"; write_status "detached"; exit 0' INT TERM

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE"
}

write_status() {
  printf 'state=%s\nupdated=%s\nexpo_pid=%s\nurl=%s\n' \
    "${1:-unknown}" \
    "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    "$(cat "$PID_FILE" 2>/dev/null || echo '')" \
    "$(cat "$URL_FILE" 2>/dev/null || echo '')" >"$STATUS_FILE"
}

packager_up() {
  curl -fsS --max-time 2 "http://127.0.0.1:8081/status" 2>/dev/null | grep -q 'packager-status:running'
}

tunnel_up() {
  if ! command -v python3 >/dev/null 2>&1; then
    return 1
  fi
  python3 - <<'PY' 2>/dev/null
import json, urllib.request, sys
try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as res:
        data = json.load(res)
    for tunnel in data.get("tunnels", []):
        url = tunnel.get("public_url") or ""
        if "exp.direct" in url or "ngrok" in url:
            sys.exit(0)
    sys.exit(1)
except Exception:
    sys.exit(1)
PY
}

extract_url() {
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

find_expo_pid() {
  # Prefer the real node packager. Never match agent shells that merely mention expo in argv.
  ps -eo pid=,cmd= | while read -r pid cmd; do
    case "$cmd" in
      node\ */node_modules/.bin/expo\ start*|node\ */@expo/cli/*)
        printf '%s\n' "$pid"
        ;;
    esac
  done
}

stop_expo_tree() {
  # Only used when Metro/tunnel is unhealthy and we must restart.
  if [[ -f "$PID_FILE" ]]; then
    local old
    old="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
      log "Stopping unhealthy Expo pid $old"
      kill "$old" 2>/dev/null || true
      sleep 1
      kill -9 "$old" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  ps -eo pid=,cmd= | while read -r pid cmd; do
    case "$cmd" in
      node\ */node_modules/.bin/expo\ start*|node\ */@expo/cli/*|npm\ exec\ expo\ start*|*/ngrok-bin-linux-x64/ngrok\ *)
        kill "$pid" 2>/dev/null || true
        ;;
    esac
  done
  sleep 1
}

adopt_or_refresh_url() {
  local url
  url="$(extract_url)"
  if [[ -z "$url" && -f "$URL_FILE" ]]; then
    url="$(cat "$URL_FILE")"
  fi
  if [[ -n "$url" ]]; then
    write_qr_if_possible "$url"
    log "Healthy packager; tunnel URL $url"
    write_status "healthy"
    return 0
  fi
  write_status "packager-up-no-url"
  return 1
}

# Exclusive lock — extra agent reconnects must not kill a live tunnel.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  if packager_up; then
    adopt_or_refresh_url || true
    log "Another watchdog already owns Expo; exiting without restart"
    exit 0
  fi
  log "Lock busy and packager down — waiting briefly for peer watchdog"
  sleep 8
  if packager_up; then
    adopt_or_refresh_url || true
    exit 0
  fi
  log "Peer did not recover packager; giving up (avoid double-kill)"
  exit 0
fi

echo $$ >"$WATCHDOG_PID_FILE"
log "Persistent Expo watchdog starting in $ROOT (pid $$)"
write_status "starting"

# Adopt a healthy existing Metro instead of bouncing it on every agent boot.
if packager_up; then
  existing="$(find_expo_pid | head -1 || true)"
  if [[ -n "${existing:-}" ]]; then
    echo "$existing" >"$PID_FILE"
    log "Adopting existing Expo pid $existing"
    adopt_or_refresh_url || true
  fi
fi

while true; do
  # If already healthy, monitor — do not stop/restart.
  if packager_up; then
    existing="$(find_expo_pid | head -1 || true)"
    if [[ -n "${existing:-}" ]]; then
      echo "$existing" >"$PID_FILE"
    fi
    adopt_or_refresh_url || true
    tunnel_fail=0
    while packager_up; do
      if tunnel_up; then
        tunnel_fail=0
        url="$(extract_url)"
        if [[ -n "$url" ]]; then
          # Refresh QR if URL changed or file missing.
          if [[ ! -f "$URL_FILE" ]] || [[ "$(cat "$URL_FILE" 2>/dev/null)" != "$url" ]]; then
            write_qr_if_possible "$url"
            log "Tunnel ready: $url"
          fi
        fi
        write_status "healthy"
        backoff="$BACKOFF_SECS"
      else
        tunnel_fail=$((tunnel_fail + 1))
        log "Tunnel unhealthy ($tunnel_fail/$TUNNEL_FAIL_LIMIT) while Metro still up"
        write_status "tunnel-flapping"
        if (( tunnel_fail >= TUNNEL_FAIL_LIMIT )); then
          log "Tunnel down too long — restarting Expo to rebind ngrok"
          break
        fi
      fi
      sleep 8
    done
    if packager_up && (( tunnel_fail < TUNNEL_FAIL_LIMIT )); then
      # Metro died between checks; fall through to restart path.
      :
    fi
  fi

  stop_expo_tree
  log "Starting Expo tunnel (backoff=${backoff}s on next failure)"
  write_status "starting-expo"

  # --go keeps Expo Go mode; no --clear so restarts stay fast.
  # Do NOT set CI=1 — that disables Metro reloads.
  # Keep a real stdin (tmux pty). Redirecting </dev/null makes Expo exit immediately.
  export EXPO_NO_TELEMETRY=1
  npx expo start --tunnel --go >>"$LOG_FILE" 2>&1 &
  expo_pid=$!
  echo "$expo_pid" >"$PID_FILE"
  log "Expo pid $expo_pid"

  # Give Metro a moment to bind before entering the health loop.
  for _ in 1 2 3 4 5 6; do
    if packager_up || ! kill -0 "$expo_pid" 2>/dev/null; then
      break
    fi
    sleep 2
  done

  if ! kill -0 "$expo_pid" 2>/dev/null; then
    wait "$expo_pid" || true
    exit_code=$?
    rm -f "$PID_FILE"
    log "Expo exited early (code=$exit_code). Restarting in ${backoff}s…"
    write_status "restarting"
    sleep "$backoff"
    if (( backoff < MAX_BACKOFF_SECS )); then
      backoff=$((backoff * 2))
      if (( backoff > MAX_BACKOFF_SECS )); then
        backoff=$MAX_BACKOFF_SECS
      fi
    fi
    continue
  fi

  # Hand off to the monitor loop at top (packager_up path).
done
