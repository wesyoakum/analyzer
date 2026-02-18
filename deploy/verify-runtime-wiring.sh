#!/usr/bin/env bash
set -euo pipefail

API_PORT="${API_PORT:-3000}"
NGINX_BIN="${NGINX_BIN:-nginx}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command '$1' is not available in this container." >&2
    return 1
  fi
}

print_section() {
  printf '\n== %s ==\n' "$1"
}

print_section "Nginx effective config (${NGINX_BIN} -T)"
require_cmd "$NGINX_BIN"
NGINX_DUMP="$($NGINX_BIN -T 2>&1)"
printf '%s\n' "$NGINX_DUMP"

for expected in \
  'location /api/ { proxy_pass http://analyzer_node; }' \
  'location = /api/health {' \
  'limit_except GET HEAD OPTIONS {' \
  'location = /api/reports/pdf {' \
  'limit_except POST OPTIONS {'
do
  if ! grep -Fq "$expected" <<<"$NGINX_DUMP"; then
    echo "ERROR: expected nginx snippet not found: $expected" >&2
    exit 1
  fi
  echo "OK: found nginx snippet: $expected"
done

print_section "Node upstream listener"
require_cmd ss
if ss -ltnp | grep -F ":${API_PORT} " | grep -Eq 'node|server/index\.js'; then
  echo "OK: found Node listener on 127.0.0.1:${API_PORT}"
else
  echo "ERROR: no Node process is listening on ${API_PORT}" >&2
  ss -ltnp | sed 's/^/  /'
  exit 1
fi

print_section "Smoke check: GET /api/health"
HEALTH_RESPONSE="$(curl -si "http://localhost/api/health")"
printf '%s\n' "$HEALTH_RESPONSE"
if ! grep -Fq 'HTTP/1.1 200' <<<"$HEALTH_RESPONSE"; then
  echo "ERROR: /api/health did not return HTTP 200" >&2
  exit 1
fi
if ! grep -Fq '{"ok":true,"service":"analyzer-api"}' <<<"$HEALTH_RESPONSE"; then
  echo "ERROR: /api/health did not return expected JSON payload" >&2
  exit 1
fi

echo "OK: /api/health returned expected JSON payload"

print_section "Smoke check: POST /api/reports/pdf"
PDF_RESPONSE="$(curl -si -X POST "http://localhost/api/reports/pdf" -H 'Content-Type: application/json' -d '{}')"
printf '%s\n' "$PDF_RESPONSE"

if grep -Fq '405 Not Allowed' <<<"$PDF_RESPONSE"; then
  echo "ERROR: /api/reports/pdf returned 405 (likely nginx method filter issue)" >&2
  exit 1
fi
if grep -Eiq '<!doctype html>|<html' <<<"$PDF_RESPONSE"; then
  echo "ERROR: /api/reports/pdf returned HTML (likely static fallback), not API JSON" >&2
  exit 1
fi
if ! grep -Eiq 'content-type: application/json' <<<"$PDF_RESPONSE"; then
  echo "ERROR: /api/reports/pdf did not return JSON" >&2
  exit 1
fi

echo "OK: /api/reports/pdf reached backend API and returned JSON"

echo "\nAll runtime wiring checks passed."
