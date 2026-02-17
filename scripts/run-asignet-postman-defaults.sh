#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults from postman/DBO ASIGNET.postman_collection.json
BASE_URL="${BASE_URL:-https://dbo.asignet.com/asignetrestapi}"
USERNAME="${USERNAME:-userrestapi}"
PASSWORD="${PASSWORD:-xgHE4bTA:we#3J9}"
EMAIL="${EMAIL:-mlamanna@asignet.com}"
START_DATE="${START_DATE:-2026-02-17}"
END_DATE="${END_DATE:-2026-02-18}"
HOST_VALUE="${HOST_VALUE:-}"
RESPONSES_DIR="${RESPONSES_DIR:-$SCRIPT_DIR/respones}"
RUN_STAMP="$(date +%Y%m%d_%H%M%S)"

print_json_if_possible() {
  local input_file="$1"
  if node -e '
const fs = require("fs");
const raw = fs.readFileSync(process.argv[1], "utf8");
JSON.parse(raw);
' "$input_file" >/dev/null 2>&1; then
    node -e '
const fs = require("fs");
const raw = fs.readFileSync(process.argv[1], "utf8");
console.log(JSON.stringify(JSON.parse(raw), null, 2));
' "$input_file"
  else
    cat "$input_file"
  fi
}

save_json_response() {
  local filename="$1"
  local input_file="$2"
  mkdir -p "$RESPONSES_DIR"
  node -e '
const fs = require("fs");
const outPath = process.argv[1];
const inPath = process.argv[2];
const raw = fs.readFileSync(inPath, "utf8");
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  payload = { raw };
}
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
' "$RESPONSES_DIR/$filename" "$input_file"
}

extract_token() {
  local input_file="$1"
  node -e '
const fs = require("fs");
const raw = fs.readFileSync(process.argv[1], "utf8");
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
' "$input_file"
}

AUTH_PAYLOAD=$(cat <<EOF
{
  "Username": "$USERNAME",
  "Password": "$PASSWORD"
}
EOF
)

printf 'Responses will be saved to: %s\n' "$RESPONSES_DIR"

AUTH_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"
USER_FILE="$(mktemp)"
trap 'rm -f "$AUTH_FILE" "$LOG_FILE" "$USER_FILE"' EXIT

printf '==> Authenticate: %s/api/login/authenticate\n' "$BASE_URL"
curl -sS -X POST "$BASE_URL/api/login/authenticate" \
  -H "Content-Type: application/json" \
  --data-raw "$AUTH_PAYLOAD" \
  -o "$AUTH_FILE"

TOKEN="$(extract_token "$AUTH_FILE")"
if [[ -z "$TOKEN" ]]; then
  echo "Failed to extract auth token from login response:"
  print_json_if_possible "$AUTH_FILE"
  exit 1
fi

echo "Token extracted successfully."

printf '\n==> GET %s/api/Wayfast/LogRequestList\n' "$BASE_URL"
curl -sS -G "$BASE_URL/api/Wayfast/LogRequestList" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "Email=$EMAIL" \
  --data-urlencode "StartDate=$START_DATE" \
  --data-urlencode "EndDate=$END_DATE" \
  --data-urlencode "Host=$HOST_VALUE" \
  -o "$LOG_FILE"
print_json_if_possible "$LOG_FILE"
save_json_response "wayfast_log_request_list_${RUN_STAMP}.json" "$LOG_FILE"
printf 'Saved: %s/wayfast_log_request_list_%s.json\n' "$RESPONSES_DIR" "$RUN_STAMP"

printf '\n==> GET %s/api/Wayfast/GetUserByEmail\n' "$BASE_URL"
curl -sS -G "$BASE_URL/api/Wayfast/GetUserByEmail" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "email=$EMAIL" \
  -o "$USER_FILE"
print_json_if_possible "$USER_FILE"
save_json_response "wayfast_get_user_by_email_${RUN_STAMP}.json" "$USER_FILE"
printf 'Saved: %s/wayfast_get_user_by_email_%s.json\n' "$RESPONSES_DIR" "$RUN_STAMP"
