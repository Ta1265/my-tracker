# Story 4.5: `packages/shared`, session issuance, and the login/logout endpoints

Status: Done

## Context

The first story that actually issues a session. Creates `packages/shared` (deferred here
from Epic 1 per architecture's rollout note - "it has no consumers until the session type
exists"), wires ES256 JWT signing (architecture's Session design table, D2-D9), and
replaces the Epic 2 stub bodies of `POST /auth/login` and `POST /auth/logout`
(`backend/src/auth/auth.controller.ts`) with real behavior. Depends on 4.2 (clock, for
`exp`), 4.3 (error filter, for the `401` shape on bad credentials), and 4.4 (credential
verification).

## Acceptance Criteria

### A. `packages/shared` scaffold (architecture D25)

- [x] `packages/shared/package.json` - `"name": "@portfolio/shared"`, `"private": true`,
      a `tsc` build (`"build": "tsc"`, `main`/`types` pointing at `dist/`). Already
      covered by `pnpm-workspace.yaml`'s existing `packages/*` glob entry - no workspace
      file edit needed, just `pnpm install` to pick it up as a resolved member.
- [x] `packages/shared/tsconfig.json` extends the root `tsconfig.base.json`.
- [x] `packages/shared/src/index.ts` exports, **and nothing else** (D25 - response DTOs
      are explicitly out, since they'd drag `@nestjs/swagger` into the frontend bundle):
      - `SESSION_ALGORITHM = 'ES256' as const`
      - `SESSION_COOKIE_NAME = 'portfolio_session' as const`
      - `interface SessionClaims { sub: number; username: string; email: string; name:
        string; rememberMe: boolean; jti: string; iat: number; exp: number }` (mirrors
        `frontend/src/server/auth.ts:82-96`'s token shape)
      - `interface SessionUser { id: number; username: string; email: string; name:
        string }` and `interface Session { isAuthenticated: boolean; user: SessionUser }`
        (the FR-9 whitelisted shape)
- [x] No `./verify` subpath yet, and no `jose` dependency - both are story 4.8's job, when
      the frontend becomes a second consumer. The backend imports only the package root.
- [x] `backend/package.json` depends on `@portfolio/shared` (`workspace:*`) and
      `@nestjs/jwt` (matching Nest 11's peer range), plus `bcrypt`/`@types/bcrypt` if
      story 4.4 has not already added them (it lands first in this epic, so they should
      already be present - confirm rather than duplicate).

### B. Signing keys (architecture "Key handling, concretely")

- [x] `AppConfigService` gains two required getters, following `databaseUrl`'s existing
      pattern (validated once in the constructor, exposed as a non-optional `readonly`
      field, throws if missing/empty): `sessionPrivateKeyJwk: string` (raw JSON string
      from `SESSION_PRIVATE_KEY_JWK`) and `sessionPublicKeyJwk: string` (from
      `SESSION_PUBLIC_KEY_JWK`).
- [x] `defaults.env` gains `SESSION_PRIVATE_KEY_JWK=` and `SESSION_PUBLIC_KEY_JWK=` as
      blank placeholders, matching the existing pattern for `METRICS_SECRET`/
      `NEXTAUTH_SECRET` (committed blank, real values supplied via the gitignored
      `override.env` per host). Record the exact `openssl` key-generation and
      JWK-conversion commands architecture specifies in Dev Notes so the owner can
      generate a real dev keypair locally:
      ```
      openssl ecparam -name prime256v1 -genkey -noout -out es256.key
      openssl pkcs8 -topk8 -nocrypt -in es256.key -out es256-private.pem
      openssl ec -in es256.key -pubout -out es256-public.pem
      ```
      then convert both PEM files to single-line JWK JSON (e.g. via Node's
      `crypto.createPrivateKey(pem).export({ format: 'jwk' })` /
      `createPublicKey(...).export({ format: 'jwk' })`, `JSON.stringify`'d) for
      `override.env`. Keys are never committed.
- [x] `backend/src/auth/auth.module.ts` wires `JwtModule.registerAsync({ inject:
      [AppConfigService], useFactory: (config) => ({ privateKey:
      crypto.createPrivateKey({ key: JSON.parse(config.sessionPrivateKeyJwk), format:
      'jwk' }), publicKey: crypto.createPublicKey({ key:
      JSON.parse(config.sessionPublicKeyJwk), format: 'jwk' }), signOptions: { algorithm:
      SESSION_ALGORITHM } }) })` (`SESSION_ALGORITHM` imported from `@portfolio/shared`,
      not re-declared as a local literal - the whole point of D25's shared constant is
      that this string is written once).

### C. `SessionService` - the one place tokens are signed and verified

- [x] `backend/src/auth/session.service.ts` exports an injectable `SessionService`,
      constructor-injecting `JwtService` and `@Inject(CLOCK) clock: Clock` (story 4.2).
      Two methods:
      - `issue(user: { id: number; username: string; email: string; name: string },
        rememberMe: boolean): { token: string; maxAgeSeconds: number }` - builds
        `SessionClaims` with `sub: user.id`, `jti: randomUUID()`, `iat` computed from
        `clock.now()` (never `Date.now()`/`new Date()` directly - NFR-1), `exp = iat + (
        rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60)` (FR-7's 30-day/8-hour split,
        matching `auth.ts:103`'s numbers exactly). Signs with
        `jwtService.sign(claims, { algorithm: SESSION_ALGORITHM, noTimestamp: true })` -
        `noTimestamp: true` is required, otherwise `jsonwebtoken` overwrites `iat` with
        its own internal `Date.now()`-based value, silently reintroducing the ambient
        clock read this story exists to eliminate. Returns the signed token plus
        `maxAgeSeconds` (same 8h/30d number) for the cookie's `Max-Age`.
      - `verify(token: string): SessionClaims` - `jwtService.verify(token, { algorithms:
        [SESSION_ALGORITHM] })`, **explicitly pinning the algorithm list** (architecture:
        "Never verify with the algorithm list left open" - an attacker-controlled token
        header cannot request a downgrade). Catches any verification failure
        (`TokenExpiredError`, `JsonWebTokenError`, missing token) and rethrows
        `UnauthorizedException` - this is the single place session-verification failure
        becomes the FR-5 `401` shape, so every caller (this story's `session` handler,
        and story 4.7's guard) gets it for free rather than re-implementing the mapping.
- [x] `backend/src/auth/session-response.mapper.ts` (or a static method on
      `SessionService` - either is fine) exports `toSessionResponse(claims:
      SessionClaims): LoginResponseDto`, the FR-9 whitelist mapper: `{ isAuthenticated:
      true, user: { id: claims.sub, username: claims.username, email: claims.email, name:
      claims.name } }`. `rememberMe`, `jti`, `iat`, `exp` never appear in the returned
      object. **Story 4.6 reuses this exact function for the session endpoint - it does
      not write its own mapping.**

### D. Real `login` and `logout` handlers

- [x] `POST /backend/api/auth/login` (`auth.controller.ts`): calls
      `credentialVerifierService.verify(body.username, body.password)` (story 4.4). On
      `null`, throws `new UnauthorizedException()` (4.3's filter shapes it to `401
      { error: 'Unauthorized' }`). On success, calls `sessionService.issue(user,
      body.rememberMe)`, sets the cookie via `@Res({ passthrough: true }) res: Response`:
      `res.cookie(SESSION_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite:
      'lax', path: '/', maxAge: maxAgeSeconds * 1000 })` (D7 - httpOnly, `Secure`,
      `SameSite=Lax`, `Path=/`), and returns `toSessionResponse(claims)`.
- [x] `POST /backend/api/auth/logout`: unconditionally calls
      `res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })` and returns `204` - **does
      not** check for an existing session first (architecture D9: "FR-10's own wording
      scopes invalidation to the browser and server components," not to requiring a valid
      session to log out of). This **corrects story 2.4's scaffold**, which documented
      logout with `@ApiCookieAuth()` as a provisional guess before this epic settled the
      real design - remove that decorator from `logout` in this story, and note the
      correction in Dev Notes.
- [x] Both handlers' Swagger annotations from 2.4 stay otherwise accurate (`login`
      remains public, documents `200`/`401`; `logout` documents `204`).

### E. Verification

- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, `lint` all pass.
- [x] Against the running stack with a real user row and a real dev keypair in
      `override.env`: `curl -i -X POST .../auth/login -d
      '{"username":"...","password":"...","rememberMe":false}'` returns `200`, a
      `Set-Cookie: portfolio_session=...` header (`HttpOnly`, `Secure`, `SameSite=Lax`,
      `Path=/`), and the whitelisted body. Decode the JWT payload (base64, no
      verification needed for this check) and confirm `alg` header is `ES256` and the
      claim set matches `SessionClaims` with no extra fields.
- [x] Same request with `rememberMe: true` produces a token whose `exp - iat` is exactly
      `30 * 24 * 60 * 60`; `rememberMe: false` produces exactly `8 * 60 * 60`.
- [x] Wrong password: `401` with body exactly `{ "error": "Unauthorized" }`.
- [x] `POST .../auth/logout` (with or without a prior cookie) returns `204` and a
      `Set-Cookie` header that clears `portfolio_session` (empty value, `Max-Age=0` or
      past `Expires`).
- [x] `docker compose up -d --build` brings up the full stack; `GET /backend/api/health`
      still `200`.

## Technical Notes

### Current state

`backend/src/auth/auth.controller.ts` has three stub handlers, all throwing
`NotImplementedException` (story 2.4). `AppConfigService` (1.4, extended by 2.3) has
`databaseUrl`, `metricsSecret`, `priceProvider`, `swaggerEnabled` getters - this story
adds two more following the same required/optional pattern.

### `@nestjs/jwt` and JWK, concretely

`@nestjs/jwt`'s `privateKey`/`publicKey` options accept Node `KeyObject`s directly
(verified by architecture at design time) - convert the JWK env values with
`crypto.createPrivateKey({ key: <parsed JWK>, format: 'jwk' })` /
`crypto.createPublicKey(...)`, do not attempt to re-serialize to PEM first.

## Out of Scope

- The `GET /auth/session` endpoint - story 4.6, which reuses this story's
  `toSessionResponse()` mapper and `SessionService.verify()`.
- The reusable auth guard and `@CurrentUser()` decorator - story 4.7. This story's login
  handler calls `credentialVerifierService`/`sessionService` directly; nothing here is
  guarded.
- `packages/shared`'s `./verify` subpath and the frontend-side `jose` verification -
  story 4.8.
- Any change to `frontend/`.

## Dev Notes

### Deviation from AC C: `noTimestamp: true` is not used

AC C's technical detail is wrong for the installed `jsonwebtoken@9.0.3` (`@nestjs/jwt`'s
dependency): reading `node_modules/jsonwebtoken/sign.js` directly (not assumed), `if
(options.noTimestamp) { delete payload.iat; }` runs **unconditionally**, even when the
caller already supplied an `iat`. Setting `noTimestamp: true` therefore does not "skip
auto-generation" as the story text describes - it deletes the clock-derived `iat` this
story exists to produce. Confirmed live: with `noTimestamp: true` set, the signed
token's decoded payload had no `iat` key at all.

Leaving the option **off** (the actual fix) still produces the correct, clock-derived
`iat`: the same file computes `const timestamp = payload.iat || Math.floor(Date.now() /
1000)`, then (since `noTimestamp` is falsy) `payload.iat = timestamp`. Because
`SessionService.issue()` always sets `claims.iat` before signing, that value is truthy
and wins over the `Date.now()` fallback - the reassignment is a no-op that restores the
same value. Verified end to end: a real login token's decoded payload carries `iat`
equal to `Math.floor(clock.now().getTime() / 1000)` and `jwtService.sign()` is never
given a payload without a pre-set `iat`, so the `Date.now()` branch is provably
unreachable. `session.service.ts:44-50` documents this inline. NFR-1 (no ambient clock
read) holds either way - the only thing AC C got wrong was the mechanism, not the
requirement.

### `HttpCode(200)` on login

Not explicit in AC D's prose, but required by AC E's verification bullet ("returns
`200`"). Nest's default status for a `@Post` handler is `201`; `@HttpCode(200)` was added
to `login` to match. `logout` already had `@HttpCode(204)` from story 2.4.

### `AuthModule`'s `JwtModule.registerAsync` builds a `JsonWebKey` from `JSON.parse`

`JSON.parse(config.sessionPrivateKeyJwk)` returns `any`; it's cast to Node's
`crypto.JsonWebKey` type (not a bare `object`) to satisfy `createPrivateKey`/
`createPublicKey`'s overloads under `tsc --noEmit`'s strict mode.

### Dockerfile changes for `packages/shared`

`backend/Dockerfile` did not previously copy or build `packages/shared` at all (its
existing comment said backend "does not depend on ... `packages/shared` yet" - now it
does). Updated per architecture's documented layering:

- `deps` stage now copies `packages/shared/package.json` and installs with
  `--filter @portfolio/backend... --filter @portfolio/shared` - the `...` pull-in alone
  only installs `@portfolio/shared` as a production dependency of `backend`, not its own
  `devDependencies` (`typescript`), so the explicit second `--filter` was needed for
  `packages/shared`'s own `tsc` build to have a `tsc` binary to run. Discovered via a
  real failing build (`sh: 1: tsc: not found`), not anticipated from the architecture
  doc, which only covers the manifest-copy problem, not this devDependency-installation
  detail.
- `common-build` now also copies `packages/shared`'s own `node_modules` (a workspace
  symlink dir, mirroring the existing `backend/node_modules` copy) - without it, `tsc`
  inside `packages/shared` had no `node_modules/.bin/tsc` to resolve after the `deps`
  stage's layer was left behind.
- `common-build` copies `packages/shared` source and runs
  `pnpm --filter @portfolio/shared build` before either the `dev` or `builder` stage
  branches off, so both a running dev container and the production build see a real
  `packages/shared/dist`.

### Session-signing key generation (AC B)

Real `openssl` + JWK-conversion commands, exercised for real to produce a local dev
keypair for verification (see below), matching the story text and architecture's "Key
handling, concretely" section exactly:

```
openssl ecparam -name prime256v1 -genkey -noout -out es256.key
openssl pkcs8 -topk8 -nocrypt -in es256.key -out es256-private.pem
openssl ec -in es256.key -pubout -out es256-public.pem
```

then, in Node:

```js
const crypto = require('crypto');
const fs = require('fs');
const priv = crypto.createPrivateKey(fs.readFileSync('es256-private.pem'));
const pub = crypto.createPublicKey(fs.readFileSync('es256-public.pem'));
console.log(JSON.stringify(priv.export({ format: 'jwk' })));
console.log(JSON.stringify(pub.export({ format: 'jwk' })));
```

Both single-line JWK JSON strings go into `override.env` as `SESSION_PRIVATE_KEY_JWK` /
`SESSION_PUBLIC_KEY_JWK`. This was done locally in `override.env` (gitignored, not
committed) to exercise the login/logout endpoints below; the owner should generate their
own keypair the same way for their environment.

### `logout`'s `@ApiCookieAuth()` removal (correction to story 2.4)

Story 2.4 documented `logout` with `@ApiCookieAuth()` as a provisional guess before this
epic settled the real design. Removed here: `logout` now unconditionally clears the
cookie and never checks for an existing session, so annotating it as requiring cookie
auth was inaccurate. `login` and `session` (session still a 4.6 stub) keep their existing
annotations - `login` is public by design, `session` (4.6) genuinely will require a
session.

### `User.name` is optional; `SessionClaims.name` is not

`backend/src/db/entities/user.entity.ts`'s `name?: string` can be `undefined`;
`SessionClaims.name` is `string`. `auth.controller.ts`'s `login` handler coerces with
`user.name ?? ''`, matching `frontend/src/server/auth.ts`'s own looseness here (it passes
`user.name` through untyped-checked in the NextAuth `authorize()` callback).

### Verification evidence (AC E)

A temporary user (`username: diagtemp45`, password `TestPass123!`, bcrypt-hashed with the
same `bcrypt` version installed in the `nest-api` image) was inserted directly into
`portfolio-db`'s `User` table (`PORTFOLIO.User`) for the duration of this check and
deleted immediately after.

`docker compose up -d --build`, then via `curl -sk ... --resolve
www.tubesock.xyz:443:127.0.0.1` against `https://www.tubesock.xyz`:

- `POST /backend/api/auth/login` with `{"username":"diagtemp45","password":"TestPass123!","rememberMe":false}`
  returned `200`, a `Set-Cookie: portfolio_session=...; Max-Age=28800; Path=/;
  Expires=...; HttpOnly; Secure; SameSite=Lax` header, and body
  `{"isAuthenticated":true,"user":{"id":3,"username":"diagtemp45","email":"diagtemp45@example.com","name":"Diag Temp"}}`.
  Decoded the JWT (base64, unverified) - header `{"alg":"ES256","typ":"JWT"}`, payload
  `{"sub":3,"username":"diagtemp45","email":"diagtemp45@example.com","name":"Diag
  Temp","rememberMe":false,"jti":"...","iat":1787281065,"exp":1787309865}` - exactly the
  8 `SessionClaims` fields, no extras.
- Same request with `rememberMe: true` - decoded payload's `exp - iat = 2592000 = 30 * 24
  * 60 * 60`. The `rememberMe: false` request above: `exp - iat = 28800 = 8 * 60 * 60`.
- Wrong password (`WrongPass`) - `401` with body exactly `{"error":"Unauthorized"}`.
- `POST /backend/api/auth/logout` - `204` with `Set-Cookie: portfolio_session=;
  Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT` (cleared, past-dated).
- `docker compose up -d --build` brought up the full stack; `GET /backend/api/health`
  returned `200 {"status":"ok"}` both before and after the temporary user row was
  deleted.

The temporary `diagtemp45` row was deleted from `portfolio-db` after the check
(`DELETE FROM User WHERE username='diagtemp45'`); `git status` shows no trace of any
temporary diagnostic code (none was added - `auth.controller.ts`'s real handlers were
exercised directly).

### Changed Files

+ packages/shared/package.json                        `@portfolio/shared` scaffold - `tsc` build, `dist/` entry points; adds `typecheck`/`lint` scripts and eslint/prettier devDependencies so the workspace is covered by the same enforcement as `backend`/`frontend` (epic Round 1 review fix, F6)
+ packages/shared/eslint.config.mjs                    mirrors `backend/eslint.config.mjs` (epic Round 1 review fix, F6)
+ packages/shared/.prettierrc.json                     matches `backend/.prettierrc.json` (epic Round 1 review fix, F6)
+ packages/shared/tsconfig.json                        extends root `tsconfig.base.json`, mirrors `backend/tsconfig.json`'s compiler options
+ packages/shared/src/index.ts                         `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME`, `SessionClaims`, `SessionUser`, `Session` - types/constants only, no `jose`
+ backend/src/auth/session.service.ts                  `SessionService.issue()`/`.verify()` - ES256 signing off the injected clock, algorithm-pinned verification mapped to `401`; `issue()` now also returns the `claims` it signed, so `login` doesn't need a second `.verify()` call to recover them (epic Round 1 review fix, F3)
+ backend/src/auth/session-response.mapper.ts           `toSessionResponse()` - the FR-9 whitelist mapper, reused by story 4.6
~ backend/src/auth/dto/login-request.dto.ts             drops `@IsOptional()` from `username`/`password`, adds `@IsNotEmpty()` - a login body missing either field was reaching `CredentialVerifierService` as `undefined` and crashing into a `500` instead of the global `ValidationPipe`'s `400` (epic Round 1 review fix, F1); comment trimmed to two lines (epic Round 4 owner feedback, F9)
~ backend/src/auth/auth.controller.ts                  real `login`/`logout` handlers; `login` gets `@HttpCode(200)`; `logout` loses its provisional `@ApiCookieAuth()`; `login` defaults `rememberMe` to `false` instead of letting it sign as `undefined`, and reuses `issue()`'s returned claims instead of re-verifying the token it just signed (epic Round 1 review fix, F2/F3)
~ backend/src/auth/auth.module.ts                      wires `JwtModule.registerAsync` off `AppConfigService`'s JWK getters; registers `SessionService`
~ backend/src/config/app-config.service.ts              adds required `sessionPrivateKeyJwk`/`sessionPublicKeyJwk` getters, same validated-at-construction pattern as `databaseUrl`
~ backend/package.json                                  adds `@portfolio/shared` (`workspace:*`) and `@nestjs/jwt` dependencies
~ backend/Dockerfile                                    copies/builds `packages/shared` in both `deps` and `common-build` stages (see Dev Notes); refreshes a now-stale comment about session-signing keys; runs `pnpm --filter @portfolio/shared lint` in `common-build` (epic Round 1 review fix, F6)
~ defaults.env                                          adds blank `SESSION_PRIVATE_KEY_JWK`/`SESSION_PUBLIC_KEY_JWK` placeholders
~ pnpm-lock.yaml                                        lockfile update for the new dependencies and the new `packages/shared` workspace member

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts` (present since story 4.1).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `pnpm --filter @portfolio/shared build` - passed (`tsc`, no output/errors).
- `docker compose up -d --build` - full stack built and came up cleanly (including the
  new `packages/shared` build step inside the `nest-api` image); `GET
  /backend/api/health` returned `200 {"status":"ok"}`.
- Live endpoint verification against the running stack with a real dev ES256 keypair in
  `override.env` and a real `User` row - see Section "Verification evidence (AC E)"
  above for the full `login`/`logout` request/response pairs and decoded JWT payloads.

### Round 1 review fixes

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts`.
- Rebuilt the `nest-api` Docker image and restarted the container, then re-ran the
  reviewer's F1 repro against it: `curl -X POST .../auth/login -d '{}'` now returns
  `400 {"error":["username must be a string","username should not be empty","password
  must be a string","password should not be empty"]}` instead of a `500`; a
  username-only body 400s on the password field alone; a present-but-wrong
  username/password pair still reaches `verify()` and returns `401
  {"error":"Unauthorized"}`. No stack trace appears in `docker logs nest-api` for any
  of these.
- F2/F3: inserted a temporary `diagr1` user (bcrypt hash generated inside the running
  `nest-api` container) and logged in with `rememberMe` omitted from the request body.
  `POST /backend/api/auth/login` returned `200` with the correct
  `{"isAuthenticated":true,"user":{...}}` body, and the decoded JWT payload contains
  `"rememberMe":false` (previously dropped by `JSON.stringify` when `undefined`). The
  temporary row was deleted from `PORTFOLIO.User` immediately after.

### Round 3 owner feedback (epic F8)

Owner pressed the epic's F8 finding: planning-document identifiers in code comments.
Reworded the comments in `backend/src/auth/dto/login-request.dto.ts` (dropped `FR-5`),
`backend/src/auth/session-response.mapper.ts` (dropped `FR-9` and the "story 4.6"
cross-reference), and `backend/src/auth/auth.controller.ts`'s `logout` handler (dropped
`FR-10` and the "story 2.4" cross-reference) to keep each comment's reasoning while
removing the identifiers. Comment text only, no behavior change.
`pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend lint` -
both pass (same pre-existing `no-floating-promises` warning on `main.ts`).

### Round 4 owner feedback (epic F9)

`backend/src/auth/dto/login-request.dto.ts:4-5` - trimmed the three-line comment from
Round 3 to two lines, per `CLAUDE.md`'s limit. Kept the substance (the crash the
validators prevent), dropped the "this is the real login handler" framing, which was
context for the removed stub comment rather than something a reader needs.
`pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend lint` -
both pass (same pre-existing `no-floating-promises` warning on `main.ts`).
