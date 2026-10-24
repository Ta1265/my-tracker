# Story 4.8: Demonstrate Next.js reads a Nest-issued session, including Edge middleware

Status: Done

## Context

Closes Epic 4 and unblocks Epic 5. Two things get proven here, both left unverified at
design time: **FR-8** - a Next.js server component can read a Nest-issued session - and
the **cross-library interop** architecture flags as "not run during this phase": a token
`@nestjs/jwt` signs with ES256, verified by `jose` through a WebCrypto `CryptoKey`.

Per architecture's finding F1, this has to be proven from **inside Edge middleware
specifically**, not only from a server component: `src/middleware.ts` is an unlisted
session consumer the brief and PRD both missed, it runs exclusively on Next 14.0.1's Edge
sandbox (no Node.js APIs, no `jsonwebtoken`), and a demonstration limited to a server
component (which runs in Node and would succeed even if the Edge path were broken) proves
less than it appears to.

This story **proves the read is possible without changing how any page behaves today**
(PRD: "without yet changing how that page behaves") - it does not wire the seam that
actually switches the frontend over. That's Epic 6 (build the seam) and Epic 7 (flip it).
Every change this story makes to `frontend/` is either (a) the one permanent, inert
addition in section A, or (b) temporary and fully reverted before the story is Done -
`src/middleware.ts`, `src/app/page.tsx`, and `src/app/login/page.tsx` are not under GR-1's
protected paths (`src/app/api/`, `src/server/`), but this story still must not leave them
behaviorally different from before it ran.

## Acceptance Criteria

### A. `packages/shared`'s `./verify` subpath (architecture "Two entry points, deliberately")

> **Reversed by Round 4 owner feedback (Epic 4).** The owner questioned why a
> single-consumer verifier lived in a shared package: the backend verifies through
> `SessionService`/`@nestjs/jwt` and never imports `./verify`, so `packages/shared` had
> exactly one caller for this file and no reason to carry `jose` as a dependency.
> `verifySessionToken` moved to `frontend/src/server/session.ts` (same implementation,
> now importing `SESSION_ALGORITHM`/`SessionClaims` from `@portfolio/shared`'s root
> instead of `./index`), `jose` moved from `packages/shared/package.json` to
> `frontend/package.json`, and the `./verify` subpath was dropped from
> `packages/shared/package.json`'s `exports` map along with its `dist/verify.*` output.
> `packages/shared` is now types/constants only, importable by both workspaces with no
> runtime dependencies. The checkboxes below and the interop-proof Dev Notes are left as
> the historical record of what Epic 4 actually verified - the ES256-sign/`jose`-verify
> cross-library proof still stands unchanged; only the file's home changed.

- [x] `packages/shared/src/verify.ts` exports `async function verifySessionToken(token:
      string, publicKeyJwk: string): Promise<SessionClaims>` - imports `jose`, parses
      `publicKeyJwk` and imports it via `jose.importJWK(..., SESSION_ALGORITHM)`, then
      `jose.jwtVerify(token, key, { algorithms: [SESSION_ALGORITHM] })` (pinning the
      algorithm list, same reasoning as story 4.5's `SessionService.verify()` - never
      leave it open to the token's own header). Returns the verified payload cast to
      `SessionClaims`.
- [x] `packages/shared/package.json` gains `jose@6.2.9` as a dependency (architecture's
      pinned version - jose 6 targets Node 20+, which is satisfied everywhere in this
      workspace since story 1.2a). This is the **only** place `jose` enters
      `packages/shared`'s dependency graph - the package root (`index.ts`, consumed by
      the backend) imports nothing from `./verify`, so the backend's dependency graph
      never pulls in `jose` at all (it signs with `@nestjs/jwt` and never needs it).
      Confirm this by checking `backend/node_modules/@portfolio/shared` after `pnpm
      install` does not resolve `jose` anywhere in the backend's install closure.
- [x] `frontend/package.json` gains `@portfolio/shared` as a dependency
      (`workspace:*`) - this is the frontend's first use of the shared package.

### B. Cross-library interop and Edge middleware, demonstrated then reverted

- [x] Obtain one real, live `portfolio_session` cookie value by calling `POST
      /backend/api/auth/login` against the running stack (story 4.5) with a real user.
- [x] Temporarily add a call to `verifySessionToken(...)` inside `src/middleware.ts`'s
      existing `withAuth` callback, gated so it runs only for a request path that no real
      page uses today (e.g. matched separately, or behind a header/query param check that
      production traffic never sets) - the goal is exercising `verifySessionToken` inside
      the real Edge sandbox this Next 14.0.1 app boots, not changing `/stats` or
      `/product/*`'s actual gating behavior for any real request. `console.log` (or throw,
      to make success/failure unambiguous in the response) the verified claims.
      `SESSION_PUBLIC_KEY_JWK` needs to reach the frontend container for this - confirm
      it's already supplied there (architecture: "supplied to both containers"; add it to
      `docker-compose.yml`'s `next-app` `env_file`/`environment` if it is not already
      wired, since story 4.5 only guaranteed it reaches `nest-api`).
- [x] Hit that path through the real Edge middleware (via `docker compose up`, over the
      local HTTPS flow, cookie attached) with the live token from the first bullet.
      Confirm the middleware successfully verifies it - the claims logged/returned match
      what was signed. This is the one check architecture calls out as unverified at
      design time; capture the transcript in Dev Notes.
- [x] Fully revert the temporary `src/middleware.ts` change - `git diff
      frontend/src/middleware.ts` is empty at the end of this story. The matcher, the
      `withAuth` wrapper, and the IP-forwarding logic are byte-identical to before this
      story ran.
- [x] Separately, demonstrate the Node-runtime (server-component) path: a temporary
      script or a temporary throwaway route **outside** `src/app/page.tsx` and
      `src/app/login/page.tsx` (e.g. a scratch file deleted before this story is Done, not
      a permanent addition to either page) calls `verifySessionToken(...)` with the same
      live cookie value from a plain Node context and confirms success. This is the
      lower-risk half (Node has full `node:crypto`, unlike Edge), included for
      completeness since FR-8 names server components explicitly - but per architecture,
      it is not where the real risk was.
- [x] Confirm `src/app/page.tsx` and `src/app/login/page.tsx` are unmodified (`git diff`
      empty for both) - this story proves the read is possible, it does not change either
      page's behavior, per the PRD's explicit instruction.

### C. Regression

- [x] `pnpm --filter @portfolio/shared build`, `pnpm --filter @portfolio/backend
      build`/`typecheck`/`lint` all pass.
- [x] `docker compose up -d --build` brings up the full stack over local HTTPS;
      `/`, `/login`, and `/stats` (via existing NextAuth session - unaffected by this
      story) all behave exactly as before. `GET /backend/api/health` still `200`.
- [x] `git status` shows only the permanent changes from section A
      (`packages/shared/src/verify.ts`, `packages/shared/package.json`,
      `frontend/package.json`, `pnpm-lock.yaml`, and the `docker-compose.yml`
      `SESSION_PUBLIC_KEY_JWK` wiring for `next-app` if it was missing) - nothing under
      `src/middleware.ts`, `src/app/page.tsx`, or `src/app/login/page.tsx`.

## Technical Notes

### Why Edge middleware can do this at all (architecture F1, restated for this story only)

Next 14.0.1's Edge sandbox binds its `crypto` global to Node's `webcrypto`, so ECDSA
P-256 verification inside middleware runs on the host Node's real cryptographic
capabilities even though the sandbox's API surface is Web-standard-only. This is why
`jose` (WebCrypto-based, no `node:crypto` dependency) is the only library that can run on
this path at all - `jsonwebtoken` (which the backend uses to sign) cannot load in the Edge
sandbox under any circumstance, algorithm choice notwithstanding.

### `SESSION_PUBLIC_KEY_JWK` reaching `next-app`

Story 4.5 added this env var to `defaults.env` (blank placeholder) and wired it into
`nest-api`. Whether `next-app`'s Compose service already reads the same `defaults.env`/
`override.env` pair (it does, for other vars) determines whether any `docker-compose.yml`
edit is needed here at all - check before assuming one is required.

## Out of Scope

- Building the actual switchable auth seam (client-side session reads, server-component
  gating, middleware gating, all behind one config value) - story 6.2.
- Flipping any real page or middleware over to the Nest session - story 7.1.
- Any change to NextAuth or `frontend/src/server/auth.ts` - GR-1, FR-11.

## Dev Notes

### `SESSION_PUBLIC_KEY_JWK` already reaches `next-app` - no `docker-compose.yml` edit

`next-app`'s service block in `docker-compose.yml` already lists
`env_file: [./defaults.env, ./override.env]`, the same pair `nest-api` uses. Since story
4.5 added `SESSION_PRIVATE_KEY_JWK`/`SESSION_PUBLIC_KEY_JWK` to `defaults.env` (blank
placeholders, real values in the gitignored `override.env`), `next-app` already receives
`SESSION_PUBLIC_KEY_JWK` with no Compose change needed. Confirmed by reading `env_file`
for both services before assuming an edit was required.

### `packages/shared`'s `exports` map for the `./verify` subpath

`packages/shared/package.json` gained an `"exports"` field mapping `"."` to
`dist/index.js`/`dist/index.d.ts` and `"./verify"` to `dist/verify.js`/`dist/verify.d.ts`
- this is what lets `frontend/` (and any Node consumer) `import { verifySessionToken }
from '@portfolio/shared/verify'` as a genuinely separate entry point that pulls in `jose`,
while `import ... from '@portfolio/shared'` (the backend's only import) resolves to the
root and never touches `jose`. `main`/`types` were left in place alongside `exports` for
tooling that does not read the `exports` map.

### Demonstration setup: a temporary user row, not a real credential

No real user's password was available for this diagnostic. A temporary row (`username:
diag48`, password `TestPass123!`, bcrypt-hashed with the same `bcrypt` binary installed
in the running `nest-api` container: `docker exec nest-api sh -c "cd /app/backend && node
-e \"require('bcrypt').hash(...)\""`) was inserted directly into `portfolio-db`'s `User`
table for the duration of the check and deleted immediately after (`DELETE FROM User
WHERE username='diag48'`), mirroring story 4.5's approach. `POST
/backend/api/auth/login` against the running stack (story 4.5) with this user produced
the one real `portfolio_session` cookie used for every check below.

### Edge middleware transcript (the check architecture flags as unverified at design time)

`src/middleware.ts` was temporarily edited to add, inside `withAuth`'s callback: if
request header `x-diag-verify-session: 1` is set, read the `portfolio_session` cookie via
`SESSION_COOKIE_NAME` (imported from `@portfolio/shared`), call `verifySessionToken(token,
process.env.SESSION_PUBLIC_KEY_JWK!)` (imported from `@portfolio/shared/verify`), then
`console.log` and `throw` the verified claims to make success/failure unambiguous in the
response. `withAuth`'s second-argument `authorized` callback was also temporarily
overridden to let requests carrying that header through regardless of NextAuth session
state, so the check could hit the existing `/stats` matcher without a live NextAuth
session - `production traffic never sets this header`, so `!!token` (the prior default)
is preserved for every real request.

`frontend/Dockerfile` needed a temporary matching change (mirroring the pattern already
in `backend/Dockerfile` from story 4.5): copy `packages/shared/package.json` into the
`deps` stage and add it to the filtered `pnpm install`, then copy `packages/shared`'s
source/`node_modules` into `common-build` and run `pnpm --filter @portfolio/shared build`
before the frontend's own build. Without this, `frontend/`'s `node_modules/@portfolio/shared`
symlink pointed at a directory (`/app/packages/shared`) that was never copied into the
image, and webpack failed to resolve `@portfolio/shared/verify` with `Module not found`.
This Dockerfile change was reverted along with `middleware.ts` once the check was done -
it is not part of this story's permanent footprint, since nothing in `frontend/` imports
`@portfolio/shared` after the revert.

After `docker compose up -d --build` with both temporary changes in place, over the real
HTTPS flow (`--resolve www.tubesock.xyz:443:127.0.0.1`), with the live cookie from the
temporary `diag48` login attached and the diagnostic header set:

```
curl -sk -i https://www.tubesock.xyz/stats --resolve www.tubesock.xyz:443:127.0.0.1 \
  -H "x-diag-verify-session: 1" \
  -H "Cookie: portfolio_session=<live token>"
```

returned an HTTP 500 (expected - the diagnostic throws on success to make the result
unambiguous) whose body's `err.source` is `"edge-server"` (confirming this ran inside the
real Edge sandbox, not a Node fallback) and whose `err.message` is:

```
DIAG_OK: {"sub":6,"username":"diag48","email":"diag48@example.com","name":"Diag Story48","rememberMe":false,"jti":"b155c103-128f-4875-b1bb-881ea0eda01e","iat":1787282104,"exp":1787310904}
```

- an exact match for the claims signed at login. `docker logs next-app` independently
confirms the same claims via the `console.log` call, with a stack trace rooted at
`webpack-internal:///(middleware)/./src/middleware.ts:27:15`, i.e. inside the compiled
Edge middleware bundle. This is the ES256-sign/`jose`-verify, `@nestjs/jwt`-to-`jose`
cross-library interop that architecture flagged as unverified at design time, proven
inside the actual Edge sandbox this app boots on Next 14.0.1.

A control request without the diagnostic header, over the same running stack, confirmed
no change to real traffic's behavior: `GET /stats` still `307`s to
`/api/auth/signin?callbackUrl=%2Fstats` (no NextAuth session), exactly as before this
story.

### Node-runtime path (the lower-risk half, included for FR-8 completeness)

With the same temporary Dockerfile change still in place, a scratch file
(`/app/frontend/diag-node-verify.mjs`, created directly inside the running container via
`docker exec`, never written to the host tree or committed) imported
`verifySessionToken` from `@portfolio/shared/verify` and called it in a plain Node
context with the same live cookie:

```
$ docker exec next-app sh -c "cd /app/frontend && node diag-node-verify.mjs '<live token>'"
NODE_DIAG_OK: {"sub":6,"username":"diag48","email":"diag48@example.com","name":"Diag Story48","rememberMe":false,"jti":"b155c103-128f-4875-b1bb-881ea0eda01e","iat":1787282104,"exp":1787310904}
```

- same claims, verified successfully under full `node:crypto`. The scratch file was
deleted from the running container (`docker exec next-app rm
/app/frontend/diag-node-verify.mjs`) immediately after.

### Full revert, confirmed

`git checkout -- frontend/src/middleware.ts frontend/Dockerfile` restored both files;
`git diff frontend/src/middleware.ts frontend/Dockerfile frontend/src/app/page.tsx
frontend/src/app/login/page.tsx` is empty. The temporary `diag48` `User` row was deleted
from `portfolio-db`. `docker compose up -d --build` was run once more from this fully
reverted state to confirm the stack still builds and runs correctly with no temporary
code present (see Verification).

### Changed Files

+ packages/shared/src/verify.ts    `verifySessionToken()` - `jose`-based ES256 verify, algorithm-pinned, the only file in the package importing `jose` (moved to `frontend/src/server/session.ts` by Round 4 owner feedback, see below)
~ packages/shared/package.json     adds `jose@6.2.9` dependency and an `exports` map splitting the package root from the `./verify` subpath (both reverted by Round 4 owner feedback, see below)
~ frontend/package.json            adds `@portfolio/shared` (`workspace:*`) - the frontend's first use of the shared package
~ pnpm-lock.yaml                   lockfile update for `jose` and the frontend's new workspace dependency

**Round 4 owner feedback (Epic 4):**

- packages/shared/src/verify.ts    moved to `frontend/src/server/session.ts`; import source for `SESSION_ALGORITHM`/`SessionClaims` switched from `./index` to `@portfolio/shared`
+ frontend/src/server/session.ts   `verifySessionToken()`, same implementation, now living next to its one real caller
~ packages/shared/package.json     drops `jose@6.2.9` and the `./verify` `exports` subpath - the package is types/constants only again
~ frontend/package.json            adds `jose@6.2.9` (moved from `packages/shared`)
~ pnpm-lock.yaml                   lockfile update moving `jose` from `packages/shared` to `frontend`

### Verification

- `pnpm --filter @portfolio/shared build` - passed (`tsc`, emits `dist/index.js`,
  `dist/verify.js`, and matching `.d.ts` files).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no errors).
- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts` (present since story 4.1,
  unrelated to this story).
- Confirmed `jose` never enters the backend's install closure: after `pnpm install`,
  `backend/node_modules/@portfolio/shared` resolves to the workspace package with no
  `jose` anywhere under `backend/node_modules` or reachable from
  `@portfolio/shared`'s root export.
- `docker compose up -d --build` (final, fully-reverted state) brought up the full stack
  over local HTTPS. `GET /backend/api/health` returned `200 {"status":"ok"}`. `GET /`
  returned `307` (pre-existing redirect for an unauthenticated visit, unrelated to this
  story), `GET /login` returned `200`, `GET /stats` returned `307` to
  `/api/auth/signin?callbackUrl=%2Fstats` (no NextAuth session) - all unchanged from
  before this story.
- `git status` after the full revert shows only `frontend/package.json`,
  `packages/shared/package.json`, `packages/shared/src/verify.ts` (new), and
  `pnpm-lock.yaml` - no `docker-compose.yml` change was needed (see Dev Notes), and
  nothing under `src/middleware.ts`, `frontend/Dockerfile`, `src/app/page.tsx`, or
  `src/app/login/page.tsx`.
- Cross-library interop and Edge middleware demonstration: see the "Edge middleware
  transcript" and "Node-runtime path" sections above for the full live transcripts
  against the real Next 14.0.1 Edge sandbox and a plain Node context, both against a
  live `portfolio_session` cookie issued by the running `nest-api`.

**Round 4 owner feedback re-verification:**

- `pnpm install` - lockfile updated, moving `jose@6.2.9` from `packages/shared` to
  `frontend`; `Lockfile passes supply-chain policies`.
- `rm -rf packages/shared/dist && pnpm --filter @portfolio/shared build` - passed
  (`tsc`), now emits only `index.js`/`index.d.ts` (no `verify.*`).
- `pnpm --filter @portfolio/shared typecheck && pnpm --filter @portfolio/shared lint` -
  both passed, no errors or warnings.
- `pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend lint` -
  both passed; only the pre-existing `no-floating-promises` warning on `main.ts:53`
  (unchanged from Round 1).
- `grep -rn "shared/verify" backend frontend packages` (excluding `node_modules`/`dist`)
  - no hits; nothing imports the old subpath.
- `cd frontend && pnpm lint` (`next lint`) - only pre-existing warnings across unrelated
  files; `src/server/session.ts` does not appear in the output.
- `cd frontend && npx tsc --noEmit -p tsconfig.json` - only pre-existing errors in
  unrelated files (this workspace has no enforced typecheck gate); `src/server/session.ts`
  does not appear in the output.
