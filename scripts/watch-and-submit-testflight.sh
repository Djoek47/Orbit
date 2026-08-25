#!/usr/bin/env bash
set -euo pipefail
BUILD_ID="${1:?build id required}"
echo "Watching build $BUILD_ID ..."
for i in $(seq 1 90); do
  STATUS=$(npx eas build:view "$BUILD_ID" --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{console.log(JSON.parse(s).status||"")}catch{console.log("")}})')
  echo "[$(date -u +%H:%M:%S)] status=${STATUS:-unknown}"
  case "$STATUS" in
    finished|FINISHED)
      echo "Build finished — submitting to TestFlight..."
      npx eas submit --platform ios --profile testflight --id "$BUILD_ID" --non-interactive
      exit $?
      ;;
    errored|ERRORED|canceled|cancelled|CANCELED|CANCELLED)
      echo "Build failed/canceled: $STATUS"
      exit 1
      ;;
  esac
  sleep 60
done
echo "Timed out waiting for build"
exit 1
