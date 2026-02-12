# Order Service

REST API for order management.

## Version
- Current release: 1.0.0

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