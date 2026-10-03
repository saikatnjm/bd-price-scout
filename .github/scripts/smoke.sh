#!/usr/bin/env bash
# HTTP smoke test for a running BD Price Scout instance (local container or deployment).
# Usage: smoke.sh <base-url> [expected-commit-sha]
set -euo pipefail
base="${1%/}"
expected_sha="${2:-}"
tmp="$(mktemp -d)"
fail() { echo "FAIL: $*"; exit 1; }

# Home page renders the search shell.
code=$(curl -sS -o "$tmp/home.html" -D "$tmp/home.h" -w '%{http_code}' "$base/")
[ "$code" = 200 ] || fail "GET / returned $code"
grep -q 'BD Price Scout' "$tmp/home.html" || fail "home page missing title"
grep -q 'Find Best Price' "$tmp/home.html" || fail "home page missing search button"
grep -qi '^x-content-type-options: nosniff' "$tmp/home.h" || fail "missing X-Content-Type-Options header"
grep -qi '^x-frame-options: DENY' "$tmp/home.h" || fail "missing X-Frame-Options header"
! grep -qi '^x-powered-by' "$tmp/home.h" || fail "X-Powered-By header exposed"
echo "OK  GET / (200, UI shell, security headers)"

# Search API: valid request.
code=$(curl -sS -o "$tmp/ok.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  --data '{"query":"Samsung Galaxy S25 Ultra 256GB"}' "$base/api/search")
[ "$code" = 200 ] || fail "POST /api/search returned $code: $(head -c 300 "$tmp/ok.json")"
grep -q '"query":"Samsung Galaxy S25 Ultra 256GB"' "$tmp/ok.json" || fail "unexpected search body: $(head -c 300 "$tmp/ok.json")"
grep -q '"results":\[' "$tmp/ok.json" || fail "search body has no results array"
echo "OK  POST /api/search valid -> 200 $(head -c 200 "$tmp/ok.json")"

# Real store search (deployments only; CI's container smoke test never contacts stores).
if [ "${SMOKE_LIVE_SEARCH:-}" = 1 ]; then
  code=$(curl -sS -o "$tmp/live.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    --data '{"query":"soybean oil 5 ltr"}' "$base/api/search")
  [ "$code" = 200 ] && grep -q '"status":"ok"' "$tmp/live.json" && grep -q '"url":"https://othoba.com/' "$tmp/live.json" \
    || fail "live search -> $code $(head -c 400 "$tmp/live.json")"
  echo "OK  live Othoba search -> $(grep -o '"durationMs":[0-9]*' "$tmp/live.json" | head -1), $(grep -o '"resultCount":[0-9]*' "$tmp/live.json" | head -1)"
  grep -qi '^content-security-policy:' "$tmp/home.h" || fail "missing Content-Security-Policy header (production build)"
  echo "OK  Content-Security-Policy present"
fi

# Search API: invalid JSON and invalid query are rejected with structured errors.
code=$(curl -sS -o "$tmp/bad.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data '{bad' "$base/api/search")
[ "$code" = 400 ] && grep -q '"INVALID_REQUEST"' "$tmp/bad.json" || fail "invalid JSON -> $code $(cat "$tmp/bad.json")"
code=$(curl -sS -o "$tmp/short.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data '{"query":"a"}' "$base/api/search")
[ "$code" = 400 ] && grep -q '"INVALID_QUERY"' "$tmp/short.json" || fail "short query -> $code $(cat "$tmp/short.json")"
echo "OK  POST /api/search invalid -> 400 structured errors"

# Wrong method is not served.
code=$(curl -sS -o /dev/null -w '%{http_code}' "$base/api/search")
[ "$code" = 405 ] || fail "GET /api/search returned $code (expected 405)"
echo "OK  GET /api/search -> 405"

# Client bundles must not contain server-only config names or server modules.
grep -oE '/_next/static/[^"]+\.js' "$tmp/home.html" | sort -u > "$tmp/chunks.txt"
[ -s "$tmp/chunks.txt" ] || fail "no JS chunks found in home page"
n=0
while read -r path; do
  curl -sS "$base$path" -o "$tmp/chunk.js"
  if grep -qE 'STORE_TIMEOUT_MS|SEARCH_BUDGET_MS|StoreBlockedError|parseSearchRequest' "$tmp/chunk.js"; then
    fail "server-only code/config found in client chunk $path"
  fi
  n=$((n + 1))
done < "$tmp/chunks.txt"
echo "OK  $n client JS chunks contain no server-only config or code"

if [ -n "$expected_sha" ]; then
  echo "INFO expected commit $expected_sha (compare with Vercel deployment metadata)"
fi
echo "SMOKE PASSED: $base"
