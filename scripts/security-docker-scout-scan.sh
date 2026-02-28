#!/usr/bin/env bash
set -euo pipefail

# Default image (can be overridden by Jenkins: IMAGE=... ./scripts/security-docker-scout-scan.sh)
IMAGE="${IMAGE:-thiolengkiat413/order-service:latest}"
SEVERITIES="${SEVERITIES:-critical,high}"

echo "Docker Scout CVE scan (notify-only; does not fail CI)"
echo "Image:      ${IMAGE}"
echo "Severities: ${SEVERITIES}"
echo

docker scout quickview "${IMAGE}" || true
echo

docker scout cves "${IMAGE}" --only-severity "${SEVERITIES}" || true
echo
echo "NOTE: CVEs (if any) are reported for visibility but do not fail the pipeline."