# Distributed Build Architecture

## Overview

Ralph uses BullMQ for job queuing. Multiple workers can process builds in parallel simply by pointing to the same Redis instance — no code changes needed.

```
[GitHub Webhook / API]
         ↓
    server.js (1 instance)
         ↓
    Redis (BullMQ queue)
    ↙      ↓       ↘
worker1  worker2  worker3
  ↓        ↓        ↓
pipeline pipeline pipeline
  ↓        ↓        ↓
GCS      GCS      GCS    ← build outputs
  ↓        ↓        ↓
      SQLite (shared)     ← build records
```

## Scaling Options

### Option 1: Single machine, multiple workers (simplest)
```bash
# Terminal 1
RALPH_WORKER_ID=w1 node worker.js

# Terminal 2
RALPH_WORKER_ID=w2 node worker.js
```
Each worker picks up jobs from the shared Redis queue. SQLite is shared on the same filesystem.

### Option 2: Docker Compose scaled workers
```bash
docker compose -f docker-compose.scale.yml up --scale worker=3
```
3 worker containers, each with RALPH_CONCURRENCY=1, processing builds in parallel.

### Option 3: Multiple GCP VMs
- VM 1: server.js + Redis + worker
- VM 2+: worker only (REDIS_URL pointing to VM 1's Redis)
- All VMs: RALPH_WAREHOUSE_DIR pointing to same GCS-mounted directory (or copy templates at startup)
- SQLite limitation: only works for single-machine. For multi-VM, use PostgreSQL (future work).

## Resource Requirements Per Worker

| Component | RAM | CPU |
|-----------|-----|-----|
| Node.js (pipeline.js) | ~200MB | 0.5 vCPU avg |
| Playwright (chromium) | ~300MB | 1 vCPU peak |
| **Total per build** | **~500MB** | **1-2 vCPU** |

Minimum per worker machine: 2GB RAM, 2 vCPU.

## Constraints

- **SQLite**: Only supports single-machine. Multiple workers on different VMs need PostgreSQL or a shared DB.
- **Warehouse templates**: Must be readable by all workers. Use GCS bucket or NFS mount for multi-VM.
- **Build artifacts**: Written to `RALPH_REPO_DIR/data/games/` — needs to be worker-local or shared mount.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `RALPH_WORKER_ID` | Worker identity in logs + DB | Auto-generated UUID |
| `RALPH_CONCURRENCY` | Jobs per worker process | 1 |
| `REDIS_URL` | Shared Redis for all workers | redis://localhost:6379 |
| `RALPH_CPU_GATE` | Pause new jobs if CPU > N% | 85 |
| `RALPH_RAM_GATE_MB` | Pause new jobs if free RAM < NMB | 512 |
