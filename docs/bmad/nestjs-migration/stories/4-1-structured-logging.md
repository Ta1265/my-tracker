# Story 4.1: Structured logging to stdout, injectable, with request correlation

Status: Done

## Context

First cross-cutting concern of Epic 4 (PRD's table: "Structured logging | 4.1 | First
real consumers are the auth failure paths"). Nothing in `backend/src` logs anything today
beyond Nest's own boot-time console output. This story wires Winston as Nest's bound
logger and adds per-request correlation, so story 4.4's credential-verification failure
paths - the first real consumers - have somewhere structured to write to. This story
itself introduces no auth logic; it only proves the logging pipeline works, using a
temporary diagnostic in the same add-then-remove style stories 3.2-3.4 already used for
their own proofs.

## Acceptance Criteria

### A. Winston bound as Nest's logger (architecture D28)

- [x] Add `winston`, `nest-winston`, and `nestjs-cls` to `backend/package.json`
      dependencies.
- [x] `backend/src/common/logging/winston-logger.factory.ts` exports
      `createWinstonLogger(): LoggerService`, built with `nest-winston`'s
      `WinstonModule.createLogger(...)` wrapping a `winston.createLogger(...)` instance
      configured to match `frontend/src/server/logger.ts` field-for-field: `level:
      process.env.LOG_LEVEL ?? 'info'`, `format: winston.format.combine(timestamp(),
      <requestId format from section B>, json())`, `defaultMeta: { service: 'portfolio',
      environment: process.env.NODE_ENV }`, `transports: [new winston.transports.Console()]`.
      Reading `LOG_LEVEL`/`NODE_ENV` directly from `process.env` here (not via
      `AppConfigService`) matches the existing precedent in `backend/src/main.ts`, which
      already reads `process.env.PORT` directly - both happen before/around Nest's DI
      container exists.
- [x] `backend/src/main.ts` passes the logger at creation time:
      `NestFactory.create(AppModule, { logger: createWinstonLogger() })`. This replaces
      Nest's default console logger for every boot message and every future
      `Logger`/`LoggerService` injection, so Nest's own "Nest application successfully
      started" line is now Winston JSON too - use this as evidence in verification.

### B. Request correlation via `nestjs-cls`

- [x] `backend/src/common/cls/cls.module.ts` exports `RequestClsModule`, a pre-configured
      `ClsModule.forRoot({ middleware: { mount: true, generateId: true } })` (module
      constant, not a wrapper class - there's no naming collision to avoid here, unlike
      `AppConfigModule`/`ConfigModule`). `AppModule`'s `imports` array adds
      `RequestClsModule`.
- [x] The Winston format from section A includes a custom `winston.format((info) => {...})`
      step that reads the active request id from CLS and adds it to `info.requestId`
      when present. `nestjs-cls` exposes `ClsServiceManager.getClsService()` for reading
      the active context from outside Nest's DI container, which is the documented hook
      for exactly this case (a plain format function, not an injectable) - confirm the
      exact import against the version pnpm resolves, since this is read from the
      package's own docs, not verified against this repo's installed version yet. When no
      request is active (e.g. Nest's own boot-time logs), `info.requestId` is simply
      absent - no error, no placeholder value.

### C. Demonstration, then removed

- [x] Add a temporary diagnostic route (same convention as story 3.4's
      `DiagTempController`: added, exercised, evidence pasted into Dev Notes, then
      deleted before this story is Done) that injects Nest's `Logger`/`LoggerService` and
      logs one line per call. Fire two concurrent requests and confirm in the raw stdout
      output: (1) both lines are valid JSON with `service: 'portfolio'`,
      `environment`, `level`, `message`, `timestamp` keys; (2) each line carries a
      `requestId`; (3) the two requests' `requestId` values differ from each other.
      Paste both raw JSON lines into Dev Notes.
- [x] Delete the temporary controller and its `AppModule` registration before finishing
      this story - confirmed absent from `git status`/`git diff`, matching every prior
      story's diagnostic-removal discipline.

### D. Regression

- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, `lint` all pass.
- [x] `docker compose up -d --build` brings up the full stack; `GET
      /backend/api/health` through nginx still returns `200`.
- [x] `docker compose logs nest-api` shows JSON log lines (not Nest's default colored
      console format) for the container's own boot sequence - direct evidence the bound
      logger is active in the real deployment target, not just host-side `pnpm start`.

## Technical Notes

### Current state

No logging framework exists in `backend/src`; Nest's default `ConsoleLogger` is active
by omission. `frontend/src/server/logger.ts` (11 lines, read in full above) is the exact
shape to match - do not add fields it doesn't have, and do not drop `service`/
`environment` from `defaultMeta`.

### Why this must land before 4.4, not alongside it

4.4's credential-verification service logs `'Auth Error'` (DB failure) and `'Invalid
password attempt'` (bad password) - the literal messages `frontend/src/server/auth.ts:156,165`
uses today. Landing the logger first means 4.4 just injects `LoggerService` like any other
Nest collaborator (NFR-1) rather than bootstrapping logging infrastructure inline with its
own domain logic.

### Dashboard compatibility (why the shape must match exactly)

Alloy scrapes Docker container logs and Loki stores them; existing Grafana dashboards
filter on the body-level `service` field (`'portfolio'`), which is a *different* thing
from the Loki stream label Alloy derives from the Compose service name
(`container_name`). Getting `defaultMeta.service` wrong or missing breaks those filters
silently rather than loudly - there's nothing to catch it at build time.

## Out of Scope

- Any real log call from domain logic - the first one is story 4.4's credential
  verification failure paths.
- The injectable clock (4.2) and global error filter (4.3) - separate stories, though all
  three land in this epic before Epic 5.
- Log levels/verbosity tuning beyond matching the frontend's existing default.

## Dev Notes

### Section A/B - implementation notes

`WinstonModuleOptions` (`nest-winston@1.10.2`) is `LoggerOptions & { instance?: Logger }`,
so `createWinstonLogger()` builds the `winston.Logger` with `winston.createLogger(...)`
first and passes it in as `instance`, per the story's "wrapping a `winston.createLogger`
instance" wording.

`nestjs-cls@6.2.1` exports `ClsServiceManager` and `ClsModule` both from its package
root (`nestjs-cls`, not a subpath) - confirmed by reading the installed package's
`dist/src/index.d.ts`. `ClsService.isActive()` and `.getId()` (a shorthand for
`cls.get(CLS_ID)`) are used directly rather than reading the `CLS_ID` symbol by hand.

`backend/Dockerfile`'s `dev` build target had no `NODE_ENV` set at all (only the `prod`
stage sets `NODE_ENV=production`), unlike `next dev`, which sets `NODE_ENV=development`
itself. Without it, `defaultMeta.environment` was `undefined`, and Winston's JSON
transport silently drops `undefined`-valued keys - so every log line was missing the
`environment` field Grafana filters may depend on, in every environment this compose
file's `dev` target runs in. Fixed by adding `ENV NODE_ENV=development` to the `dev`
stage, mirroring what `next dev` already does implicitly. This surfaced only because
section C required pasting `environment` from a real container's JSON output; it is not
itself an acceptance criterion but is a real, silent gap this story would otherwise have
shipped.

### Section C - diagnostic evidence

Temporary `DiagTempController` (`backend/src/diag-temp.controller.ts`, registered
transiently in `AppModule.controllers`) exposed `GET /backend/api/diag-temp/log`,
constructor-injecting nothing extra - it used Nest's `Logger` class directly (`new
Logger(DiagTempController.name)`) and logged one line per call.

After `docker compose up -d --build` (with the Dockerfile `NODE_ENV` fix already
applied), fired two concurrent requests via `curl -sk
https://www.tubesock.xyz/backend/api/diag-temp/log --resolve
www.tubesock.xyz:443:127.0.0.1` and read the raw stdout with `docker compose logs
nest-api --since 30s`:

```
{"context":"DiagTempController","environment":"development","level":"info","message":"diag-temp log line","requestId":"o6qqan5b","service":"portfolio","timestamp":"2026-08-21T02:29:44.425Z"}
{"context":"DiagTempController","environment":"development","level":"info","message":"diag-temp log line","requestId":"fnh0yzi3","service":"portfolio","timestamp":"2026-08-21T02:29:44.427Z"}
```

Both lines are valid JSON with `service: 'portfolio'`, `environment: 'development'`,
`level`, `message`, `timestamp` keys; each carries a `requestId`; the two `requestId`
values (`o6qqan5b` vs `fnh0yzi3`) differ. `DiagTempController` and its `AppModule`
registration were then deleted - confirmed absent from `git status`/`git diff` (neither
`backend/src/diag-temp.controller.ts` nor a `DiagTempController` reference appears in
the final diff).

### Changed Files

+ backend/src/common/logging/winston-logger.factory.ts   Winston logger bound as Nest's LoggerService, JSON + requestId format
+ backend/src/common/cls/cls.module.ts                   `RequestClsModule`, pre-configured `ClsModule.forRoot` with request-id generation
~ backend/src/main.ts                                    passes `createWinstonLogger()` to `NestFactory.create`
~ backend/src/app.module.ts                               imports `RequestClsModule`
~ backend/package.json                                    adds `winston`, `nest-winston`, `nestjs-cls` dependencies
~ pnpm-lock.yaml                                           lockfile update for the three new dependencies
~ backend/Dockerfile                                       sets `NODE_ENV=development` in the `dev` build target so `defaultMeta.environment` is populated (was unset, silently dropped from every JSON log line)

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only pre-existing warning at
  `main.ts:49` (`no-floating-promises` on `bootstrap();`), confirmed present before this
  story's changes too via `git stash` + re-run.
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `docker compose up -d --build` - full stack came up; `curl -sk
  https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1`
  returned `200` `{"status":"ok"}`.
- `docker compose logs nest-api --tail 5` after the final rebuild (diagnostic controller
  already removed) - boot sequence is JSON, e.g. `{"context":"NestApplication",
  "environment":"development","level":"info","message":"Nest application successfully
  started","service":"portfolio","timestamp":"2026-08-21T02:30:13.978Z"}` - confirms
  Nest's own default console logger has been fully replaced, in the real container, not
  just host-side `pnpm start`.
