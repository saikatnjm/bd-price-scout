#!/usr/bin/env bash
# Runs a command; on failure, also reports its last output lines as a GitHub error
# annotation so failures are visible in the Checks UI/API without downloading logs.
set -uo pipefail
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  tail -n 60 "$log" | sed -e 's/%/%25/g' -e 's/\r//g' | awk 'BEGIN{ORS="%0A"} {print}' > "$log.msg"
  echo "::error title=Failed: $*::$(cat "$log.msg")"
fi
exit "$status"
