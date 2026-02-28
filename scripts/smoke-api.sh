#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"

resp_register=$(curl -sS -X POST "$BASE_URL/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@padely.app","password":"strongpass9","displayName":"Smoke"}' || true)

if echo "$resp_register" | grep -q 'Email already exists'; then
  resp_login=$(curl -sS -X POST "$BASE_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"smoke@padely.app","password":"strongpass9"}')
  token=$(echo "$resp_login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
else
  token=$(echo "$resp_register" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
fi

if [[ -z "$token" ]]; then
  echo "Unable to get auth token"
  echo "register response: $resp_register"
  exit 1
fi

echo "Token OK"

me=$(curl -sS "$BASE_URL/api/v1/me" -H "Authorization: Bearer $token")
echo "ME: $me"

players=$(curl -sS "$BASE_URL/api/v1/community/players" -H "Authorization: Bearer $token")
echo "PLAYERS: $players"

echo "Smoke API done"
