# Scale Configuration Guide

## Single-Node Scaling

| Server Size | RALPH_CONCURRENCY | RAM Required | Notes |
|-------------|-------------------|--------------|-------|
| 2 vCPU / 4GB | 1 | 3GB available | Default; safe for all game types |
| 4 vCPU / 8GB | 2 | 5GB available | 2 parallel builds; monitor RAM |
| 8 vCPU / 16GB | 3 | 10GB available | 3 parallel builds; use resource gate |
| 16 vCPU / 32GB | 4 | 20GB available | Full scale |

**Per-build resource estimate:**
- Playwright (chromium): ~300MB RAM, 1 vCPU peak
- Node.js + LLM streaming: ~200MB RAM
- Total per build: ~500MB RAM, 1 vCPU average
- Peak (5 parallel test runs): ~800MB RAM, 2 vCPU

## Resource Gate Settings

```env
RALPH_CPU_GATE=85        # Pause job start if CPU > 85%
RALPH_RAM_GATE_MB=512    # Pause job start if free RAM < 512MB
```

## Monitoring

System metrics are exported to Prometheus at `/metrics`:
- `ralph_cpu_usage_percent` — 1-second CPU sample
- `ralph_ram_usage_percent` — RAM usage %
- `ralph_ram_used_bytes` — RAM used
- `ralph_disk_usage_percent` — Disk usage % (data directory)

Recommended Grafana alert: `ralph_ram_usage_percent > 90` for 5 minutes → page oncall.
