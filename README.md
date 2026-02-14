# Order Service

REST API for order management.

## Version

- Current release: 1.1.0

## Prerequisites

- Docker + Docker Compose

## Docker Files Location

Docker-related files are located in:

- `deploy/docker/`

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

## Configuration (Environment Variables)

You may configure:

- PORT (default: 3002)
  If/when database integration is enabled, you may also configure:
- DB_HOST
- DB_PORT (default: 5432)
- DB_NAME
- DB_USER
- DB_PASSWORD

## Security Scanning (Docker Scout)

We scan the built order service container image for known CVEs using Docker Scout.

From the repo root:

### Scan

```bash
chmod +x scripts/security-docker-scout-scan.sh
./scripts/security-docker-scout-scan.sh
```

### Policy / Rationale

The Order Service image is built on the official `node` base image (Alpine variant).

Vulnerabilities may be reported in:

- the upstream base image packages (OS-level dependencies), and/or
- npm dependencies included in the application image (e.g., `tar`, `glob`, `cross-spawn`).

We mitigate this by:

- using an appropriate official base image tag and updating it when patches are released
- keeping the runtime image minimal (production dependencies only via `npm ci --omit=dev`)
- addressing dependency-level vulnerabilities by updating npm packages when fixes are available and rebuilding the image to verify improvements
- rescanning regularly to track changes over time
