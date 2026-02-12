#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-order-service:local}"
SEVERITIES="${SEVERITIES:-critical,high}"

echo "Docker Scout CVE scan"
echo "Image:      ${IMAGE}"
echo "Severities: ${SEVERITIES}"
echo

docker scout quickview "${IMAGE}" || true
echo
docker scout cves "${IMAGE}" --only-severity "${SEVERITIES}" --exit-code