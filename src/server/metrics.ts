import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

// globalThis guard: mirrors the PrismaClient singleton pattern in src/server/db/db.ts.
// Next.js hot-reloads re-evaluate modules in dev mode — without this guard each reload
// would attempt to re-register metrics and throw "A metric with that name has already
// been registered". Storing on globalThis survives module re-evaluation.
const g = globalThis as unknown as {
  metricsRegistry: Registry | undefined;
  externalApiCallsCounter: Counter<'api'> | undefined;
  redisCacheResultsCounter: Counter<'cache_key_prefix' | 'result'> | undefined;
  httpRequestsTotal: Counter<'method' | 'path' | 'status_code'> | undefined;
  httpRequestDuration: Histogram<'method' | 'path'> | undefined;
};

if (!g.metricsRegistry) {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry });

  g.metricsRegistry = registry;

  g.externalApiCallsCounter = new Counter({
    name: 'external_api_calls_total',
    help: 'Number of calls made to external APIs',
    labelNames: ['api'] as const,
    registers: [registry],
  });

  g.redisCacheResultsCounter = new Counter({
    name: 'redis_cache_results_total',
    help: 'Redis cache hit and miss counts',
    labelNames: ['cache_key_prefix', 'result'] as const,
    registers: [registry],
  });

  g.httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests handled',
    labelNames: ['method', 'path', 'status_code'] as const,
    registers: [registry],
  });

  g.httpRequestDuration = new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'path'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [registry],
  });
}

export const register = g.metricsRegistry!;
export const externalApiCallsCounter = g.externalApiCallsCounter!;
export const redisCacheResultsCounter = g.redisCacheResultsCounter!;
export const httpRequestsTotal = g.httpRequestsTotal!;
export const httpRequestDuration = g.httpRequestDuration!;
