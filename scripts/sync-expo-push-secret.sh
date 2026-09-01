#!/usr/bin/env bash
# Copy the saved Expo access token to Supabase as EXPO_ACCESS_TOKEN (push notifications).
# Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens).
# Does not print secret values.
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-dejrbyufotcvcillnneo}"
TOKEN_FILE="${HOME}/.config/choremaxx/expo-token"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "FAIL: SUPABASE_ACCESS_TOKEN is not set."
  echo "Create one at https://supabase.com/dashboard/account/tokens"
  echo "Then: export SUPABASE_ACCESS_TOKEN=sbp_... && npm run supabase:sync-expo-push-secret"
  exit 1
fi

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "FAIL: $TOKEN_FILE missing — save EXPO_TOKEN locally first (see AGENTS.md)."
  exit 1
fi

EXPO_ACCESS_TOKEN="$(cat "$TOKEN_FILE")"
npx supabase secrets set "EXPO_ACCESS_TOKEN=${EXPO_ACCESS_TOKEN}" --project-ref "$PROJECT_REF"
echo "ok  EXPO_ACCESS_TOKEN set on Supabase project $PROJECT_REF (value not shown)"
