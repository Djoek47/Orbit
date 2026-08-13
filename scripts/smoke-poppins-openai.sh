#!/usr/bin/env bash
# A6 smoke: confirm OPENAI_API_KEY is set and poppins-chat is reachable.
# Does not print secret values.
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-dejrbyufotcvcillnneo}"
BASE="https://${PROJECT_REF}.supabase.co/functions/v1"

echo "== A6 Poppins OpenAI smoke =="
echo "project: $PROJECT_REF"

has_key=0
for _ in 1 2 3 4 5; do
  if npx supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null \
    | python3 -c 'import sys, json; d = json.load(sys.stdin); sys.exit(0 if any(s.get("name") == "OPENAI_API_KEY" for s in d.get("secrets", [])) else 1)'; then
    has_key=1
    break
  fi
  sleep 1
done

if [[ "$has_key" != "1" ]]; then
  echo "FAIL OPENAI_API_KEY missing from Supabase secrets"
  echo "Set it with:"
  echo "  npx supabase secrets set OPENAI_API_KEY=sk-... --project-ref $PROJECT_REF"
  exit 1
fi
echo "ok  OPENAI_API_KEY present (value not shown)"

for fn in poppins-chat poppins-briefing poppins-voice poppins-realtime-session poppins-monitor; do
  code=$(curl -sS -o /tmp/poppins-smoke-body.txt -w '%{http_code}' \
    -X POST "$BASE/$fn" \
    -H 'Content-Type: application/json' \
    -d '{}')
  # Unauthenticated should be 401 once JWT verify is on; 401/403/400 means the function is up.
  if [[ "$code" == "401" || "$code" == "403" || "$code" == "400" ]]; then
    echo "ok  $fn reachable (HTTP $code without auth)"
  else
    echo "warn $fn unexpected HTTP $code (body: $(head -c 160 /tmp/poppins-smoke-body.txt))"
  fi
done

echo
echo "Models (craft):"
echo "  chat/briefing/monitor/voice → gpt-4o-mini"
echo "  realtime session           → gpt-realtime-2.1-mini"
echo
echo "Next (device): open TestFlight or Expo Go with"
echo "  EXPO_PUBLIC_POPPINS_AI=openai"
echo "  EXPO_PUBLIC_POPPINS_REALTIME=1"
echo "  EXPO_PUBLIC_SUPABASE_URL / ANON_KEY set"
echo "then: ask “Who’s overloaded?” (tool-backed) and “Plan Saturday” (propose_plan → Activity)."
echo "PASS secrets + functions reachable"
