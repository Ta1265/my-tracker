# Story 5.9: Metrics - Prometheus registry and the guarded scrape endpoint

Status: Done

## Context

Self-contained and dependency-free (PRD: "it can move earlier if wanted" - it is kept
last among the domain stories here only because the PRD lists it that way; nothing in
this epic depends on it and it depends on nothing else in this epic). Follows story
5.2's `@Res({ passthrough: false })` carve-out pattern for the plain-text response
(architecture D22's second named carve-out, after 5.2's bare-JSON-string one) - this is
the other place `AllExceptionsFilter` must never run, since a `403` here is plain text
`Forbidden`, not `{ error: 'Forbidden' }`.

Per architecture F3: `http_requests_total` and `http_request_duration_ms` are
registered in `frontend/src/server/metrics.ts` today but **never incremented or
observed anywhere in `src/`** - `src/middleware.ts`'s own comment explains why
(prom-client cannot run on Edge, and per-route instrumentation was never written). This
means the backend's versions of these two metrics have no existing values to be at
parity *with*. **Record this as an additive divergence, not a parity gap** - do not
spend time hunting for a frontend series to diff against; there isn't one.

## Acceptance Criteria

### A. Metrics registry

- [x] Add `prom-client` to `backend/package.json` (match the frontend's `^15.1.3`).
- [x] `backend/src/metrics/metrics.service.ts` - `@Injectable()`, mirrors
      `frontend/src/server/metrics.ts`'s registry shape (no `globalThis` guard needed
      here - Nest providers are already singletons, so the hot-reload-re-registration
      problem the frontend's guard exists for doesn't apply): a `Registry`,
      `collectDefaultMetrics({ register })`, and four metrics with **identical names and
      label names** to the frontend (architecture D31 - Prometheus's `job` label is what
      distinguishes the two services; renaming would break existing Grafana dashboards):
      - `external_api_calls_total` (Counter, labels `api`)
      - `redis_cache_results_total` (Counter, labels `cache_key_prefix`, `result`)
      - `http_requests_total` (Counter, labels `method`, `path`, `status_code`)
      - `http_request_duration_ms` (Histogram, labels `method`, `path`, buckets `[5, 10,
        25, 50, 100, 250, 500, 1000]`)
      Expose the registry and each counter/histogram as readonly properties or getters
      for other services to inject and increment.
- [x] **Wire `http_requests_total`/`http_request_duration_ms` for real, via a Nest
      interceptor** (architecture: "implemented properly in the backend via a Nest
      interceptor," making the backend's metrics "strictly better than the frontend's" -
      this is the one place this epic adds an FR-16 behavior the old stack never had,
      not a port). `backend/src/common/interceptors/http-metrics.interceptor.ts`,
      applied globally in `main.ts` (`app.useGlobalInterceptors(...)`), records the
      method/path/status/duration for every request. Use the matched route path (e.g.
      `request.route?.path`), not the raw URL, so `path` doesn't explode into one label
      series per `:id`/`:unit` value.
- [x] Wire `redis_cache_results_total` at every Redis cache check this epic already
      built: story 5.2's `getPriceHistoryForTimeFrame` cache hit/miss, story 5.4's
      `checkCoverage`/`setEntry`, story 5.6's `profitLossChart` cache hit/miss - each
      calls `metricsService.redisCacheResultsCounter.inc({ cache_key_prefix: '...',
      result: 'hit' | 'miss' })` at the point it already checks Redis. This is a small
      retrofit into those stories' already-implemented code (5.2, 5.4, 5.6 all precede
      this story), not new query logic.
- [x] Wire `external_api_calls_total` at story 5.2's `refreshRates()` coinbase call
      (`.inc({ api: 'coinbase' })`, matching `get-exchange-rates.ts:23`).

### B. Guarded scrape endpoint (D22 carve-out)

- [x] `metrics.controller.ts`'s `getMetrics` injects `@Res({ passthrough: false }) res:
      Response` and `MetricsService`, and `AppConfigService` for `metricsSecret`.
      Compares the `Authorization` header for exact equality against `` `Bearer
      ${metricsSecret}` `` (`metrics/route.ts:11`) - if `metricsSecret` is unset or the
      header doesn't match, `res.status(403).type('text/plain').send('Forbidden')`. On a
      match, `res.status(200).set('Content-Type', registry.contentType).send(await
      registry.metrics())`. Change the method's return type to `Promise<void>` since the
      response is written manually - **do not throw `ForbiddenException()`** for the
      mismatch case; `AllExceptionsFilter` would reshape it to `{ error: 'Forbidden' }`,
      an object, not the plain-text FR-5 pins.
- [x] `MetricsModule` registers `MetricsService` in `providers`.

### C. Prometheus scrape config

- [x] `monitoring/prometheus.yml` gains a second `scrape_configs` entry: `job_name:
      nestjs-backend`, target `nest-api:3001`, `metrics_path: /backend/api/metrics`,
      the same `${METRICS_SECRET}` bearer credential the existing `nextjs-app` entry
      uses (`monitoring/prometheus.yml:6-14` is the template - copy its shape, change
      `job_name`, `targets`, and `metrics_path`).

### D. Parity and regression

- [x] Functional check (not NFR-4 parity - there is no old-backend series to diff
      `http_requests_total`/`http_request_duration_ms` against, per F3): `GET
      /backend/api/metrics` with a correct bearer token returns `200` Prometheus text
      exposition format including all four custom metrics plus the default
      `collectDefaultMetrics` output; with a missing/wrong token, `403` plain text
      `Forbidden`. Confirm `Content-Type` on both responses (`text/plain` on the `403`,
      the registry's own content type on the `200` - not `application/json` on either).
- [~] `docker compose up -d --build` brings up the full stack; confirm Prometheus's own
      targets page (`http://localhost:9090/targets` or equivalent, per
      `monitoring/prometheus.yml`'s existing access pattern) shows `nestjs-backend` as
      `UP` alongside the existing `nextjs-app` target. **Partially verified - see Dev
      Notes "Prometheus target health" below**: the `nestjs-backend` job was added and
      appears in the target list, and its target is reachable and answers correctly
      when queried with the real secret directly, but the target page shows both
      `nestjs-backend` and the pre-existing `nextjs-app` as `down`/`403` for a shared,
      pre-existing reason unrelated to this story's code.
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.

## Technical Notes

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `metrics` section. Live
source: `frontend/src/server/metrics.ts`, `frontend/src/app/api/metrics/route.ts`,
`monitoring/prometheus.yml`.

### `MetricsController` stub already in place

`backend/src/metrics/metrics.controller.ts` already carries `@ApiSecurity('metrics-secret')`
and both `@ApiResponse` blocks (200 text/plain, 403 text/plain) from story 2.8 - no
Swagger change is expected, only the real handler body.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build
curl -sk -H "Authorization: Bearer $METRICS_SECRET" https://www.tubesock.xyz/backend/api/metrics --resolve www.tubesock.xyz:443:127.0.0.1
curl -sk -o /dev/null -w '%{http_code}\n' https://www.tubesock.xyz/backend/api/metrics --resolve www.tubesock.xyz:443:127.0.0.1
# functional checks per AC D, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- Any change to the frontend's own `/api/metrics` route or `src/server/metrics.ts` -
  GR-1, and both keep serving their existing (unfired) `http_requests_total`/
  `http_request_duration_ms` registrations unchanged.
- Redesigning observability generally - explicitly out of scope per the PRD.
- The full-surface parity sweep - story 5.10.

## Dev Notes

### `http_requests_total`/`http_request_duration_ms` recorded on the response's `finish` event, not via `tap`

`HttpMetricsInterceptor` records on `response.on('finish', ...)` rather than piping
`next.handle()` through an rxjs `tap`. Nest's own response controller (or
`AllExceptionsFilter`, on a thrown error) sets the final `status_code` *after* the
interceptor's returned observable resolves, so a `tap` callback would read whatever
status Express defaulted to (200) rather than the real one - wrong for non-200
successes (e.g. a future `@HttpCode(201)`) and for every error path. `finish` fires once
the response is actually flushed, on every outcome, so it is correct.

For the unmatched-route case (no `request.route`, e.g. a 404 from scanner traffic) the
interceptor labels `path: 'unmatched'` rather than the raw URL, since the raw URL is
exactly the per-value cardinality explosion the "use the matched route path" instruction
exists to avoid.

### Redis cache metric label values

`cache_key_prefix: 'price_history'` is used for both `exchangeRatesService.
getPriceHistoryForTimeFrame` and `priceHistoryService.checkCoverage` - both read/check
the same `time-frame-pl-{timeFrame}-coinName-{coin}` cache key namespace (confirmed at
`exchange-rates.service.ts:10-28` and `price-history.service.ts:29-30`), so they share
one label value rather than inventing two prefixes for one cache. `getProfitLossChart`
uses `cache_key_prefix: 'net_cash_flow_history'`, matching its own `net-cash-flow-
history-{userId}-{timeFrame}` key. Neither prefix existed in the frontend before this
story - only `get-exchange-rates.ts`'s hit/miss pair was ever wired there - so both are
additive, matching F3's framing for the HTTP metrics.

### `setEntry` is not instrumented with a hit/miss increment

The AC groups `checkCoverage`/`setEntry` together as the "5.4" wiring point, but only
`checkCoverage` performs an actual Redis read (`redis.exists`, per time frame) that a
hit/miss result can attach to. `setEntry` (`price-history.service.ts:40-58`) is a
straight `setex` write with no preceding existence check - adding one purely to produce
a metric would be new query logic, which the AC's own "not new query logic" line rules
out. No increment was added there.

### Prometheus target health

`nestjs-backend` was added to `monitoring/prometheus.yml` copying `nextjs-app`'s exact
shape, including its `authorization: { type: Bearer, credentials: '${METRICS_SECRET}'
}` block, per the story's explicit instruction. After `docker compose up -d --build`
and a `prometheus` restart (needed to pick up the mounted config change),
`http://localhost:9090/api/v1/targets` lists **both** `nestjs-backend` and `nextjs-app`
as `down`, both with `lastError: "server returned HTTP status 403 Forbidden"` - not a
regression introduced here. Prometheus's `--enable-feature=expand-external-labels` flag
(the only relevant feature flag `prom/prometheus:v2.51.0` ships) only expands env vars
in `global.external_labels`, not in `scrape_configs[].authorization.credentials`; there
is no other substitution mechanism in this compose stack (no entrypoint wrapper, no
`envsubst` step), so Prometheus sends the literal string `${METRICS_SECRET}` as the
bearer token to both targets, which never matches either service's real secret. This
predates this story - `nextjs-app`'s target was already broken this way before any file
in this story was touched.

Confirmed the new endpoint itself is correct and reachable, independent of Prometheus's
broken credential injection: `docker exec prometheus wget --header="Authorization:
Bearer $METRICS_SECRET" http://nest-api:3001/backend/api/metrics` (using the real
secret value directly, sourced from `docker exec nest-api printenv METRICS_SECRET`,
which matches `docker exec prometheus printenv METRICS_SECRET`) returns the full
Prometheus exposition text. The scrape config itself (job name, target, `metrics_path`)
is correct; only the shared credential-templating mechanism is broken.

This is a pre-existing, cross-service infrastructure bug, not something this story's
code can fix without also rewriting how `monitoring/prometheus.yml`'s secret is
injected (an `envsubst`-on-boot wrapper, a `credentials_file`, or similar) for **both**
scrape configs - which is a `docker-compose.yml`/deployment change spanning both
services, not a metrics-endpoint change, and squarely inside this story's own "out of
scope: redesigning observability generally." Flagging it for the owner to decide whether
it's worth its own follow-up story; recommend one, since right now neither service's
metrics are actually reachable by Prometheus in this environment.

### Changed Files

+ backend/src/metrics/metrics.service.ts               `Registry` plus the four D31 metrics (`external_api_calls_total`, `redis_cache_results_total`, `http_requests_total`, `http_request_duration_ms`), mirroring `frontend/src/server/metrics.ts` without the hot-reload `globalThis` guard
+ backend/src/common/interceptors/http-metrics.interceptor.ts   global interceptor recording method/path/status/duration for every request via `response.on('finish')`
~ backend/src/metrics/metrics.controller.ts             real handler: `@Res({ passthrough: false })` D22 carve-out, bearer-token check against `AppConfigService.metricsSecret`, plain-text `403`/Prometheus-text `200`
~ backend/src/metrics/metrics.module.ts                 `@Global()`, registers/exports `MetricsService` so exchange-rates/price-history/summary and the global interceptor can inject it without an explicit module import
~ backend/src/main.ts                                   registers `HttpMetricsInterceptor` via `app.useGlobalInterceptors(...)`
~ backend/src/exchange-rates/exchange-rates.service.ts  wires `external_api_calls_total` at the Coinbase call in `refreshRates()`; wires `redis_cache_results_total` (`price_history` hit/miss) in `getPriceHistoryForTimeFrame`
~ backend/src/price-history/price-history.service.ts    wires `redis_cache_results_total` (`price_history` hit/miss) in `checkCoverage`'s per-time-frame existence check
~ backend/src/summary/summary.service.ts                wires `redis_cache_results_total` (`net_cash_flow_history` hit/miss) in `getProfitLossChart`
~ backend/package.json                                  adds `prom-client ^15.1.3`
~ pnpm-lock.yaml                                         lockfile entry for the new `prom-client` dependency
~ monitoring/prometheus.yml                              adds the `nestjs-backend` scrape config (`nest-api:3001`, `/backend/api/metrics`, same bearer credential shape as `nextjs-app`)

### Verification

```
$ pnpm --filter @portfolio/backend typecheck
$ tsc --noEmit -p tsconfig.json
(no output - passed)

$ pnpm --filter @portfolio/backend lint
$ eslint "{src,test}/**/*.ts"
backend/src/main.ts 34:1  warning  no-floating-promises on bootstrap() - pre-existing, untouched by this story
✖ 1 problem (0 errors, 1 warning)

$ pnpm --filter @portfolio/backend build
$ nest build
(no output - passed)

$ docker compose up -d --build
(full stack rebuilt and started cleanly; nest-api log shows MetricsController mapped at
GET /backend/api/metrics)

$ curl -sk -H "Authorization: Bearer $METRICS_SECRET" https://www.tubesock.xyz/backend/api/metrics --resolve www.tubesock.xyz:443:127.0.0.1 -D -
HTTP/2 200
content-type: text/plain; charset=utf-8; version=0.0.4
(body: 70 HELP/TYPE lines including external_api_calls_total, redis_cache_results_total,
http_requests_total, http_request_duration_ms, and the full collectDefaultMetrics set
such as process_cpu_user_seconds_total, nodejs_eventloop_lag_seconds, etc.)

$ curl -sk -o /dev/null -w '%{http_code}\n' https://www.tubesock.xyz/backend/api/metrics --resolve www.tubesock.xyz:443:127.0.0.1
403

$ curl -sk -D - https://www.tubesock.xyz/backend/api/metrics --resolve www.tubesock.xyz:443:127.0.0.1  (no Authorization header)
HTTP/2 403
content-type: text/plain; charset=utf-8
(body: "Forbidden", exactly - not `{"error":"Forbidden"}`)

# AC D functional checks: interceptor wiring
$ curl -sk https://www.tubesock.xyz/backend/api/health ...   # 200
$ curl -sk -H "Authorization: Bearer $METRICS_SECRET" .../metrics | grep '^http_requests_total\|^http_request_duration_ms'
http_requests_total{method="GET",path="/backend/api/metrics",status_code="200"} 1
http_requests_total{method="GET",path="/backend/api/health",status_code="200"} 1
http_request_duration_ms_count{method="GET",path="/backend/api/metrics"} 1
http_request_duration_ms_count{method="GET",path="/backend/api/health"} 1
(matched-route paths, not raw URLs; confirms the interceptor fires for every request)

# AC A functional checks: external_api_calls_total / redis_cache_results_total wiring
$ curl -sk https://www.tubesock.xyz/backend/api/exchange-rates/unit/BTC ...   # 200 (runs refreshRates())
$ curl -sk -H "Authorization: Bearer $METRICS_SECRET" .../metrics | grep external_api_calls_total
external_api_calls_total{api="coinbase"} 1

$ curl -sk https://www.tubesock.xyz/backend/api/exchange-rates/d/testcoinnotcached ...   # 500 (pre-existing "Cache miss" throw, unrelated to this story)
$ curl -sk -H "Authorization: Bearer $METRICS_SECRET" .../metrics | grep redis_cache_results_total
redis_cache_results_total{cache_key_prefix="price_history",result="miss"} 1
(checkCoverage and getProfitLossChart wiring verified by code inspection only - both
require an authenticated session and the AC does not gate a separate curl-based
functional check on them; the counter mechanics are the same code path already proven
above)

# AC C/D Prometheus target check - see "Prometheus target health" above for the full
# finding. Summary: nestjs-backend job present in /api/v1/targets, but both it and the
# pre-existing nextjs-app job show down/403 due to a shared, pre-existing credential-
# substitution bug in monitoring/prometheus.yml, unrelated to this story's code.
$ docker compose restart prometheus && curl -s http://localhost:9090/api/v1/targets
(nestjs-backend and nextjs-app both listed; both health="down", lastError="server
returned HTTP status 403 Forbidden")

$ docker exec prometheus printenv METRICS_SECRET
$ docker exec nest-api printenv METRICS_SECRET
(identical values - confirms the 403 is a config-templating bug, not a secret mismatch)
$ docker exec prometheus wget -qO- --header="Authorization: Bearer <real secret>" http://nest-api:3001/backend/api/metrics
(full Prometheus exposition text returned - endpoint itself works correctly)

$ docker compose up -d --build nest-api && docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
(empty - no change, as expected: only the handler body changed, not the Swagger
contract, which story 2.8 already documented in full)
```
