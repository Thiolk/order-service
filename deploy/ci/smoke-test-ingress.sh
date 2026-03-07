#!/usr/bin/env bash
set -euo pipefail

HOST="${1:?usage: smoke-test-ingress.sh <host> [path]}"
PATH_TO_TEST="${2:-/health}"

INGRESS_NS="${INGRESS_NS:-ingress-nginx}"
INGRESS_SVC="${INGRESS_SVC:-ingress-nginx-controller}"
LOCAL_PORT="${LOCAL_PORT:-18080}"

LOG_FILE="${LOG_FILE:-/tmp/ingress-pf.log}"

echo "Smoke test via ingress port-forward:"
echo "  INGRESS_NS=$INGRESS_NS"
echo "  INGRESS_SVC=$INGRESS_SVC"
echo "  LOCAL_PORT=$LOCAL_PORT"
echo "  HOST=$HOST"
echo "  PATH=$PATH_TO_TEST"

kubectl -n "$INGRESS_NS" port-forward "svc/$INGRESS_SVC" "${LOCAL_PORT}:80" >"$LOG_FILE" 2>&1 &
PF_PID=$!
trap 'kill $PF_PID >/dev/null 2>&1 || true' EXIT INT TERM

# Wait until port-forward socket is reachable (curl returns non-000)
i=1
while [ $i -le 30 ]; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LOCAL_PORT}/" || true)"
  if [ "$code" != "000" ]; then break; fi
  sleep 1
  i=$((i+1))
done

code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LOCAL_PORT}/" || true)"
if [ "$code" = "000" ]; then
  echo "ERROR: ingress port-forward not reachable"
  echo "--- $LOG_FILE ---"
  cat "$LOG_FILE" || true
  exit 1
fi

# Real request (this is the one that matters)
curl -fsS -i -H "Host: $HOST" "http://127.0.0.1:${LOCAL_PORT}${PATH_TO_TEST}"