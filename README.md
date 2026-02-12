# Order Service

REST API for order management.

## Version
- Current release: 1.0.0

## Prerequisites
- Docker


## Build (Docker)

From the repo root:

```bash
docker build -t order-service:local -f Dockerfile .
```

## Run (Docker)

### Port mapping
The Order Service listens on port 3002 inside the container (per startup logs). To access it on your laptop at localhost:5001, map:
host 5001 → container 3002

### Run Command
```bash
docker run -e PORT=3002 -p 5001:3002 order-service:local
```

### Verify
```bash
curl -i http://localhost:5001/health
```

## Configuration (Env Variables)
you may configure:
- PORT (default: 3002)
- DB_HOST
- DB_PORT (default: 5432)
- DB_NAME
- DB_USER
- DB_PASSWORD