# Order Service

REST API for order management.

---

## Architecture Context

This service is part of a containerized microservices-based e-commerce system:

- **product-service** — Product management API
- **order-service** — Order management API (this repository)
- **ecommerce-frontend** — React frontend served by Nginx
- **database** — PostgreSQL

Each service is versioned, containerized, independently buildable/deployable, and deployed via Kubernetes.
CI/CD is implemented using **Jenkins Multibranch Pipelines** with environment-aware deployments.

---

## Version

- Current release: 2.2.0

---

## Versioning

This service follows **Semantic Versioning (SemVer)**:

`MAJOR.MINOR.PATCH`

- **MAJOR**: breaking API changes
- **MINOR**: new features (backwards compatible)
- **PATCH**: bug fixes

Production releases are triggered via Git tags (e.g., `v2.0.0`).

---

## Prerequisites

### Local tooling

- Docker
- Docker Compose
- Node.js (for local development)
- Kubernetes (Minikube for local cluster testing)
- kubectl
- Jenkins (for CI/CD)

### CI/CD + Terraform (Infra outputs)

This repo’s Jenkins pipeline can consume **Terraform outputs** produced by the infra pipeline (separate repo/job),
so the service can deploy consistently across environments.

---

## Docker Files Location

Docker-related files are located in:

`deploy/docker/`

---

## Quick Start (Docker Compose)

### 1) Create your local environment file

```bash
cp deploy/docker/.env.example deploy/docker/.env
```

### 2) Build and run

```bash
docker compose -f deploy/docker/docker-compose.yml --env-file deploy/docker/.env up -d --build
docker ps
```

### 3) Verify

```bash
curl -i http://localhost:5001/health
```

### 4) Stop

```bash
docker compose -f deploy/docker/docker-compose.yml --env-file deploy/docker/.env down
```

---

## Ports

- Container port: **3002**
- Docker Compose host port: **5001**

Health check endpoint:

`http://localhost:5001/health`

---

## Local Development (Without Docker)

### Install dependencies

```bash
npm ci
```

### Run locally

```bash
npm run dev
```

### Run tests

```bash
npm run test:unit
npm run test:integration
```

---

## Kubernetes Deployment

Kubernetes manifests are structured using **Kustomize**:

`k8s/order-service/`

- `base/`
- `overlays/dev/`
- `overlays/staging/`
- `overlays/prod/`

### Namespaces

- `dev`
- `staging`
- `prod`

Create namespaces:

```bash
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace prod
```

### Deployment Strategy

- **RollingUpdate**
- `readinessProbe` and `livenessProbe` on `/health`
- Resource requests/limits configured
- Replica count:
  - dev: 1
  - staging: 2
  - prod: 2

### Apply Overlay (Example: Dev)

```bash
kubectl kustomize k8s/order-service/overlays/dev | kubectl -n dev apply -f -
```

### Smoke Test (Ingress via Port Forward)

If you use ingress host routing (recommended), you can test via port-forward:

```bash
kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 18080:80
curl -H "Host: order-dev.local" http://127.0.0.1:18080/health
```

---

## CI/CD Pipeline (Jenkins)

This service uses a Jenkins Multibranch Pipeline with environment-aware deployment.

### Branch / Trigger Strategy

- `feature/*` → Validation only (lint/tests/SonarQube/Docker build/security scan), **no deploy**
- `develop` → Deploy to **DEV** namespace
- `release/*` → Release-candidate validation only (**no deploy**)
- `main` → Deploy to **STAGING** namespace
- Git tag `vX.Y.Z` → Deploy to **PROD** (manual approval required)

### Optional pipeline overrides (useful for testing)

Some pipelines support parameters for safe testing:

- `FORCE_ENV`: `auto|build|rc|dev|staging|prod`
- `FORCE_IMAGE_TAG`: override the computed image tag

> Tip: `FORCE_ENV=dev` lets you test deploy stages without needing to merge to `develop`.

### Image Tagging Strategy

- `dev-<BUILD_NUMBER>`
- `staging-<BUILD_NUMBER>`
- `vX.Y.Z` (production)
- `latest` (production only)

### Terraform outputs integration (Infra → Service pipeline)

The pipeline can copy infra outputs artifacts from the Terraform infra job (example Jenkins job path):

- `terraform-infra/main`

Infra pipeline should archive:

- `infra-outputs.json`
- `infra-outputs-dev.json`
- `infra-outputs-staging.json`
- `infra-outputs-prod.json`

This service pipeline:

- prefers `infra-outputs-<env>.json`
- falls back to `infra-outputs.json`
- then runs `deploy/ci/load-infra-outputs.sh` to export:
  - `KUBE_CONTEXT`
  - `INGRESS_NS`
  - `INGRESS_SVC`

### Deployment Flow

1. Build container image
2. Run Docker Scout security scan (notify-only policy)
3. Push image to Docker Hub (only for dev/staging/prod)
4. Fetch Terraform outputs artifact for target env
5. Apply Kubernetes overlay for environment
6. Inject image tag via `kubectl set image`
7. Wait for rollout
8. Run smoke test against `/health` via ingress port-forward

---

## CI helper scripts

This repo includes reusable CI scripts under:

`deploy/ci/`

Recommended scripts:

- `deploy/ci/load-infra-outputs.sh` — reads `infra-outputs.json` and exports env vars for kubectl/ingress
- `deploy/ci/smoke-test-ingress.sh` — ingress port-forward + Host-header smoke test (CI-safe)

Example local usage:

```bash
# assumes infra-outputs.json is present in repo root (copied from infra pipeline)
chmod +x deploy/ci/load-infra-outputs.sh deploy/ci/smoke-test-ingress.sh
eval "$(./deploy/ci/load-infra-outputs.sh)"

kubectl config use-context "$KUBE_CONTEXT"
./deploy/ci/smoke-test-ingress.sh "order-dev.local" "/health"
```

---

## Testing Strategy

- **Unit tests**: validate business logic
- **Integration tests**: validate API routes
- **Smoke tests**: validate container boot + K8s deployment health

---

## Security Scanning (Docker Scout)

The container image is scanned for known vulnerabilities using **Docker Scout**.

Policy:

- Notify-only
- Critical/High severity issues reported
- Pipeline does **not** fail for upstream base image vulnerabilities

Mitigations:

- Use official base images
- Keep runtime image minimal
- Update dependencies regularly
- Rescan after rebuilds

---

## Environment Variables

Supported variables:

- `PORT` (default: `3002`)

If database integration is enabled:

- `DB_HOST`
- `DB_PORT` (default: `5432`)
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

---

## Maintainer Notes

- Kubernetes overlays control per-environment configuration.
- Jenkins injects the build-specific image tag during deployment.
- Production deploys require manual approval.
- Ingress host-based routing is used per environment (`order-dev.local`, `order-staging.local`, `order-prod.local`).
