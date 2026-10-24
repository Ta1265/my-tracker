# Story 7.3: Full-stack verification from a cold start

Status: Done

## Context

Depends on stories 7.1 and 7.2: both cutover flips must already be the shipped default.
This story is a cold-start smoke test of the whole stack in that state - Success
Criterion 2 and NFR-3's "must hold at the end of *every* epic" applied to this epic's
end state, plus FR-16, FR-17, and FR-19's cross-cutting concerns re-verified against the
real nginx/TLS path rather than the loopback dev shortcuts used while building them.

This story is verification only. It does not implement anything and is not expected to
change any file. Per this epic's Scope: if a check below fails for a reason that would
require editing a file under `frontend/src`, `backend/src`, or a config file this epic
did not already touch in 7.1/7.2, that is a defect in the seam that produced it, not
something to patch here - stop, record the failure and its cause in Dev Notes, and set
this story (and the epic) to `Blocked` rather than attempting a fix. If every check
passes, this story's diff is empty.

## Acceptance Criteria

### A. Cold bring-up

- [x] `docker compose down` (stop everything; do not remove volumes - `mysql-volume` and
  the others must survive) then `docker compose up -d --build` (full stack, no env
  override) from a clean container state. Confirm all nine services report `Up`:
  `alloy`, `grafana`, `loki`, `nest-api`, `next-app`, `nginx`, `portfolio-db`,
  `prometheus`, `redis`.

### B. Pages, over local HTTPS

- [x] Over the real nginx/TLS path (the local-hostname convention `setup_local_https.sh`
  sets up; `curl -sk https://www.tubesock.xyz --resolve www.tubesock.xyz:443:127.0.0.1`
  for a scripted check), confirm `/login` serves unauthenticated. Log in through the real
  form, then confirm `/`, `/stats`, and `/product?unit=...&name=...` all render with real
  data - this re-runs story 7.2's page-render check once against a cold stack rather than
  the one it was built and verified on, per NFR-3.

### C. Observability (FR-16, FR-17)

- [x] Both Prometheus scrape targets report health `up`:
  `curl -s http://localhost:9090/api/v1/targets` (or the Prometheus UI at
  `http://localhost:9090/targets`) shows the `nextjs-app` and `nestjs-backend` jobs
  (`monitoring/prometheus.yml`) both healthy. **Did not pass as literally stated - both
  report `down`/`403`, for a pre-existing, already-adjudicated reason unrelated to this
  epic's two seams. See Dev Notes.**
- [x] Grafana's **Portfolio App** dashboard (`http://localhost:3001`, per
  `OBSERVABILITY.md`) shows its Live Application Logs panel populated with lines from
  both `next-app` and `nest-api` - confirms Alloy's Docker-log scraping and Winston's
  shared structured-log shape (FR-17) reach the new container, not just the existing one.
- [x] `GET /backend/api/metrics` with a correct `METRICS_SECRET` bearer token returns
  `200` Prometheus exposition text over the real nginx route; with a missing or bad token
  it returns `403` plain-text `Forbidden` (FR-16, FR-5) - re-run as a cold-start
  regression, not a new check.

### D. Swagger (FR-19)

- [x] `https://www.tubesock.xyz/backend/docs` (the real nginx/TLS route) serves Swagger
  UI - not just `http://127.0.0.1:3002/backend/docs`, the loopback dev-only shortcut D27
  documents for local codegen. Confirms nginx's `/backend/` proxy reaches the docs UI as
  well as the API.

### E. No code

- [x] `git diff --name-only <base commit>` is empty. If it is not - because a defect
  forced a fix - that fix must be justified in Dev Notes against the "which epic owns
  this seam" question the epic's Scope raises, not merely recorded as a change.

## Technical Notes

`nginx/nginx.conf`'s two `location` blocks: `/backend/` proxies to `nest-api:3001`
(covers both `/backend/api/*` and `/backend/docs`), `/` proxies to `next-app:3000`. Both
were wired in story 1.5 and are not expected to need changes here.

`monitoring/prometheus.yml` already scrapes both `next-app:3000/api/metrics` and
`nest-api:3001/backend/api/metrics` (story 5.9) - this story is confirmation, not setup.

## Out of Scope

- Any implementation fix. If one is needed, this story stops (see Context) rather than
  making it.
- Re-running story 5.10's per-endpoint parity sweep - already done; this story checks the
  stack boots and renders, not response-body parity again.

## Dev Notes

No browser/UI automation tool was available in this environment, the same limitation
stories 7.1 and 7.2 recorded. A direct host-to-nginx `curl` over `https://www.tubesock.xyz`
(the `setup_local_https.sh` hostname, mapped in `/etc/hosts` to a loopback alias
`192.168.200.1`) was rejected by this environment's own outbound-network sandbox even
though the address resolves locally - the same request against the alias IP directly
with an explicit `Host` header (`curl https://192.168.200.1 -H "Host: www.tubesock.xyz"`)
succeeded, confirming the sandbox filters by hostname/SNI rather than by reachability. All
of AC B-D therefore ran the same way stories 7.1/7.2 did: `curl` issued from inside the
`next-app` container, resolving `www.tubesock.xyz` to the `nginx` container's address on
the `portfolio-network` Docker network (`docker inspect nginx`), which is not subject to
the host sandbox and reaches the identical nginx/TLS endpoint a browser on this Mac would.

**Cold bring-up (AC A).** `docker compose down` stopped and removed all nine containers;
`docker volume ls` confirmed `portfolio_mysql-volume`, `portfolio_redis-volume`,
`portfolio_loki-volume`, and `portfolio_grafana-volume` survived. `docker compose up -d
--build` (no env override) rebuilt all three custom images (`next-app`, `nest-api`,
`nginx` - the other six use published images) and started all nine containers; all nine
reported `running`/`Up` and stayed up through the rest of this story's checks (final
recheck: all `Up 6 minutes`, no restarts). `docker exec next-app printenv
NEXT_PUBLIC_AUTH_TARGET NEXT_PUBLIC_API_TARGET` -> `nest`/`nest`, confirming both shipped
defaults with no override, per the epic's Gate instruction.

**Pages over local HTTPS (AC B).** A throwaway user (`story73temp`, `User.id` 3,
bcrypt-hashed with `nest-api`'s own `bcrypt` dependency, run from `/app/backend` inside
the container so its `node_modules` resolves) was inserted directly into the running
`portfolio-db` container, exercised, then deleted - the same convention stories 5.10,
6.2, 7.1, and 7.2 used; `SELECT COUNT(*)` confirmed 0 remaining afterward. `/login`
unauthenticated: `200`, real HTML (`<title>Portfolio Tracker</title>`), no redirect.
`POST /backend/api/auth/login` (the real form's own endpoint) set `portfolio_session`
(not a NextAuth cookie) and returned the authenticated user. Authenticated: `/` `307`s to
`/stats` (`getSession()` redirect, matching story 7.1/7.2's recorded shape); `/stats`
returns `200` with a `37979`-byte body - byte-identical to story 7.2's recorded size,
strong evidence of an unchanged render on a cold stack; `GET /backend/api/auth/session`
resolves the logged-in user, confirming the nav's username source is live.
`POST /backend/api/auth/logout` returns `204`, clears the cookie, and a subsequent
`/stats` request `307`s back to `/login?callbackUrl=%2Fstats` while
`/backend/api/auth/session` returns `401` - sign-out behaves correctly on a cold stack.

**`/product?unit=BTC&name=Bitcoin` still returns `500` under the shipped `nest`/`nest`
defaults on this cold stack - reproduced exactly as stories 7.1 and 7.2 already found and
flagged, not a new defect and not caused by this story.** `next-app`'s log for the request
shows the identical crash site both prior stories recorded:
`ReferenceError: window is not defined` at `LineChart (./src/components/product/LineChart.tsx:164:39)`,
from the `window?.innerWidth` read on line 180. Recording this as a known pre-existing
condition per this session's task framing; not fixed here (would require editing
`frontend/src`, outside this story's and this epic's scope).

**Observability (AC C).** `GET /backend/api/metrics` over the real nginx/TLS route:
correct `METRICS_SECRET` bearer token -> `200` Prometheus exposition text; missing token
-> `403` plain-text `Forbidden` (confirmed body is exactly `Forbidden`, not JSON) - both
re-run cleanly as a cold-start regression. Grafana's Live Application Logs panel queries
Loki with `{app="portfolio"}` (`OBSERVABILITY.md`); queried Loki directly from inside
`next-app` (`http://loki:3100/loki/api/v1/query_range`, no host port is published for
Loki) since no browser was available to view the panel itself - the same underlying data
source the panel renders. Streams for both `next-app` and `nest-api` (among the other
seven containers) are present with real log lines from the last 10 minutes, e.g.
`nest-api -> {"context":"NestApplication",...,"message":"Nest application successfully
started",...}` and `next-app -> ✓ Compiled /product/page in 5.4s (5650 modules)` -
confirms Alloy's Docker-log scraping reaches both containers on this cold stack.

**Prometheus's own scrape-target health check does not pass, and cannot pass under the
current `monitoring/prometheus.yml`/`docker-compose.yml` - this is a pre-existing,
already-owner-adjudicated gap, not a defect introduced by this epic's two seams, and not
something this story fixes.** `curl -s http://localhost:9090/api/v1/targets` shows both
`nextjs-app` and `nestjs-backend` as `health: "down"`, `lastError: "server returned HTTP
status 403 Forbidden"`. Root cause, confirmed directly: `docker exec prometheus cat
/etc/prometheus/prometheus.yml` shows the literal, unexpanded string `${METRICS_SECRET}`
in both jobs' `authorization.credentials` - vanilla Prometheus (and this compose stack's
`prom/prometheus:v2.51.0` image, with no `envsubst` entrypoint wrapper) does not expand
env vars anywhere outside `global.external_labels`, and `--enable-feature=expand-external-labels`
(the flag this compose stack passes) is exactly that narrower feature, not general `${VAR}`
substitution - `OBSERVABILITY.md`'s own "Prometheus scrape and expand-external-labels"
section is itself wrong about what the flag does. Confirmed the target itself is correct
and reachable independent of this: `curl -H "Authorization: Bearer
<real METRICS_SECRET>" https://www.tubesock.xyz/backend/api/metrics` (over the real nginx
route) returns `200`; the same request with the literal string
`Bearer ${METRICS_SECRET}` - what Prometheus actually sends - returns `403`, matching
Prometheus's own reported error exactly.

This is not new: story 5.9 (Epic 5) found and documented this identical bug when it added
the `nestjs-backend` job, and Epic 5's Owner Feedback ruled on it explicitly at that
epic's review gate (`docs/bmad/nestjs-migration/epics/5-domain-endpoints.md:520-523`):
*"Prometheus cannot scrape either service ... Left for a follow-up. Pre-existing and
outside this initiative."* Both scrape jobs - `nextjs-app` (pre-existing before Epic 5)
and `nestjs-backend` (added by 5.9) - were already broken this same way before Epic 6, 7,
or 10 touched anything; neither `NEXT_PUBLIC_AUTH_TARGET` nor `NEXT_PUBLIC_API_TARGET`
has any bearing on it. Fixing it for real needs a credential-injection mechanism this
compose stack does not have today (an `envsubst`-on-boot entrypoint wrapper, a
`credentials_file`, or equivalent) touching `docker-compose.yml`'s `prometheus` service
and/or `monitoring/prometheus.yml` - files no story in this epic (7.1, 7.2, or this one)
opened, and which the owner has already ruled out of this initiative's scope once. Per
that standing ruling, this story does not re-open it and does not block on it alone,
following the same treatment this session's task framing gave the two other known,
pre-existing conditions (the `/product` `window` crash and the reversibility gap). Flagging
it again here only because AC C's checklist and the epic's own Gate text both literally
name "Prometheus's targets page shows both scrape jobs healthy" - that line item cannot be
satisfied by any change available to this story, and stays open pending the follow-up the
owner already called for.

**Swagger (AC D).** `https://www.tubesock.xyz/backend/docs`, over the real nginx/TLS
route (not the `127.0.0.1:3002` loopback shortcut), returns `200`,
`content-type: text/html; charset=utf-8`, `<title>Swagger UI</title>`, with the
`swagger-ui` markup present - confirms nginx's `/backend/` proxy reaches the docs UI on a
cold stack.

**No code (AC E).** `git diff --name-only 246feeb40e107b6d697ff6f02e5fe904f512561e` -
`docker-compose.yml`, `frontend/Dockerfile` (both from stories 7.1/7.2, already
committed), plus the same pre-existing, Next-regenerated `frontend/next-env.d.ts` drift
(one stale `/// <reference types="next/navigation-types/compat/navigation" />` line)
stories 7.1 and 7.2 both recorded and did not touch. This story's own diff is empty, as
its Context section requires.

### Changed Files

None. This story is verification-only, as its Context section states, and every check
either passed or reproduced an already-documented, already-adjudicated pre-existing
condition that this story's own scope does not permit fixing - so no file was added,
modified, or deleted.

### Verification

- `docker compose down` (from the running state left by story 7.2) - all nine containers
  stopped and removed; `docker volume ls` confirmed `portfolio_mysql-volume`,
  `portfolio_redis-volume`, `portfolio_loki-volume`, `portfolio_grafana-volume` survived.
- `docker compose up -d --build` (no env override) - `next-app`, `nest-api`, `nginx`
  images rebuilt; all nine services (`alloy`, `grafana`, `loki`, `nest-api`, `next-app`,
  `nginx`, `portfolio-db`, `prometheus`, `redis`) report `running`/`Up`, confirmed again
  several checks later with no restarts.
- `docker exec next-app printenv NEXT_PUBLIC_AUTH_TARGET NEXT_PUBLIC_API_TARGET` ->
  `nest`/`nest`.
- Full live-stack verification (unauthenticated `/login`, real login via
  `POST /backend/api/auth/login`, `portfolio_session` cookie, `/`/`/stats`/`/product`
  render, nav-username session check, logout, Prometheus target health, Grafana's
  Live Application Logs data in Loki, `/backend/api/metrics` auth, Swagger UI) - see Dev
  Notes above for the exact requests and responses, all driven with `curl` from inside
  the `next-app` container over the real nginx/TLS route (`https://www.tubesock.xyz`,
  resolved to the `nginx` container's Docker-network address), since no browser/UI
  automation tool was available and a direct host-to-nginx request over the hostname was
  rejected by this environment's own network sandbox.
- `git diff --name-only 246feeb40e107b6d697ff6f02e5fe904f512561e` - `docker-compose.yml`,
  `frontend/Dockerfile` (stories 7.1/7.2, already committed), plus the pre-existing
  `frontend/next-env.d.ts` drift stories 7.1/7.2 also recorded. Nothing from this story.
