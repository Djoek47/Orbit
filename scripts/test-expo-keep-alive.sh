#!/usr/bin/env bash
# Offline self-test for the Expo keep-alive pipeline (no Metro required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

pass() { printf 'ok  %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; FAIL=1; }

# 1) Scripts exist and parse.
for script in scripts/expo-persistent.sh scripts/expo-keep-alive.sh scripts/expo-healthcheck.sh; do
  if [[ -x "$script" ]] || [[ -f "$script" ]]; then
    bash -n "$script" && pass "bash -n $script" || fail "bash -n $script"
  else
    fail "missing $script"
  fi
done

# 2) ERR_NGROK_3200 HTML is detected as offline (mirrors healthcheck logic).
BODY="$(mktemp)"
cat >"$BODY" <<'HTML'
<html><body>The endpoint gte5frq-anonymous-8081.exp.direct is offline. (ERR_NGROK_3200)</body></html>
HTML
if grep -q 'ERR_NGROK_3200\|endpoint .* is offline' "$BODY"; then
  pass "detect ERR_NGROK_3200 offline HTML"
else
  fail "detect ERR_NGROK_3200 offline HTML"
fi

# 3) Healthy packager body is detected.
echo 'packager-status:running' >"$BODY"
if grep -q 'packager-status:running' "$BODY"; then
  pass "detect packager-status:running"
else
  fail "detect packager-status:running"
fi
rm -f "$BODY"

# 4) package.json entry points.
if node -e 'const p=require("./package.json"); if(p.scripts["start:persistent"]!=="bash ./scripts/expo-keep-alive.sh") process.exit(1); if(!p.scripts["expo:health"]) process.exit(2)'; then
  pass "package.json start:persistent → keep-alive"
else
  fail "package.json start:persistent → keep-alive"
fi

# 5) environment.json boots keep-alive.
if node -e 'const e=require("./.cursor/environment.json"); const t=(e.terminals||[]).some(x=>String(x.command||"").includes("start:persistent")); if(!t) process.exit(1)'; then
  pass "environment.json starts persistent pipeline"
else
  fail "environment.json starts persistent pipeline"
fi

# 6) QR writer rejects non-exp URLs.
if node scripts/write-expo-qr.mjs 'http://example.com' /tmp/orbit-qr-test.png >/dev/null 2>&1; then
  fail "QR writer should reject non-exp URL"
else
  pass "QR writer rejects non-exp URL"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "Expo keep-alive self-test FAILED"
  exit 1
fi
echo
echo "Expo keep-alive self-test PASSED"
exit 0
