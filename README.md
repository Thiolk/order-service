# Order Service

REST API for order management.

------------------------------------------------------------------------

## Architecture Context

This service is part of a containerized microservices-based e-commerce
system:

-   product-service -- Product management API
-   order-service -- Order management API (this repository)
-   ecommerce-frontend -- React frontend served via Nginx
-   database -- PostgreSQL

Each service is versioned, containerized, built independently, and
deployed via Kubernetes. CI/CD is implemented using a Jenkins
Multibranch Pipeline with environment-aware deployments.

------------------------------------------------------------------------

## Version

-   Current release: 2.0.0

------------------------------------------------------------------------

## Versioning

This service follows Semantic Versioning (SemVer):

MAJOR.MINOR.PATCH

-   MAJOR: breaking API changes
-   MINOR: new features (backwards compatible)
-   PATCH: bug fixes

Production releases are triggered via Git tags (e.g., v2.0.0).

------------------------------------------------------------------------

## Prerequisites

-   Docker
-   Docker Compose
-   Node.js (for local development)
-   Kubernetes (Minikube for local cluster testing)
-   kubectl
-   Jenkins (for CI/CD)

------------------------------------------------------------------------

## Docker Files Location

Docker-related files are located in:

deploy/docker/

------------------------------------------------------------------------

## Quick Start (Docker Compose)

### 1) Create your local environment file

``` bash
cp deploy/docker/.env.example deploy/docker/.env
```

### 2) Build and run

``` bash
docker compose -f deploy/docker/docker-compose.yml --env-file deploy/docker/.env up -d --build
docker ps
```

### 3) Verify

``` bash
curl -i http://localhost:5001/health
```

### 4) Stop

``` bash
docker compose -f deploy/docker/docker-compose.yml --env-file deploy/docker/.env down
```

------------------------------------------------------------------------

## Ports

-   Container port: 3002
-   Docker Compose host port: 5001

Health check endpoint:

http://localhost:5001/health

------------------------------------------------------------------------

## Local Development (Without Docker)

### Install dependencies

``` bash
npm ci
```

### Run locally

``` bash
npm run dev
```

### Run tests

``` bash
npm run test:unit
npm run test:integration
```

------------------------------------------------------------------------

## Kubernetes Deployment

Kubernetes manifests are structured using Kustomize.

k8s/order-service/ base/ overlays/ dev/ staging/ prod/

### Namespaces

-   dev
-   staging
-   prod

Create namespaces:

``` bash
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace prod
```

### Deployment Strategy

-   RollingUpdate
-   readinessProbe and livenessProbe on /health
-   Resource requests and limits configured
-   Replica count:
    -   dev: 1
    -   staging: 2
    -   prod: 2

### Apply Overlay (Example: Dev)

``` bash
kubectl kustomize k8s/order-service/overlays/dev | kubectl -n dev apply -f -
```

### Smoke Test (Ingress via Port Forward)

``` bash
kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 18080:80
curl -H "Host: order-dev.local" http://127.0.0.1:18080/health
```

------------------------------------------------------------------------

## CI/CD Pipeline (Jenkins)

This service uses a Jenkins Multibranch Pipeline with environment-aware
deployment.

### Branch Strategy

-   feature/\* → Validation only (lint, tests, SonarQube, Docker build,
    security scan)
-   develop → Deploy to DEV namespace
-   release/\* → Staging candidate validation only
-   main → Deploy to STAGING namespace
-   git tag (vX.Y.Z) → Deploy to PROD (manual approval required)

### Image Tagging Strategy

-   dev-`<BUILD_NUMBER>`{=html}
-   staging-`<BUILD_NUMBER>`{=html}
-   vX.Y.Z (production)
-   latest (production only)

### Deployment Flow

1.  Build container image
2.  Run Docker Scout security scan (notify-only policy)
3.  Push image to Docker Hub
4.  Apply Kubernetes overlay for environment
5.  Inject image tag via kubectl set image
6.  Wait for rollout
7.  Run smoke test against /health endpoint

------------------------------------------------------------------------

## Testing Strategy

-   Unit tests: validate business logic
-   Integration tests: validate API routes
-   Smoke tests: validate container boot and K8s deployment health

All tests must pass before image push.

------------------------------------------------------------------------

## Security Scanning (Docker Scout)

The container image is scanned for known vulnerabilities using Docker
Scout.

Policy:

-   Notify-only
-   Critical and High severity issues reported
-   Pipeline does NOT fail for upstream base image vulnerabilities

We mitigate risk by:

-   Using official base images
-   Keeping runtime image minimal
-   Updating dependencies regularly
-   Rescanning after rebuilds

------------------------------------------------------------------------

## Environment Variables

Supported variables:

-   PORT (default: 3002)

If database integration is enabled:

-   DB_HOST
-   DB_PORT (default: 5432)
-   DB_NAME
-   DB_USER
-   DB_PASSWORD

------------------------------------------------------------------------

## Maintainer Notes

-   Kubernetes overlays control image tags per environment.
-   Jenkins injects the build-specific image tag during deployment.
-   Production deploys require manual approval.
-   Ingress host-based routing is used per environment.
