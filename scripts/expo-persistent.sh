#!/usr/bin/env bash
# Keep Expo Go tunnel up across ngrok drops, agent reconnects, and Metro exits.
# Health is based on the PUBLIC edge (not only local ngrok API) so ERR_NGROK_3200
# triggers a restart. Safe to re-run: second instances exit without bouncing Metro.
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
MAX_BACKOFF_SECS="${EXPO_RESTART_MAX_BACKOFF_SECS:-45}"
PUBLIC_FAIL_LIMIT="${EXPO_PUBLIC_FAIL_LIMIT:-2}"
backoff="$BACKOFF_SECS"

# Survive agent shell hangups. Detach without killing Expo.
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
    rg -o 'exp://[A-Za-z0-9._:-]+\.exp\.direct' "$LOG_FILE" 2>/dev/null | tail -1 || true
  fi
}

# True only when the phone-facing edge serves Metro (catches ERR_NGROK_3200 zombies).
public_tunnel_up() {
  local url host body code
  url="$(extract_url)"
  if [[ -z "$url" && -f "$URL_FILE" ]]; then
    url="$(cat "$URL_FILE")"
  fi
  [[ -z "$url" ]] && return 1
  host="${url#exp://}"
  host="${host%%:*}"
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w '%{http_code}' --max-time 10 "https://${host}/status" 2>/dev/null || echo 000)"
  if [[ "$code" == "200" ]] && grep -q 'packager-status:running' "$body"; then
    rm -f "$body"
    # Keep URL file in sync with the live edge.
    write_qr_if_possible "exp://${host}"
    printf '%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >"$LOG_DIR/last-public-ok.txt"
    return 0
  fi
  if grep -q 'ERR_NGROK_3200\|endpoint .* is offline' "$body" 2>/dev/null; then
    log "Public edge reports offline (HTTP $code, ERR_NGROK_3200)"
  else
    log "Public edge probe failed (HTTP $code)"
  fi
  rm -f "$body"
  return 1
}

write_qr_if_possible() {
  local url="$1"
  [[ -z "$url" ]] && return 0
  # Skip rewrite when URL unchanged (health loop runs often).
  if [[ -f "$URL_FILE" ]] && [[ "$(tr -d '[:space:]' <"$URL_FILE")" == "$url" ]]; then
    return 0
  fi
  printf '%s\n' "$url" >"$URL_FILE"
  printf '%s\n' "$url" >/opt/cursor/artifacts/expo-go-qr.txt 2>/dev/null || true
  if command -v node >/dev/null 2>&1; then
    node "$ROOT/scripts/write-expo-qr.mjs" "$url" /opt/cursor/artifacts/expo-go-qr.png \
      >>"$LOG_FILE" 2>&1 || true
  fi
}

find_expo_pid() {
  ps -eo pid=,cmd= | while read -r pid cmd; do
    case "$cmd" in
      node\ */node_modules/.bin/expo\ start*|node\ */@expo/cli/*)
        printf '%s\n' "$pid"
        ;;
    esac
  done
}

stop_pid() {
  local pid="$1"
  [[ -z "${pid:-}" ]] && return 0
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  fi
}

stop_expo_tree() {
  local old
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  stop_pid "$old"
  ps -eo pid=,cmd= | while read -r pid cmd; do
    case "$cmd" in
      node\ */node_modules/.bin/expo\ start*|node\ */@expo/cli/*|npm\ exec\ expo\ start*|*/ngrok-bin-linux-x64/ngrok\ *|*/bin/cloudflared\ tunnel*)
        stop_pid "$pid"
        ;;
    esac
  done
  rm -f "$PID_FILE"
  sleep 1
}

# Exclusive lock — reconnects must not kill a live tunnel.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  if packager_up && public_tunnel_up; then
    log "Another watchdog already owns a healthy Expo; exiting"
    write_status "healthy"
    exit 0
  fi
  log "Lock busy; leaving peer watchdog in charge"
  exit 0
fi

echo $$ >"$WATCHDOG_PID_FILE"
log "Persistent Expo watchdog starting in $ROOT (pid $$)"
write_status "starting"

# Adopt only when the PUBLIC edge is actually serving.
if packager_up && public_tunnel_up; then
  existing="$(find_expo_pid | head -1 || true)"
  if [[ -n "${existing:-}" ]]; then
    echo "$existing" >"$PID_FILE"
    log "Adopting healthy Expo pid $existing ($(cat "$URL_FILE"))"
  fi
  write_status "healthy"
fi

while true; do
  if packager_up && public_tunnel_up; then
    existing="$(find_expo_pid | head -1 || true)"
    if [[ -n "${existing:-}" ]]; then
      echo "$existing" >"$PID_FILE"
    fi
    write_status "healthy"
    backoff="$BACKOFF_SECS"
    public_fail=0
    while packager_up; do
      if public_tunnel_up; then
        public_fail=0
        write_status "healthy"
      else
        public_fail=$((public_fail + 1))
        write_status "tunnel-flapping"
        log "Public tunnel unhealthy ($public_fail/$PUBLIC_FAIL_LIMIT)"
        if (( public_fail >= PUBLIC_FAIL_LIMIT )); then
          log "Restarting Expo to rebind ngrok tunnel"
          break
        fi
      fi
      sleep 6
    done
  fi

  stop_expo_tree
  # Drop stale URL so we never hand out a dead exp.direct host.
  rm -f "$URL_FILE"
  log "Starting Expo tunnel (backoff=${backoff}s on next failure)"
  write_status "starting-expo"

  export EXPO_NO_TELEMETRY=1
  # Keep a real stdin (tmux pty). Do NOT set CI=1 (disables reload).
  npx expo start --tunnel --go >>"$LOG_FILE" 2>&1 &
  expo_pid=$!
  echo "$expo_pid" >"$PID_FILE"
  log "Expo pid $expo_pid"

  # Wait for packager + public edge.
  ready=0
  for _ in $(seq 1 40); do
    if ! kill -0 "$expo_pid" 2>/dev/null && ! packager_up; then
      break
    fi
    if packager_up && public_tunnel_up; then
      ready=1
      log "Tunnel publicly reachable: $(cat "$URL_FILE")"
      write_status "healthy"
      backoff="$BACKOFF_SECS"
      break
    fi
    sleep 3
  done

  if [[ "$ready" -eq 1 ]]; then
    continue
  fi

  wait "$expo_pid" 2>/dev/null || true
  exit_code=$?
  rm -f "$PID_FILE"
  log "Expo not publicly healthy (code=$exit_code). Restarting in ${backoff}s…"
  write_status "restarting"
  sleep "$backoff"
  if (( backoff < MAX_BACKOFF_SECS )); then
    backoff=$((backoff * 2))
    if (( backoff > MAX_BACKOFF_SECS )); then
      backoff=$MAX_BACKOFF_SECS
    fi
  fi
done
