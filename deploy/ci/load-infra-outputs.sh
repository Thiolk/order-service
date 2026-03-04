#!/usr/bin/env bash
set -euo pipefail

test -f infra-outputs.json

KUBE_CONTEXT="$(jq -r '.kube_context.value' infra-outputs.json)"
INGRESS_NS="$(jq -r '.ingress_namespace.value' infra-outputs.json)"
INGRESS_SVC="$(jq -r '.ingress_controller_service.value' infra-outputs.json)"

# Emit export commands so the caller can source them into the current shell
cat <<EOF
export KUBE_CONTEXT='${KUBE_CONTEXT}'
export INGRESS_NS='${INGRESS_NS}'
export INGRESS_SVC='${INGRESS_SVC}'
EOF