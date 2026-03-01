# Order Service

REST API for order management.

---

## Architecture Context

This service is part of a containerized microservices-based e-commerce
system:

- product-service -- Product management API
- order-service -- Order management API (this repository)
- ecommerce-frontend -- React frontend served via Nginx
- database -- PostgreSQL

Each service is versioned, containerized, and built independently.\
CI/CD is implemented via Jenkins (multibranch pipeline with
environment-aware deployments).

---

## Version

- Current release: 2.0.0

---

## Versioning

This service follows Semantic Versioning (SemVer):

MAJOR.MINOR.PATCH

- MAJOR: breaking API changes
- MINOR: new features (backwards compatible)
- PATCH: bug fixes

Production releases are triggered via Git tags (e.g., v1.1.0).

---

## Prerequisites

- Docker
- Docker Compose
- Node.js (for local development)

---

## Docker Files Location

Docker-related files are located in:

- `deploy/docker/`

---

## Quick Start (Docker Compose)

### 1) Create your local environment file

From the repo root:

```bash
cp deploy/docker/.env.example deploy/docker/.env
```

### 2) Build and run

From the repo root:

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

- Container port: 3002
- Docker Compose host port: 5001

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

## API Endpoints

### Health Check

GET /health

Returns 200 OK if service is running.

### Orders

POST /orders\
GET /orders/:id

(Additional routes are defined in `/src/routes`.)

---

## CI/CD Pipeline

This service uses a Jenkins Multibranch Pipeline with Git Flow.

### Branch Strategy

- feature/\* → Validation only (lint, tests, SonarQube, Docker build,
  security scan)
- develop → DEV environment image push
- release/\* → Staging candidate validation
- main → Staging promotion
- git tag (vX.Y.Z) → Production release (manual approval required)

### Image Tagging Strategy

- dev-`<BUILD_NUMBER>`{=html}
- staging-`<BUILD_NUMBER>`{=html}
- vX.Y.Z (production)
- latest (production only)

---

## Testing Strategy

- Unit tests: validate business logic in isolation
- Integration tests: validate API layer and route behavior
- Smoke test: container boot validation in CI pipeline

All tests must pass before image push.

---

## Configuration (Environment Variables)

You may configure:

- PORT (default: 3002)

If/when database integration is enabled, you may also configure:

- DB_HOST
- DB_PORT (default: 5432)
- DB_NAME
- DB_USER
- DB_PASSWORD

---

## Security Scanning (Docker Scout)

We scan the built order service container image for known CVEs using
Docker Scout.

From the repo root:

### Scan

```bash
chmod +x scripts/security-docker-scout-scan.sh
./scripts/security-docker-scout-scan.sh
```

### Policy / Rationale

The Order Service image is built on the official `node` base image
(Alpine variant).

Vulnerabilities may be reported in:

- the upstream base image packages (OS-level dependencies), and/or
- npm dependencies included in the application image (e.g., `tar`,
  `glob`, `cross-spawn`).

We mitigate this by:

- using an appropriate official base image tag and updating it when
  patches are released
- keeping the runtime image minimal (production dependencies only via
  `npm ci --omit=dev`)
- addressing dependency-level vulnerabilities by updating npm packages
  when fixes are available and rebuilding the image to verify
  improvements
- rescanning regularly to track changes over time

### CI Integration

Docker Scout scanning is also executed in the Jenkins pipeline.

- Policy: Notify-only
- Critical / High severity findings are reported
- Pipeline does NOT fail on upstream base image vulnerabilities
