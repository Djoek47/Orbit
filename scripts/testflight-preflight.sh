#!/usr/bin/env bash
# Validates repo is ready for an EAS iOS TestFlight build (offline checks).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

pass() { printf 'ok  %s\n' "$*"; }
warn() { printf 'warn %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*"; FAIL=1; }

# 1) Icon
ICON="$ROOT/assets/images/icon.png"
if [[ -f "$ICON" ]]; then
  if file "$ICON" | grep -q '1024 x 1024'; then
    pass "App icon 1024×1024"
  else
    warn "App icon exists but may not be 1024×1024 — verify in App Store Connect"
  fi
else
  fail "Missing assets/images/icon.png"
fi

# 2) app.json / expo config
if node -e '
const cfg = require("./app.json").expo;
const ios = cfg.ios || {};
if (!ios.bundleIdentifier) process.exit(1);
if (!ios.usesAppleSignIn) process.exit(2);
if (!cfg.icon) process.exit(3);
if (!cfg.name || cfg.name.length < 2) process.exit(4);
'; then
  pass "app.json iOS bundle id + Apple Sign In + icon"
else
  fail "app.json missing bundleIdentifier, usesAppleSignIn, icon, or name"
fi

# 3) Duplicate expo-camera plugin
CAMERA_COUNT=$(node -e 'const p=require("./app.json").expo.plugins||[]; console.log(p.filter(x=>x==="expo-camera"||(Array.isArray(x)&&x[0]==="expo-camera")).length)')
if [[ "$CAMERA_COUNT" -le 1 ]]; then
  pass "Single expo-camera plugin entry"
else
  fail "Duplicate expo-camera plugins in app.json ($CAMERA_COUNT)"
fi

# 4) EAS project id (set by eas init / eas build:configure)
PROJECT_ID=$(node -e 'try{console.log(require("./app.json").expo.extra?.eas?.projectId||"")}catch(e){}' 2>/dev/null || true)
if [[ -n "$PROJECT_ID" && "$PROJECT_ID" != "REPLACE_EAS_PROJECT_ID" ]]; then
  pass "EAS projectId configured"
else
  warn "EAS projectId not set — run: npx eas init (links this repo to your Expo account)"
fi

# 5) eas.json profiles
if node -e '
const e=require("./eas.json");
if(!e.build?.testflight && !e.build?.production) process.exit(1);
if(!e.build?.production?.autoIncrement) process.exit(2);
'; then
  pass "eas.json TestFlight/production profiles"
else
  fail "eas.json missing testflight or production build profile"
fi

# 6) Legal URLs in config
if node -e '
const u=require("./app.json").expo.extra||{};
if(!u.privacyPolicyUrl||!u.termsUrl) process.exit(1);
'; then
  pass "Privacy + terms URLs in app.json extra"
else
  fail "Set extra.privacyPolicyUrl and extra.termsUrl in app.json"
fi

# 7) Typecheck (fast sanity)
if npm run typecheck >/dev/null 2>&1; then
  pass "TypeScript check"
else
  fail "npm run typecheck failed"
fi

# ASC App ID (warn if still placeholder before submit)
ASC=$(node -e 'try{console.log(require("./eas.json").submit?.testflight?.ios?.ascAppId||"")}catch(e){}' 2>/dev/null || true)
if [[ -n "$ASC" && "$ASC" != "REPLACE_ASC_APP_ID" ]]; then
  pass "App Store Connect App ID in eas.json"
else
  warn "Set submit.testflight.ios.ascAppId in eas.json (numeric ID from App Store Connect)"
fi

# 9) Secrets reminder (not failing — cloud agents use mock by default)
if [[ "${EXPO_PUBLIC_DATA_MODE:-mock}" == "mock" ]]; then
  warn "EXPO_PUBLIC_DATA_MODE=mock — TestFlight builds use supabase via eas.json env"
fi

echo
if [[ "$FAIL" -ne 0 ]]; then
  echo "TestFlight preflight FAILED — fix items above before eas build"
  exit 1
fi
echo "TestFlight preflight PASSED — next: eas login && eas build --platform ios --profile testflight"
exit 0
