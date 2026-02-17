#!/usr/bin/env bash
set -euo pipefail

# Defaults from postman/DBO ASIGNET.postman_collection.json
BASE_URL="${BASE_URL:-https://dbo.asignet.com/asignetrestapi}"
USERNAME="${USERNAME:-userrestapi}"
PASSWORD="${PASSWORD:-xgHE4bTA:we#3J9}"
EMAIL="${EMAIL:-mlamanna@asignet.com}"
START_DATE="${START_DATE:-2026-02-17}"
END_DATE="${END_DATE:-2026-02-18}"
HOST_VALUE="${HOST_VALUE:-}"

print_json_if_possible() {
  local value="$1"
  if node -e 'JSON.parse(process.argv[1])' "$value" >/dev/null 2>&1; then
    node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1]), null, 2))' "$value"
  else
    printf '%s\n' "$value"
  fi
}

extract_token() {
  local value="$1"
  node -e '
const raw = process.argv[1];
let token = "";
try {
  const data = JSON.parse(raw);
  const keys = ["token", "Token", "access_token", "accessToken", "jwt", "Jwt"];
  for (const k of keys) {
    if (typeof data?.[k] === "string") {
      token = data[k];
      break;
    }
  }
  if (!token && typeof data === "string") token = data;
} catch {}
if (!token) {
  const match =
    raw.match(/"token"\s*:\s*"([^"]+)"/i) ||
    raw.match(/"access_token"\s*:\s*"([^"]+)"/i) ||
    raw.match(/"jwt"\s*:\s*"([^"]+)"/i);
  if (match) token = match[1];
}
process.stdout.write((token || "").replace(/^"+|"+$/g, ""));
' "$value"
}

AUTH_PAYLOAD=$(cat <<EOF
{
  "Username": "$USERNAME",
  "Password": "$PASSWORD"
}
EOF
)

printf '==> Authenticate: %s/api/login/authenticate\n' "$BASE_URL"
AUTH_RESPONSE=$(curl -sS -X POST "$BASE_URL/api/login/authenticate" \
  -H "Content-Type: application/json" \
  --data-raw "$AUTH_PAYLOAD")

TOKEN="$(extract_token "$AUTH_RESPONSE")"
if [[ -z "$TOKEN" ]]; then
  echo "Failed to extract auth token from login response:"
  print_json_if_possible "$AUTH_RESPONSE"
  exit 1
fi

echo "Token extracted successfully."

printf '\n==> GET %s/api/Wayfast/LogRequestList\n' "$BASE_URL"
LOG_RESPONSE=$(curl -sS -G "$BASE_URL/api/Wayfast/LogRequestList" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "Email=$EMAIL" \
  --data-urlencode "StartDate=$START_DATE" \
  --data-urlencode "EndDate=$END_DATE" \
  --data-urlencode "Host=$HOST_VALUE")
print_json_if_possible "$LOG_RESPONSE"

printf '\n==> GET %s/api/Wayfast/GetUserByEmail\n' "$BASE_URL"
USER_RESPONSE=$(curl -sS -G "$BASE_URL/api/Wayfast/GetUserByEmail" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "email=$EMAIL")
print_json_if_possible "$USER_RESPONSE"
