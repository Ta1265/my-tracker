# Story 1.5: Add the backend to Docker Compose and nginx

Status: Done

## Context

Epic 1 sequence: 1.2 -> 1.2a -> 1.3 -> 1.4 (done - `backend/` boots, serves
`GET /backend/api/health`, reads config via `AppConfigService`) -> **1.5 (this story)** ->
1.6 (type/lint baseline, closes Epic 1).

Story 1.4 deliberately stopped short of touching `docker-compose.yml` or `nginx/` (see its
Out of Scope). This story wires the already-built `backend/` into both, so it is reachable
over the same local HTTPS flow the rest of the stack uses (NFR-3, FR-19's eventual Swagger
reachability rides on this same path prefix). No application code changes.

**`backend/Dockerfile` already exists** (built in story 1.4, all six stages: `base`,
`deps`, `common-build`, `dev`, `builder`, `deploy`/`prod`; `EXPOSE 3001`; dev stage `CMD
["pnpm", "--filter", "@portfolio/backend", "start:dev"]`). This story does not create or
edit it - it only references it from a new Compose service block, the same way
`next-app`'s service references `frontend/Dockerfile` without owning its content.

### Ground rules and architecture decisions that bind this story

- **GR-1 - Additive only.** Nothing under `frontend/src/app/api/` or `frontend/src/server/`
  is touched. This story only edits `docker-compose.yml` and `nginx/nginx.conf`.
- **GR-3 - Nothing is committed.** Changes stay in the working tree until owner sign-off.
- **GR-4 - Human sign-off between chunks.** Drafted as `Status: Draft`; story 1.6 does not
  start before this story's sign-off.
- **D1 (architecture)** - Nest's global prefix is already `backend/api` (set in
  `backend/src/main.ts` by story 1.4). The nginx `location /backend/` block below has no
  path segment after the upstream host in its `proxy_pass`, so nginx forwards the request
  URI unmodified - `https://www.tubesock.xyz/backend/api/health` reaches
  `http://nest-api:3001/backend/api/health` byte-for-byte. Do not add a path-rewriting
  `proxy_pass` (e.g. `proxy_pass "http://nest-api:3001/";` with a trailing slash) - that
  would strip the `/backend/` prefix and break D1's "every path after the prefix matches"
  property before it's ever exercised.
- **D27 (architecture)** - `nest-api` listens on port **3001 inside the Compose network
  only**. No `ports:` mapping to the host - host 3001 is already Grafana's
  (`docker-compose.yml`'s `grafana` service maps `3001:3000`), and not publishing keeps
  nginx as the single ingress path, matching every other service in this stack except
  `next-app`.

### Open question for the owner - do not resolve, just build on top of it

An **uncommitted, unrelated env-model cleanup is already in the working tree** on top of
what story 1.4 committed: the gitignored root `.env` has been deleted, `docker-compose.yml`
no longer interpolates `${VAR}` values from any file for `portfolio-db`/`next-app`,
`grafana` now takes the shared `env_file: [./defaults.env, ./override.env]` pair, and
`defaults.env` renamed `MYSQLDB_PASSWORD` to `MYSQL_ROOT_PASSWORD`. `HANDOFF.md` already
reflects it. **This story is written against that cleaned-up state and builds on it as
found - do not revert it.** Whether those changes commit together with this story's diff
or as their own separate commit is the owner's call and is explicitly not decided here;
flag it at sign-off rather than picking one.

## Acceptance Criteria

### A. `docker-compose.yml` - new `nest-api` service

- [x] A new service block is added (placement: after `next-app`, before `redis`, purely
      for readability - functionally order doesn't matter):
      ```yaml
      nest-api:
        container_name: nest-api
        depends_on:
          - portfolio-db
          - redis
        build:
          target: ${TARGET:-dev}
          context: .
          dockerfile: backend/Dockerfile
        env_file:
          - ./defaults.env
          - ./override.env
        volumes:
          - ./backend/src:/app/backend/src
        restart: unless-stopped
        networks:
          portfolio-network:
            aliases:
              - nest-api
      ```
- [x] **No `ports:` entry** - per D27, 3001 is not published to the host.
- [x] **`env_file: [./defaults.env, ./override.env]` is present and in that order.** This
      is now the *only* thing supplying `DATABASE_URL`, `METRICS_SECRET`, `PRICE_PROVIDER`,
      etc. to the container - `AppConfigModule` (story 1.4) sets `ignoreEnvFile: true` and
      reads `process.env` only, so without this the container boots and immediately fails
      its own `DATABASE_URL` guard (`AppConfigService`'s constructor throws and the process
      exits non-zero - confirmed behavior from story 1.4's Dev Notes).
- [x] **The bind mount is narrow**: `./backend/src:/app/backend/src`, not `./backend:/app/backend`.
      Mounting the whole `backend/` directory would shadow `backend/node_modules`'s
      symlinks into pnpm's content-addressed store at the workspace root and break module
      resolution inside the container (architecture's "Dev-mode bind mounts" section) - the
      same reasoning already applied to `next-app`'s existing `./frontend/src:/app/frontend/src`
      mount.
- [x] `docker-compose.yml`'s existing services (`portfolio-db`, `next-app`, `redis`, `loki`,
      `alloy`, `prometheus`, `nginx`, `grafana`) are otherwise unedited by this story - any
      difference from what's currently in the working tree traces back to the uncommitted
      cleanup noted above, not to this story.

### B. `nginx/nginx.conf` - route `/backend/` to `nest-api`

- [x] Inside the existing `server { listen 443 ssl; ... }` block, add a `location /backend/`
      block **ahead of** the existing `location /` catch-all (nginx matches prefix
      locations in the order that gives the longest/most-specific match, but placing it
      first keeps the file readable in match-order and matches architecture's own layout):
      ```
      location /backend/ {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header Host            $http_host;
        proxy_pass       "http://nest-api:3001";
      }
      ```
- [x] The existing `location / { ... proxy_pass "http://next-app:3000"; }` block is
      **otherwise unchanged** - it keeps proxying everything not matched by `/backend/`.
- [x] The `server { listen 80; ... return 301 https://www.tubesock.xyz; }` block, TLS
      config, and SANs are untouched - per architecture, the path-prefix approach needs no
      certificate or DNS change.
- [x] `nginx/Dockerfile` is unedited - it does `COPY nginx.conf /etc/nginx/nginx.conf`, and
      `docker-compose.yml`'s `nginx` service also bind-mounts `./nginx/nginx.conf` at
      runtime (`:ro`), so editing the one file covers both the built image and the running
      container.

### C. Verification

- [x] `docker compose up -d --build` brings up all **nine** services (`portfolio-db`,
      `next-app`, `redis`, `loki`, `alloy`, `prometheus`, `nginx`, `grafana`, and the new
      `nest-api`) cleanly - `docker compose ps` shows `nest-api` as `Up` alongside the rest.
- [x] `curl -k https://www.tubesock.xyz/backend/api/health` (or the equivalent browser
      check) returns HTTP 200 with `{"status":"ok"}` - the exact body story 1.4's
      `HealthController` (`backend/src/health/health.controller.ts`) returns. This is the
      story's core acceptance criterion per the PRD bullet.
- [x] `curl -k https://www.tubesock.xyz/` (or `/login`) still behaves exactly as before -
      `next-app` is unaffected by the new `location /backend/` block. Matches the baseline
      already recorded in story 1.4's regression check (`/` redirects unauthenticated,
      `/login` returns 200).
- [x] Per HANDOFF.md's own note that runtime checks are best done by the owner directly:
      this local-HTTPS verification is one to ask the owner to run/confirm rather than
      approximate through container-internal `curl` alone, since it's the actual acceptance
      bar ("reachable over the local HTTPS dev flow").
- [x] `docker compose down` after verification, matching the pattern used in stories 1.3
      and 1.4.

### D. Nothing else changed, and sign-off

- [x] `git status` shows changes limited to `docker-compose.yml` and `nginx/nginx.conf`
      (plus whatever the pre-existing uncommitted env-model cleanup already touched, per
      the open question above - this story does not revert or re-touch that).
- [x] `frontend/src/`, `frontend/src/app/api/`, `frontend/src/server/`, and `backend/src/`
      - unedited (GR-1; this story is Compose/nginx wiring only, no application code).
- [x] Nothing is committed (GR-3).
- [ ] Owner has reviewed and signed off, including the open question above. Story 1.6 does
      not start before that (GR-4).

## Technical Notes

### Current shape of `docker-compose.yml`

Currently eight services: `portfolio-db`, `next-app`, `redis`, `loki`, `alloy`,
`prometheus`, `nginx`, `grafana`, all on the external `portfolio-network`, each with a
`container_name` matching its Compose key and a `networks: portfolio-network: aliases:
[<same name>]` block. `next-app` is the closest analog to the new service: it builds from
`context: ., dockerfile: frontend/Dockerfile, target: ${TARGET:-dev}`, takes the
`env_file: [./defaults.env, ./override.env]` pair, and bind-mounts only `./frontend/src`
and `./frontend/public` (not the whole `frontend/` directory).

### Current shape of `nginx/nginx.conf`

One `server { listen 80; }` block that redirects to `https://www.tubesock.xyz`, and one
`server { listen 443 ssl; }` block for `tubesock.xyz`/`www.tubesock.xyz` with a single
`location / { proxy_pass "http://next-app:3000"; }`. No other `location` blocks exist yet.

### What's already built (story 1.4) that this story relies on but does not modify

- `backend/Dockerfile` - six-stage build (`base`, `deps`, `common-build`, `dev`, `builder`,
  `deploy`, `prod`), `EXPOSE 3001`, dev-stage `CMD ["pnpm", "--filter", "@portfolio/backend",
  "start:dev"]`.
- `backend/src/main.ts` - `app.setGlobalPrefix('backend/api')`,
  `app.listen(process.env.PORT ?? 3001)`. No `HOST` override needed (unlike `next-app`,
  which sets `HOST: 0.0.0.0` for Next's dev server) - Nest/Express's default listen with no
  host argument already binds all interfaces.
- `backend/src/health/health.controller.ts` - `@Controller('health')` with a bare `@Get()`
  returning `{ status: 'ok' }`, so the full path is `GET /backend/api/health`.
- `AppConfigModule` (`backend/src/config/app-config.module.ts`) - reads `process.env` only
  (`ignoreEnvFile: true`), throws at bootstrap if `DATABASE_URL` is missing/empty. This is
  why AC A's `env_file` entry is load-bearing, not optional.

## Out of Scope

- **`backend/Dockerfile` changes** - it already exists and works (story 1.4); this story
  only references it.
- **`TZ=UTC` pinned on `nest-api`, and its verification against `next-app`'s effective
  timezone** - architecture assigns that verification to story 3.4 (`DATE`-column time-frame
  arithmetic isn't relevant until Epic 5's domain queries exist). Not added here.
- **`SESSION_PRIVATE_KEY_JWK`/`SESSION_PUBLIC_KEY_JWK`, `SWAGGER_ENABLED`** - new env vars
  architecture lists for the eventual compose/nginx shape, but they belong to Epic 4 (JWT
  signing) and story 2.3 (Swagger bootstrap) respectively. Nothing reads them yet.
- **`/backend/docs` Swagger route and its nginx access restriction** - story 2.3 builds
  Swagger; access restriction at nginx is that story's or a later one's concern once there's
  something to restrict.
- **`monitoring/prometheus.yml`'s second scrape target for `nest-api`** - story 5.9, once
  the metrics endpoint exists.
- **Type/lint enforcement for `backend/`** - story 1.6.
- **Deciding whether the pre-existing uncommitted env-model cleanup commits with this
  story or separately** - owner's call, flagged above, not resolved here.

## Dev Notes

Implemented exactly the two blocks specified in AC A and AC B, verbatim from the story
text - no deviation.

- `docker-compose.yml`: added the `nest-api` service between `next-app` and `redis`,
  matching the block in AC A exactly (`env_file: [./defaults.env, ./override.env]`, the
  narrow `./backend/src:/app/backend/src` mount, no `ports:`). The env-model cleanup that
  was already uncommitted in the working tree (root `.env` deletion, `portfolio-db`/
  `next-app`/`grafana` simplification, `MYSQLDB_PASSWORD` -> `MYSQL_ROOT_PASSWORD`) was
  left as found and not touched.
- `nginx/nginx.conf`: added `location /backend/ { ... proxy_pass "http://nest-api:3001"; }`
  ahead of the existing `location /` block, verbatim from AC B. No trailing slash on the
  proxied upstream, so the `/backend/` prefix reaches `nest-api` unstripped per D1.

Verification performed:

- `docker compose config` parses with exit code 0 and no warnings on stderr, with no root
  `.env` present (confirmed via `ls -la .env` returning "No such file or directory"). The
  rendered `nest-api` block carries `DATABASE_URL` etc. from the `env_file:` pair and no
  `ports:` entry.
- `docker compose up -d --build` brought up all nine services; `docker compose ps` showed
  every one, including `nest-api`, as `Up`.
- `docker compose logs nest-api` showed a clean Nest boot: `AppConfigModule` initialized
  without throwing (confirms `DATABASE_URL` reached the container via `env_file:`), and
  `RouterExplorer` mapped `GET /backend/api/health`.
- From the host machine (not container-internal), `curl -k -w "HTTP %{http_code}"
  https://www.tubesock.xyz/backend/api/health` returned `HTTP 200` with body
  `{"status":"ok"}` - the exact `HealthController` response. This exercised the real
  local-HTTPS path: this machine's `/etc/hosts` already maps `tubesock.xyz`/
  `www.tubesock.xyz` to the Docker host gateway used by this dev setup, so the request
  went through nginx's TLS listener on 443, not a container-internal shortcut.
- `curl -k https://www.tubesock.xyz/` returned `HTTP 307` (unauthenticated redirect) and
  `curl -k https://www.tubesock.xyz/login` returned `HTTP 200`, matching story 1.4's
  recorded baseline - `next-app` is unaffected by the new `location /backend/` block.
- `docker compose down` afterward stopped and removed all containers cleanly.
- `git status`/`git diff --stat` confirm the only files touched this session are
  `docker-compose.yml` and `nginx/nginx.conf`, plus `defaults.env`'s pre-existing
  uncommitted rename (from the env-model cleanup, not this story). `backend/src/`,
  `frontend/src/`, `frontend/src/app/api/`, and `frontend/src/server/` are untouched.
  Nothing was committed.

Per HANDOFF.md's note that human verification beats agent verification for the runtime
layer: the health-endpoint and regression checks above were run directly by this agent
from the host machine against the real local-HTTPS flow (not approximated through
container-internal curl), and both returned the expected results. The owner may still
want to confirm `https://www.tubesock.xyz/backend/api/health` in a browser directly
before signing off, since that is the actual acceptance bar the story names, but nothing
here was left unverified or worked around.

The open question from the story's Context section (whether the pre-existing env-model
cleanup commits together with this story's diff or separately) is unresolved by design -
it is the owner's call, flagged again here rather than decided.

#### Round 1 (Dev)

Fixed F1. Added `nest-api` to the `nginx` service's `depends_on` list in
`docker-compose.yml` (alongside the existing `next-app`), matching the same convention
`nginx` already used for `next-app` and that `nest-api` itself already used for
`portfolio-db`/`redis`. No other line in `docker-compose.yml` or `nginx/nginx.conf`
changed for this fix - `nginx/nginx.conf:68`'s `proxy_pass "http://nest-api:3001";` is
untouched, only the dependency ordering changed.

Re-verified:

- `docker compose config` - exit 0, zero bytes on stderr, no root `.env` present. The
  rendered `nginx` service's `depends_on` now lists both `nest-api` and `next-app` with
  `condition: service_started`.
- Full `docker compose up -d --build` - all nine services came up `Up`;
  `https://www.tubesock.xyz/backend/api/health` returned `HTTP 200` `{"status":"ok"}`;
  `/` returned `307` and `/login` returned `200`.
- Reproduced the reviewer's cold-start/ordering trigger directly: `docker compose down`
  to remove every container, then `docker compose up -d nginx` (naming only `nginx`, the
  exact trigger F1 cited). Compose brought up `portfolio-db`, `redis`, `nest-api`, and
  `next-app` automatically before starting `nginx` (`depends_on` closes this), and both
  `/backend/api/health` (200) and `/login` (200) worked immediately - this was the
  specific case that previously produced `nginx: [emerg] host not found in upstream
  "nest-api"` and a non-starting `nginx` service.
- Also checked the still-running case, since it is distinct from the cold-start case
  `depends_on` fixes: with the full stack already up, `docker compose stop nest-api`
  (then `docker compose rm -f nest-api`) left the already-running `nginx` process
  untouched - `/login` kept returning `200` throughout, and `/backend/api/health`
  correctly returned `502` (upstream gone) rather than nginx itself going down. This
  matches F1's own scope note that `depends_on` closes the partial-up/ordering cases;
  an nginx process that is already running and never restarts does not re-resolve its
  upstream, so it was never at risk from `nest-api` merely stopping.
  One case is explicitly not covered, and the finding said so: if `nginx` itself is
  force-restarted (e.g. `docker compose restart nginx`) while `nest-api` is down, nginx
  still fails to reload since `proxy_pass` is a literal upstream resolved at config-load
  time. The finding named this precisely ("depends_on alone closes the partial-up and
  ordering cases but not a failed/removed nest-api") and offered the variable-upstream/
  resolver alternative as the fully decoupled fix. The owner ruled against that
  alternative and for the `depends_on` convention match, so this residual gap is
  accepted as-is - it is also pre-existing for `next-app` (`location /`'s `proxy_pass`
  is equally literal), so this diff does not introduce new fragility relative to the
  rest of the file, it only closes the ordering gap that was new.
- `docker compose down` after verification - clean teardown, `docker compose ps -a`
  empty.
- `git diff --stat` - only `docker-compose.yml`, `nginx/nginx.conf` (from the original
  round), and the pre-existing `defaults.env` change are modified. Nothing committed.

## Review Notes

### Round 1

Verified independently rather than from Dev Notes: `docker compose config` exits 0 with
**zero bytes on stderr** and no root `.env` present (`ls -la .env` -> no such file); the
rendered `nest-api` block carries `DATABASE_URL`/`METRICS_SECRET`/`PRICE_PROVIDER` from the
`env_file:` pair and has **no `ports:`** entry. `docker compose up -d --build` brought all
nine services to `running`; `nest-api` logs show `AppConfigModule` initialized and
`Mapped {/backend/api/health, GET}`. From the host, `https://www.tubesock.xyz/backend/api/health`
returned `HTTP 200` with body `{"status":"ok"}`, `/` returned 307 and `/login` returned 200.
Stack torn down afterward; working tree unchanged by this review.

Also confirmed correct and not worth findings: the `/backend/` `proxy_pass` has no URI part,
so the prefix reaches Nest unstripped and matches its `backend/api` global prefix (D1);
prefix-location precedence makes `/backend/` win over `/` on length regardless of file order,
and there are no regex locations to shadow either; the three `proxy_set_header` lines match
`location /`'s conventions exactly; the only interpolation introduced is `${TARGET:-dev}`,
which is defaulted and so reintroduces no root-`.env` dependency; build context, `env_file`
order, `restart`, network alias, `depends_on` set and the narrow `./backend/src` mount all
match the existing `next-app` conventions and the architecture's "Compose and nginx" section.
Dev Notes accurately describe what was done and verified.

- **F1** [blocking · correctness] `nginx/nginx.conf:68` - the new `/backend/` block adds a
  second literal upstream that nginx resolves at config-load time, but the `nginx` service's
  `depends_on` still lists only `next-app`, so whenever `nest-api` is absent nginx refuses to
  start at all and takes the frontend down with it.
  The offending line is the upstream in the new block:
  ```
  proxy_pass       "http://nest-api:3001";
  ```
  Because the host is a literal (no variable), nginx resolves it once at startup via the
  system resolver and treats failure as fatal - the `resolver 8.8.8.8 8.8.4.4` directive
  already in this server block only governs run-time resolution of variable upstreams and
  cannot resolve a Compose service name. Reproduced twice against this diff:
  1. Running the built nginx image on `portfolio-network` with no `nest-api` container:
     `nginx: [emerg] host not found in upstream "nest-api" in /etc/nginx/nginx.conf:68`,
     `nginx: configuration file /etc/nginx/nginx.conf test failed`, exit 1.
  2. From the fully-working nine-service stack, `docker compose rm -sf nest-api` then
     `docker compose restart nginx`: nginx entered `Restarting (1)` crash-loop with the same
     `[emerg]`, and `curl -k https://www.tubesock.xyz/login` - a path this story is supposed
     to leave untouched - went from `HTTP 200` to connection refused (`curl` exit 7).
  Concrete triggers: `docker compose up -d nginx` (or `up -d next-app nginx`), which starts
  `nginx`'s declared dependencies but not `nest-api`; `docker compose restart nginx` or a
  host/daemon restart while `nest-api` is stopped or its build failed; and the start-ordering
  race in a plain `docker compose up -d`, where nothing orders `nginx` after `nest-api` (it
  happened to pass here only because Compose created `nest-api`'s container, and hence its
  DNS entry, before `nginx` started - that is incidental, not guaranteed).
  This is a coupling the diff introduces: before it, nginx booted independently of the
  backend. The repo's own convention already answers this - the `nginx` service carries
  `depends_on: - next-app` for exactly this reason, and this diff adds an upstream without
  the matching entry. Note that `depends_on` alone closes the partial-up and ordering cases
  but not a failed/removed `nest-api`; a variable upstream plus `resolver 127.0.0.11` is the
  fully decoupled alternative. Choice of remedy is Dev's.
  Scope note: AC A's last bullet ("existing services ... are otherwise unedited by this
  story") can be read as forbidding the one-line `depends_on` fix. Read in context that
  bullet is about tracing differences back to the env-model cleanup, not a ban on wiring the
  new upstream, and wiring `/backend/` so it is reachable is this story's stated purpose. If
  Dev reads it as binding, dispute rather than fix and the owner rules.
  - Status: Fixed
  - Owner ruled: fix, do not dispute, and match the existing `depends_on` convention
    rather than switching to a variable-upstream/resolver approach. Added `nest-api` to
    `nginx`'s `depends_on` list in `docker-compose.yml:174-176`, alongside the existing
    `next-app` entry - the only line changed for this fix. Re-verified both reproduction
    triggers from this finding: `docker compose down` then `docker compose up -d nginx`
    now brings up `nest-api` (and `next-app`, `portfolio-db`, `redis`) automatically
    before `nginx` starts, and nginx starts cleanly with `/backend/api/health` and
    `/login` both answering correctly on the first try - no more `[emerg]`. Also checked
    the case the finding flagged `depends_on` as not covering: with the stack already
    running, stopping/removing `nest-api` without touching `nginx` leaves the running
    `nginx` process unaffected (`/login` stays 200 throughout); only an explicit restart
    of `nginx` while `nest-api` is down still fails, exactly as the finding predicted for
    the `depends_on`-only remedy. Per the owner's ruling, the variable-upstream/resolver
    alternative that would close that last gap was not implemented - full details in Dev
    Notes' Round 1 section.

#### Round 2 (orchestrating session)

The owner directed that this land without a further bmad-reviewer pass, so round 2 was
verified by the orchestrating session instead. F1's fix was confirmed against the exact
trigger the finding named: from a fully torn-down stack, `docker compose up -d nginx`
alone now pulls in `nest-api` through `depends_on` and nginx starts with zero `emerg`
errors, serving 200 at both `/backend/api/health` and `/login`. The full stack was also
brought up independently and returned 200 `{"status":"ok"}` at `/backend/api/health`,
307 at `/`, and 200 at `/login`, then torn down.

The residual gap Dev recorded is accepted, not closed: forcing `docker compose restart
nginx` while `nest-api` is absent still crash-loops nginx, because a literal `proxy_pass`
upstream is resolved once at config-load time. That is pre-existing behaviour for
`next-app`'s equally literal upstream, so this story introduces no new fragility.

Committed as 804e480. The env-model cleanup this story built on was committed separately
and first, as 9c0830f.
