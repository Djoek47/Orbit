#!/usr/bin/env bash
# Outer supervisor for Expo Go on Cloud Agents.
# Guarantees: tmux session + watchdog + publicly reachable tunnel + fresh QR.
#
# Safe to call repeatedly (environment.json boots, agent reconnects, manual runs).
# Entry point: npm run start:persistent
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="${EXPO_PERSISTENT_LOG_DIR:-/tmp/orbit-expo}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/keep-alive.log"
STATUS_FILE="$LOG_DIR/status.txt"
URL_FILE="$LOG_DIR/tunnel-url.txt"
SUPERVISOR_LOCK="$LOG_DIR/supervisor.lock"
SUPERVISOR_PID_FILE="$LOG_DIR/supervisor.pid"
FAIL_FILE="$LOG_DIR/public-fail-count"

TMUX_CONF="/exec-daemon/tmux.portal.conf"
SESSION="${EXPO_TMUX_SESSION:-orbit-expo}"
HEALTH_EVERY_SECS="${EXPO_HEALTH_EVERY_SECS:-10}"
FAIL_LIMIT="${EXPO_SUPERVISOR_FAIL_LIMIT:-3}"
ARTIFACT_URL="/opt/cursor/artifacts/expo-go-qr.txt"
ARTIFACT_QR="/opt/cursor/artifacts/expo-go-qr.png"

tmux_bin() {
  if [[ -f "$TMUX_CONF" ]]; then
    tmux -f "$TMUX_CONF" "$@"
  else
    tmux "$@"
  fi
}

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE"
}

write_supervisor_status() {
  local state="$1"
  local url=""
  [[ -f "$URL_FILE" ]] && url="$(tr -d '[:space:]' <"$URL_FILE")"
  printf 'supervisor=%s\nstate=%s\nupdated=%s\nurl=%s\nsession=%s\n' \
    "$$" "$state" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$url" "$SESSION" \
    >"$LOG_DIR/supervisor-status.txt"
}

ensure_tmux_session() {
  if tmux_bin has-session -t "=$SESSION" 2>/dev/null; then
    return 0
  fi
  log "Creating tmux session $SESSION"
  tmux_bin new-session -d -s "$SESSION" -c "$ROOT" -- "${SHELL:-bash}" -l
}

watchdog_pid() {
  ps -eo pid=,cmd= | awk '$2=="bash" && $3=="./scripts/expo-persistent.sh" {print $1; exit}'
}

ensure_watchdog() {
  local wd
  wd="$(watchdog_pid)"
  if [[ -n "$wd" ]]; then
    return 0
  fi
  ensure_tmux_session
  log "Starting expo-persistent watchdog in tmux:$SESSION"
  # Clear any leftover inner lock from a killed watchdog.
  rm -f "$LOG_DIR/watchdog.lock"
  tmux_bin send-keys -t "$SESSION:0.0" C-c 2>/dev/null || true
  sleep 0.2
  tmux_bin send-keys -t "$SESSION:0.0" "cd '$ROOT' && bash ./scripts/expo-persistent.sh" Enter
  # Give it a moment to acquire lock / start Metro.
  sleep 2
}

force_tunnel_restart() {
  log "Forcing tunnel restart (public edge unhealthy)"
  write_supervisor_status "forcing-restart"
  # Hard-kill packager + ngrok; leave supervisor + tmux alive.
  ps -eo pid=,cmd= | while read -r pid cmd; do
    case "$cmd" in
      node\ */node_modules/.bin/expo\ start*|node\ */@expo/cli/*|npm\ exec\ expo\ start*|*/ngrok-bin-linux-x64/ngrok\ *)
        kill -9 "$pid" 2>/dev/null || true
        ;;
    esac
  done
  # Bounce watchdog so it does a clean start (do not use broad pkill -f).
  local wd
  wd="$(watchdog_pid)"
  if [[ -n "$wd" ]]; then
    kill -9 "$wd" 2>/dev/null || true
  fi
  rm -f "$LOG_DIR/watchdog.lock" "$LOG_DIR/expo.pid" "$URL_FILE"
  printf '0\n' >"$FAIL_FILE"
  sleep 1
  ensure_watchdog
}

refresh_qr() {
  local url=""
  [[ -f "$URL_FILE" ]] && url="$(tr -d '[:space:]' <"$URL_FILE")"
  [[ -z "$url" ]] && return 0
  if command -v node >/dev/null 2>&1; then
    node "$ROOT/scripts/write-expo-qr.mjs" "$url" "$ARTIFACT_QR" >>"$LOG_FILE" 2>&1 || true
  fi
  printf '%s\n' "$url" >"$ARTIFACT_URL" 2>/dev/null || true
}

# Singleton supervisor — second boots exit if we are already healthy.
exec 8>"$SUPERVISOR_LOCK"
if ! flock -n 8; then
  if bash "$ROOT/scripts/expo-healthcheck.sh"; then
    log "Supervisor already running and tunnel healthy — exiting"
    bash "$ROOT/scripts/expo-healthcheck.sh" --json >>"$LOG_FILE" 2>&1 || true
    exit 0
  fi
  log "Supervisor lock busy but tunnel unhealthy — waiting for peer"
  # Peer should recover; avoid double-restarts.
  exit 0
fi

echo $$ >"$SUPERVISOR_PID_FILE"
trap '' HUP
trap 'log "Supervisor detaching"; write_supervisor_status "detached"; exit 0' INT TERM

log "Expo keep-alive supervisor starting (pid $$)"
write_supervisor_status "starting"
printf '0\n' >"$FAIL_FILE"

ensure_tmux_session
ensure_watchdog

# Wait for first healthy window (up to ~3 min) so QR is ready for the user.
for _ in $(seq 1 36); do
  if bash "$ROOT/scripts/expo-healthcheck.sh"; then
    refresh_qr
    write_supervisor_status "healthy"
    log "Tunnel healthy: $(tr -d '[:space:]' <"$URL_FILE" 2>/dev/null || echo unknown)"
    break
  fi
  ensure_watchdog
  sleep 5
done

# Forever: heal when the public edge dies (ERR_NGROK_3200 etc.).
while true; do
  ensure_tmux_session
  ensure_watchdog

  if bash "$ROOT/scripts/expo-healthcheck.sh"; then
    printf '0\n' >"$FAIL_FILE"
    refresh_qr
    write_supervisor_status "healthy"
  else
    fails="$(cat "$FAIL_FILE" 2>/dev/null || echo 0)"
    fails=$((fails + 1))
    printf '%s\n' "$fails" >"$FAIL_FILE"
    write_supervisor_status "unhealthy"
    log "Healthcheck failed ($fails/$FAIL_LIMIT)"
    bash "$ROOT/scripts/expo-healthcheck.sh" --json >>"$LOG_FILE" 2>&1 || true
    if (( fails >= FAIL_LIMIT )); then
      force_tunnel_restart
      # Allow recovery time before counting failures again.
      sleep 20
      continue
    fi
  fi

  # Heartbeat line for the Cloud Agent terminal pane.
  url="$(tr -d '[:space:]' <"$URL_FILE" 2>/dev/null || echo 'exp://pending')"
  printf '[%s] keep-alive ok · %s\n' "$(date -u +'%H:%M:%SZ')" "$url"
  sleep "$HEALTH_EVERY_SECS"
done
