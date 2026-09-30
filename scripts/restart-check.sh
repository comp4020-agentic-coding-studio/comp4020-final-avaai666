#!/bin/sh
# Persistence across a restart (spec/pond-app.test.ts, test 8): dig, join and
# catch against a server of its own, stop it, start it again on the same
# DATA_DIR, and check the pond page still shows the catch. Local only: it
# starts its own server on PORT (default 8091) with a temp DATA_DIR.
set -eu

PORT="${PORT:-8091}"
DATA_DIR="$(mktemp -d)"
URL="http://localhost:$PORT"
LOG="$DATA_DIR/server.log"
export PORT DATA_DIR

start() {
  node src/server.ts >>"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "$URL/" && return 0
    sleep 0.1
  done
  echo "server did not start"; cat "$LOG"; exit 1
}

stop() {
  kill -TERM "$PID"
  wait "$PID" || true
}

trap 'kill "$PID" 2>/dev/null || true; rm -rf "$DATA_DIR"' EXIT

start
POND=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST "$URL/dig" | sed 's|.*/p/||')
COOKIE=$(curl -s -D - -o /dev/null -X POST --data-urlencode "name=Ava" "$URL/p/$POND/join" | sed -n 's/^set-cookie: \([^;]*\).*/\1/p')
CATCH=$(curl -s -b "$COOKIE" -H 'content-type: application/json' \
  -d '{"key":"6f1c2a4e-1111-4222-8333-444455556666"}' "$URL/p/$POND/catch")
echo "pond $POND, catch answered: $CATCH"
BEFORE=$(curl -s -b "$COOKIE" "$URL/p/$POND" | grep -o 'Ava (you) · [0-9]* caught')
echo "before restart: $BEFORE"

stop
echo "server stopped (SIGTERM); starting again on the same DATA_DIR"
start

AFTER=$(curl -s -b "$COOKIE" "$URL/p/$POND" | grep -o 'Ava (you) · [0-9]* caught' || true)
echo "after restart:  $AFTER"
stop

if [ "$AFTER" = "Ava (you) · 1 caught" ]; then
  echo "PASS: the catch and the net survived a restart"
else
  echo "FAIL: expected 'Ava (you) · 1 caught' after the restart"; cat "$LOG"; exit 1
fi
