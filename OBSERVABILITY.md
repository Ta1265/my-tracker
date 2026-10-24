# Observability Stack

This project uses Grafana, Loki, Promtail, and Prometheus for unified log management and metrics collection.

## Starting the Stack

```bash
docker compose up -d
```

This starts all services including the monitoring stack. On first boot Grafana auto-provisions both datasources (Prometheus and Loki) and the Portfolio App dashboard.

## Accessing Grafana

- **URL**: http://localhost:3001
- **Username**: `admin`
- **Password**: value of `GF_SECURITY_ADMIN_PASSWORD` in your `.env` file

The **Portfolio App** dashboard is pre-loaded under **Dashboards** in the left sidebar.

## Dashboard Panels

| Panel | What it shows |
|---|---|
| **Node.js Heap Used** | Current V8 heap allocation for the Next.js process. Sustained growth may indicate a memory leak. |
| **Node.js RSS Memory** | Total resident set size — all memory the process is holding from the OS. |
| **Event Loop Lag** | How delayed the Node.js event loop is. Spikes indicate CPU-intensive synchronous work blocking the loop. |
| **External API Call Rate** | Rate of outbound calls to the Coinbase exchange-rates API, labelled by `api`. Use this to spot excessive polling or retry storms. |
| **Redis Cache Hit Ratio** | Proportion of price-history lookups served from Redis vs falling through to an error. Target is >90%. A sudden drop means Redis keys are expiring too fast or the cache isn't being populated. |
| **Redis Cache Hits vs Misses** | Absolute hit and miss rates over time, broken down by `cache_key_prefix`. |
| **HTTP Request Rate** | Per-path and per-method request throughput through the Next.js app, labelled by `method`, `path`, and `status_code`. |
| **HTTP Latency (p50 / p95)** | Median and 95th-percentile request duration in milliseconds. A rising p95 while p50 stays flat points to outlier-slow requests. |
| **Live Application Logs** | Streaming structured JSON logs from all portfolio containers via Loki. |

## Filtering Logs by IP Address

Client IP addresses are captured in structured log fields (not in Prometheus metric labels, to avoid high cardinality). To filter the **Live Application Logs** panel by a specific IP:

1. Use the **Client IP** text box at the top of the dashboard.
2. Enter an exact IP (`192.168.1.5`) or a regex pattern (`192\.168\.1\.*`).
3. Leave blank or set to `.*` to see all requests.

You can also query Loki directly from the **Explore** view:

```logql
{app="portfolio"} | json | ip="192.168.1.5"
```

IP data flows from nginx → `X-Real-IP` header → Next.js middleware → `x-client-ip` header → server-side logger → Loki.

## Rotating `METRICS_SECRET`

The `METRICS_SECRET` is shared between three consumers across two files and **must be
kept in sync**:

1. `.env` — read by both the Next.js and Nest API containers to validate Bearer tokens on
   their respective `/api/metrics` and `/backend/api/metrics` routes
2. `monitoring/prometheus.yml` — used by Prometheus in both scrape jobs'
   `authorization.credentials` fields

**Rotation steps:**

```bash
# 1. Generate a new secret
openssl rand -hex 32

# 2. Update .env
METRICS_SECRET=<new-secret>

# 3. Update monitoring/prometheus.yml → authorization.credentials for both scrape job
#    entries: nextjs-app (metrics_path: /api/metrics) and nestjs-backend
#    (metrics_path: /backend/api/metrics)

# 4. Restart all three containers
docker compose restart next-app nest-api prometheus
```

> If the secret is mismatched, Prometheus will log `403 Forbidden` scrape errors and metric data will stop flowing to Grafana.

> As long as `monitoring/prometheus.yml` carries the literal `${METRICS_SECRET}` in
> `authorization.credentials`, Prometheus sends that literal string and both jobs return
> `403`/`down`, because the `--enable-feature=expand-external-labels` flag described under
> "Local Development Notes" below does not reach that field. Rotating the secret does not
> by itself produce healthy targets.

## Local Development Notes

### `globalThis` guard in `registry.ts`

Next.js hot-reloads module files in development, which would normally cause `prom-client` to throw:

```
Error: A metric with that name has already been registered: process_cpu_user_seconds_total
```

`src/metrics/registry.ts` uses a `globalThis` guard to keep a single registry instance alive across hot-reloads:

```typescript
const g = globalThis as unknown as { metricsRegistry: Registry | undefined };
if (!g.metricsRegistry) {
  // only register metrics once per process lifetime
}
```

### Middleware and Edge runtime

Next.js middleware runs on the **Edge runtime**, which does not support Node.js-specific packages such as `prom-client`. The middleware therefore only handles auth and extracts the real client IP from `X-Forwarded-For`/`X-Real-IP`, forwarding it via an `x-client-ip` header. The frontend no longer serves API routes of its own, so it exposes only the default process metrics collected in `src/metrics/registry.ts`; per-request HTTP metrics come from the backend.

### Prometheus scrape and `expand-external-labels`

The Prometheus container is started with `--enable-feature=expand-external-labels`, which enables `${VAR}` substitution in `prometheus.yml`. The `METRICS_SECRET` environment variable is passed into the container via `env_file: ./defaults.env` and `./override.env` in `docker-compose.yml`.
