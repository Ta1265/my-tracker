# Story 4.4: Credential verification against the `User` table

Status: Done

## Context

FR-6: existing bcrypt hashes in the `User` table keep working - no forced reset, no
rehash-on-login, no schema change. This story is the injectable service that checks a
username/password pair; it has **no HTTP dependency** (NFR-1 - "business logic lives in
injectable per-domain services and controllers stay thin"), so story 4.5 can inject it
into the login endpoint without this story knowing HTTP exists. Uses story 3.4's
ORM-query convention (`em.getRepository(Entity).findOne(...)` for simple single-table
lookups) and story 4.1's logger for the two failure-path log lines
`frontend/src/server/auth.ts:156,165` produces today.

## Acceptance Criteria

### A. `CredentialVerifierService`

- [x] `backend/src/auth/credential-verifier.service.ts` exports an injectable
      `CredentialVerifierService` with one public method:
      `async verify(username: string, password: string): Promise<User | null>`. Returns
      the matched `User` entity (story 3.2) on success, `null` on any failure (unknown
      username, wrong password, DB error) - the caller (story 4.5) decides how a `null`
      becomes a `401`, this service never throws for a normal auth failure.
- [x] Username lookup is **lowercased** before the query, matching
      `frontend/src/server/auth.ts:154`'s `username.toLowerCase()` exactly -
      `em.getRepository(User).findOne({ username: username.toLowerCase() })`, per story
      3.4's ORM-query convention (a simple single-table lookup, not a raw query).
- [x] Password check is `bcrypt.compare(password, user.password)` - add `bcrypt` and
      `@types/bcrypt` to `backend/package.json`. Architecture confirms `bcrypt@5.1.1` is
      N-API (`napi-v3`) and therefore ABI-stable across Node majors, so no native rebuild
      concern on Node 24.
- [x] On a DB error during the lookup, log `'Auth Error'` at `error` level via the bound
      logger (4.1), with `{ error }` metadata (matches `auth.ts:156`'s
      `logger.error('Auth Error', { error })`), and return `null` rather than letting the
      exception propagate - a lookup failure is an auth failure, not a 500.
- [x] On a wrong password, log `'Invalid password attempt'` at `warn` level with
      `{ username: user.username }` metadata (matches `auth.ts:165`), then return `null`.
- [x] On an unknown username, return `null` with **no log line** - matches today's
      behavior exactly (`auth.ts:158-160` returns `null` silently when `!user`).

### B. Verification

- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, `lint` all pass.
- [x] A temporary diagnostic route or script (added, exercised, evidence pasted into Dev
      Notes, then removed - same convention as prior Epic 3/4 stories) calls `verify()`
      against a real row in `portfolio-db` three ways: correct username/password (returns
      the `User`), correct username/wrong password (returns `null`, confirm the `warn`
      log line appears in `docker compose logs nest-api` with the right JSON shape from
      4.1), unknown username (returns `null`, confirm no log line was emitted for this
      case specifically).

## Technical Notes

### Current state

No `auth/` service exists beyond the Epic 2 stub controller and its DTOs
(`backend/src/auth/auth.controller.ts`, `backend/src/auth/dto/*`). This story adds the
service only; `auth.controller.ts`'s `login` handler still throws
`NotImplementedException` until story 4.5 wires this service in.

### Where this deviates from `frontend/src/server/auth.ts` on purpose

The frontend's `authorize()` (`auth.ts:142-176`) is entangled with NextAuth's
`CredentialsProvider` shape (reads `credentials` object, returns a NextAuth `User`
shape including `rememberMe` parsed from a string). This service is plain: two string
parameters in, a MikroORM `User` entity or `null` out. `rememberMe` and session issuance
are story 4.5's concern, not this one's - keeping this service HTTP- and
session-agnostic is what makes it independently unit-testable per NFR-1.

## Out of Scope

- Session/JWT issuance, `rememberMe`, cookie handling - story 4.5.
- The login/logout/session HTTP endpoints themselves - stories 4.5/4.6.
- Any change to `frontend/src/server/auth.ts` or NextAuth - GR-1, FR-11.

## Dev Notes

### Implementation notes

`EntityManager` (MikroORM) is injected directly - `MikroOrmCoreModule` (registered by
`DbModule`'s `MikroOrmModule.forRootAsync`) is `@Global()`, so `AuthModule` does not need
to import `DbModule` to get it.

The `{ error }` / `{ username }` metadata shape is produced by passing an object as the
sole argument to Nest's bound `Logger` (`new Logger(CredentialVerifierService.name)`),
e.g. `this.logger.warn({ message: 'Invalid password attempt', username: user.username })`.
`nest-winston`'s `WinstonLogger.warn`/`.error` destructure an object-shaped `message` into
`{ message: <text> }` plus the remaining keys as metadata, so this reproduces
`auth.ts`'s `logger.warn('Invalid password attempt', { username: user.username })` output
field-for-field (plus the `context`/`requestId` fields every 4.1-bound log line already
carries). Passing `('Auth Error', { error })` as two positional args instead - mirroring
`auth.ts:156` literally - does not work: `WinstonLogger.error(message, trace, context)`
treats a non-string second argument as `trace` and wraps it in a `stack` array rather than
spreading it as metadata, so the object-message form is the only way to get a real
top-level `error`/`username` key.

### Verification evidence (Section B)

Real DB row testing needed a known password, so a temporary user
(`username: 'diagtempuser'`, password `DiagPass123!` hashed with the same `bcrypt`
version installed in the `nest-api` image) was inserted directly into `portfolio-db`'s
`User` table for the duration of this check and deleted immediately after.

Temporary `backend/src/auth/diag-temp.controller.ts` (registered transiently in
`AuthModule.controllers`) exposed `GET /backend/api/diag-temp/verify?username=...&password=...`,
injecting `CredentialVerifierService` and returning `{ matched: user !== null }`.

After `docker compose build nest-api && docker compose restart nest-api`, three requests
via `curl -sk https://www.tubesock.xyz/backend/api/diag-temp/verify?... --resolve
www.tubesock.xyz:443:127.0.0.1`:

- Correct username/password (`diagtempuser` / `DiagPass123!`) - `{"matched":true}`.
- Correct username/wrong password (`diagtempuser` / `WrongPass`) - `{"matched":false}`,
  and `docker compose logs nest-api --since 60s` showed:
  `{"context":"CredentialVerifierService","environment":"development","level":"warn","message":"Invalid password attempt","requestId":"yesaqlzd","service":"portfolio","timestamp":"2026-08-21T02:49:15.457Z","username":"diagtempuser"}`
  - valid JSON, `level: warn`, `message` and `username` match `auth.ts:165`'s call, plus
    `context`/`requestId`/`service`/`environment`/`timestamp` from the 4.1 pipeline.
- Unknown username (`nonexistentuser` / anything) - `{"matched":false}`, and grepping the
  same log window for that request's time confirmed no additional log line was emitted
  (only the three routing/warn lines above and the boot sequence appear).

`backend/src/auth/diag-temp.controller.ts` and its `AuthModule.controllers` registration
were then deleted; `git status` shows no trace of either. A rebuild + restart afterward
confirmed `GET /backend/api/health` still returns `200` and `GET
/backend/api/diag-temp/verify` returns `404`.

The temporary `diagtempuser` row was deleted from `portfolio-db` after the check; no
other rows in `User` were touched.

### Changed Files

+ backend/src/auth/credential-verifier.service.ts   `CredentialVerifierService.verify()` - bcrypt check against the `User` table, matches `auth.ts:142-176`'s failure-path logging
~ backend/src/auth/auth.module.ts                   registers `CredentialVerifierService` as a provider
~ backend/package.json                              adds `bcrypt` and `@types/bcrypt` dependencies
~ pnpm-lock.yaml                                     lockfile update for the two new dependencies

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning at `main.ts:51` (unrelated to this story, present since
  story 4.1).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `docker compose build nest-api` + `docker compose restart nest-api` - container boots
  cleanly; see Section B evidence above for the three `verify()` scenarios exercised
  against the real `portfolio-db`.
- After removing the diagnostic controller and rebuilding again: `curl -sk
  https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1`
  returned `200` `{"status":"ok"}`; the diagnostic route returned `404`.
