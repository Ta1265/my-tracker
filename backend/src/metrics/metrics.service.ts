import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Same metric and label names as frontend/src/server/metrics.ts - Prometheus's `job`
// label distinguishes the two services, so renaming here would break existing Grafana
// dashboards. No globalThis guard: Nest providers are already singletons, so the
// hot-reload re-registration problem the frontend guards against doesn't apply here.
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly externalApiCallsCounter = new Counter({
    name: 'external_api_calls_total',
    help: 'Number of calls made to external APIs',
    labelNames: ['api'] as const,
    registers: [this.registry],
  });

  readonly redisCacheResultsCounter = new Counter({
    name: 'redis_cache_results_total',
    help: 'Redis cache hit and miss counts',
    labelNames: ['cache_key_prefix', 'result'] as const,
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests handled',
    labelNames: ['method', 'path', 'status_code'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'path'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
