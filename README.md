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

- Current release: **2.3.1**

---

## Versioning

This service follows **Semantic Versioning (SemVer)**:

MAJOR.MINOR.PATCH

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

deploy/docker/

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

http://localhost:5001/health

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

k8s/order-service/

- base/
- overlays/dev/
- overlays/staging/
- overlays/prod/

### Namespaces

- dev
- staging
- prod

Create namespaces:

```bash
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace prod
```

### Deployment Strategy

- RollingUpdate
- readinessProbe and livenessProbe on `/health`
- Resource requests/limits configured

Replica count:

| Environment | Replicas |
| ----------- | -------- |
| dev         | 1        |
| staging     | 2        |
| prod        | 2        |

### Apply Overlay (Example: Dev)

```bash
kubectl kustomize k8s/order-service/overlays/dev | kubectl -n dev apply -f -
```

### Smoke Test (Ingress via Port Forward)

```bash
kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 18080:80
curl -H "Host: order-dev.local" http://127.0.0.1:18080/health
```

---

## CI/CD Pipeline (Jenkins)

This service uses a Jenkins Multibranch Pipeline with environment-aware deployment.

### Branch / Trigger Strategy

| Branch         | Behavior                                                   |
| -------------- | ---------------------------------------------------------- |
| feature/\*     | Validation only (lint/tests/SonarQube/build/security scan) |
| develop        | Deploy to DEV namespace                                    |
| release/\*     | Release-candidate validation only                          |
| main           | Deploy to STAGING namespace                                |
| Git tag vX.Y.Z | Deploy to PROD (manual approval required)                  |

---

## Image Tagging Strategy

| Environment | Tag Format             |
| ----------- | ---------------------- |
| dev         | dev-<BUILD_NUMBER>     |
| staging     | staging-<BUILD_NUMBER> |
| prod        | vX.Y.Z + latest        |

---

## Terraform Outputs Integration

Expected artifacts:

infra-outputs.json  
infra-outputs-dev.json  
infra-outputs-staging.json  
infra-outputs-prod.json

The pipeline:

1. Downloads outputs from the Terraform job
2. Prefers env-specific outputs
3. Falls back to infra-outputs.json
4. Loads variables via deploy/ci/load-infra-outputs.sh

Variables exported:

- KUBE_CONTEXT
- INGRESS_NS
- INGRESS_SVC

---

## Deployment Flow

1. Build container image
2. Run Docker Scout security scan
3. Push image to Docker Hub
4. Fetch Terraform outputs artifact
5. Apply Kubernetes overlay
6. Inject image tag via kubectl set image
7. Wait for rollout completion
8. Run ingress smoke test against /health

---

## CI Helper Scripts

Reusable CI scripts are located in:

deploy/ci/

Important scripts:

- deploy/ci/load-infra-outputs.sh
- deploy/ci/smoke-test-ingress.sh

---

## Testing Strategy

- Unit tests — validate business logic
- Integration tests — validate API routes
- Smoke tests — validate container boot and Kubernetes deployment health

---

## Security Scanning (Docker Scout)

The container image is scanned for vulnerabilities using Docker Scout.

Policy:

- Notify-only
- Critical and High severity vulnerabilities reported
- Pipeline does NOT fail for upstream base image issues

Mitigation approach:

- Use official base images
- Keep runtime images minimal
- Update dependencies regularly
- Rebuild and rescan images periodically

---

## Environment Variables

PORT (default: 3002)

If database integration is enabled:

- DB_HOST
- DB_PORT (default: 5432)
- DB_NAME
- DB_USER
- DB_PASSWORD
