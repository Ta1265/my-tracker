# Epic 4: Authentication - the first end-to-end slice

Status: Complete

Stories: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
Depends on: 3
Base commit: d95ac5047e90b17b10012fd98342e8d3d6d2b2e0
## Scope

The first place the backend does real work: a browser posts credentials, MySQL is read
through MikroORM (Epic 3's EM-by-DI pattern), and NestJS issues a stateless ES256-signed
JWT session that both the browser and Next.js server components (including Edge
middleware) can read. NextAuth stays live and untouched throughout (GR-1, FR-11) - the
frontend does not switch to the new session until Epic 7. Three cross-cutting concerns
land here because auth is their first genuine consumer and Epic 5 depends on all three
existing first: structured logging (4.1), the injectable clock (4.2, **blocks Epic 5**),
and global error shaping (4.3, **blocks Epic 5**). `packages/shared` is created in this
epic to hold the session claim contract both sides need.

## Changed Files

44 files across 8 stories plus Round 1 review fixes. Deduplicated - a file touched by
several stories appears once, with each story's contribution in the blurb.

+ backend/src/auth/credential-verifier.service.ts   `CredentialVerifierService.verify()` - bcrypt check against the `User` table, matches `auth.ts:142-176`'s failure-path logging (4.4)
+ backend/src/auth/current-user.decorator.ts        `@CurrentUser()` param decorator reading `request.user` (4.7)
+ backend/src/auth/express-request.d.ts             augments `Express.Request` with an optional `SessionClaims` `user` field (4.7)
+ backend/src/auth/session-response.mapper.ts       `toSessionResponse()` - the whitelist mapper, shared by login and the session endpoint (4.5); comment reworded to drop planning-document identifiers (Round 3 fix, F8)
+ backend/src/auth/session.guard.ts                 `CanActivate` reading the session cookie, verifying it, attaching `request.user` (4.7)
+ backend/src/auth/session.service.ts               `SessionService.issue()`/`.verify()` - ES256 signing off the injected clock, algorithm-pinned verification mapped to 401 (4.5); `issue()` now also returns the `claims` it signed, so callers don't need a second `.verify()` (Round 1 fix, F3)
+ backend/src/common/clock/clock.module.ts          `@Global()` `ClockModule` providing/exporting `CLOCK` (4.2)
+ backend/src/common/clock/clock.ts                 `Clock` interface and `CLOCK` DI token (Symbol) (4.2)
+ backend/src/common/clock/system-clock.ts          `SystemClock`, the sole permitted `new Date()` call site (4.2)
+ backend/src/common/cls/cls.module.ts              `RequestClsModule`, pre-configured `ClsModule.forRoot` with request-id generation (4.1)
+ backend/src/common/filters/all-exceptions.filter.ts  reshapes `HttpException` responses to `{ error: <message> }`, catches non-`HttpException` throws as 500 `{ error: 'Internal Server Error' }` and logs the original error/stack (4.3)
+ backend/src/common/logging/winston-logger.factory.ts  Winston logger bound as Nest's `LoggerService`, JSON + requestId format (4.1)
+ packages/shared/package.json                      `@portfolio/shared` scaffold - `tsc` build, `dist/` entry points (4.5); adds `typecheck`/`lint` scripts and eslint/prettier devDependencies (Round 1 fix, F6); briefly added `jose@6.2.9` and an `exports` map splitting the root from a `./verify` subpath (4.8), both removed again - `packages/shared` is types/constants only, no runtime dependencies (Round 4 owner feedback)
+ packages/shared/src/index.ts                      `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME`, `SessionClaims`, `SessionUser`, `Session` - types/constants only, no `jose` (4.5)
+ packages/shared/tsconfig.json                     extends root `tsconfig.base.json`, mirrors `backend/tsconfig.json`'s compiler options (4.5)
+ packages/shared/eslint.config.mjs                  mirrors `backend/eslint.config.mjs`, brings the workspace under lint enforcement (Round 1 fix, F6)
+ packages/shared/.prettierrc.json                   matches `backend/.prettierrc.json` (Round 1 fix, F6)
~ backend/Dockerfile                                sets `NODE_ENV=development` in the `dev` target so `defaultMeta.environment` is populated - was unset, silently dropped from every JSON log line (4.1); copies/builds `packages/shared` in the `deps` and `common-build` stages (4.5); runs `pnpm --filter @portfolio/shared lint` in `common-build` (Round 1 fix, F6)
~ backend/package.json                              adds `winston`, `nest-winston`, `nestjs-cls` (4.1); `bcrypt`, `@types/bcrypt` (4.4); `@portfolio/shared`, `@nestjs/jwt` (4.5); `cookie-parser`, `@types/cookie-parser` (4.6); reordered `cookie-parser` alphabetically (Round 1 fix, F7)
~ backend/src/app.module.ts                         imports `RequestClsModule` (4.1) and `ClockModule` (4.2)
~ backend/src/auth/auth.controller.ts               real `login`/`logout` handlers, `login` gets `@HttpCode(200)`, `logout` loses its provisional `@ApiCookieAuth()` (4.5); real `session` handler (4.6), then refactored onto `@UseGuards(SessionGuard)` + `@CurrentUser()` (4.7); `login` defaults `rememberMe` to `false` and reuses `issue()`'s returned claims instead of re-verifying the token it just signed (Round 1 fix, F2/F3); `logout` comment reworded to drop planning-document identifiers (Round 3 fix, F8)
~ backend/src/auth/dto/login-request.dto.ts          drops `@IsOptional()` from `username`/`password`, adds `@IsNotEmpty()`, so the global `ValidationPipe` 400s a malformed login body instead of it crashing `CredentialVerifierService` into a 500 (Round 1 fix, F1); comment reworded to drop planning-document identifiers (Round 3 fix, F8); comment trimmed to two lines (Round 4 fix, F9)
~ backend/src/auth/auth.module.ts                   registers `CredentialVerifierService` (4.4); wires `JwtModule.registerAsync` off `AppConfigService`'s JWK getters and registers `SessionService` (4.5); registers and exports `SessionGuard` (4.7)
~ backend/src/config/app-config.service.ts          adds required `sessionPrivateKeyJwk`/`sessionPublicKeyJwk` getters, same validated-at-construction pattern as `databaseUrl` (4.5)
~ backend/src/main.ts                               passes `createWinstonLogger()` to `NestFactory.create` (4.1); registers `AllExceptionsFilter` (4.3); `app.use(cookieParser())` before route setup (4.6); reverted an undocumented Swagger description drive-by (Round 1 fix, F5)
~ backend/src/price-history/price-history.controller.ts  guards `check` with `SessionGuard`; `set` untouched, stays public (4.7)
~ backend/src/price-history/price-history.module.ts      imports `AuthModule` (4.7)
~ backend/src/product/product.controller.ts         guards `getByProduct` with `SessionGuard` (4.7)
~ backend/src/product/product.module.ts             imports `AuthModule` (4.7)
~ backend/src/stats/stats.controller.ts             guards `getByUnit` with `SessionGuard` (4.7)
~ backend/src/stats/stats.module.ts                 imports `AuthModule` (4.7)
~ backend/src/summary/summary.controller.ts         guards the whole controller (all five methods) with `SessionGuard` (4.7)
~ backend/src/summary/summary.module.ts             imports `AuthModule` (4.7)
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts  guards `getByTimeFrame` with `SessionGuard` (4.7)
~ backend/src/time-frame-pl/time-frame-pl.module.ts            imports `AuthModule`, shared by both controllers (4.7)
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts  guards `getByTimeFrame` with `SessionGuard` (4.7)
~ backend/src/token-info/token-info.controller.ts   guards `sync` with `SessionGuard`; `search` untouched, stays public (4.7)
~ backend/src/token-info/token-info.module.ts       imports `AuthModule` (4.7)
~ backend/src/transactions/transactions.controller.ts   guards `add` and `delete` with `SessionGuard` (4.7)
~ backend/src/transactions/transactions.module.ts       imports `AuthModule` (4.7)
~ defaults.env                                      adds blank `SESSION_PRIVATE_KEY_JWK`/`SESSION_PUBLIC_KEY_JWK` placeholders (4.5)
~ frontend/package.json                             adds `@portfolio/shared` (`workspace:*`) - the frontend's first use of the shared package (4.8); adds `jose@6.2.9`, moved from `packages/shared` (Round 4 owner feedback)
+ frontend/src/server/session.ts                     `verifySessionToken()` - `jose`-based ES256 verify, algorithm-pinned - moved here from `packages/shared/src/verify.ts`, which had exactly one consumer and no reason to carry `jose` as a package dependency (Round 4 owner feedback; story 4.8's interop proof against the old location still stands unchanged)
~ pnpm-lock.yaml                                    lockfile updates across 4.1, 4.4, 4.5, 4.6, 4.8 and the new `packages/shared` workspace member; `jose` moved from `packages/shared` to `frontend` (Round 4 owner feedback)
~ backend/src/db/entities/ouath-token.entity.ts      comment reworded to drop the planning-document identifier while keeping the misspelling-is-intentional rationale (Round 3 fix, F8; entity itself shipped in an earlier epic, pulled into this diff by owner feedback)

## Review Notes

### Round 1

Depth: `backend/src/auth/**` · `backend/src/main.ts` · `backend/src/config/app-config.service.ts` · `packages/shared/**` deep (auth/trust boundary, JWT signing and verification, cookie handling) · the ten guarded controllers/modules, `backend/src/common/**`, `backend/Dockerfile`, `defaults.env`, manifests standard · `pnpm-lock.yaml` skim.

- **F1** [blocking · error handling] `backend/src/auth/credential-verifier.service.ts:12` - a
  `POST /backend/api/auth/login` body missing `username` (or `password`) crashes the handler
  into a `500`, instead of the `401`/`400` FR-5 shape, on an unauthenticated public endpoint.
  `LoginRequestDto` marks all three fields `@IsOptional()` (deliberately - its own comment
  defers presence enforcement to "the real handler logic", which is this epic), so
  `body.username` reaches `verify()` as `undefined` and
  ```ts
  .findOne({ username: username.toLowerCase() })
  ```
  throws `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`. The
  `.catch()` on the next line does not cover it - the argument expression is evaluated before
  `findOne()` returns a promise - so it propagates to `AllExceptionsFilter` as a non-`HttpException`.
  Confirmed live against the running stack:
  `curl -X POST .../auth/login -d '{}'` returns `500 {"error":"Internal Server Error"}`.
  The password path is the same defect one line later: `bcrypt.compare(undefined, user.password)`
  rejects with `data and hash arguments required` (verified directly against the installed
  `bcrypt`), so a real username with no password field also 500s. Every malformed login also
  writes a full stack trace to the error log.
  - Status: Fixed
  - `backend/src/auth/dto/login-request.dto.ts:9-17` - dropped `@IsOptional()` from
    `username`/`password` and added `@IsNotEmpty()`, since this is the real login handler, not
    the deferred-validation stub the DTO's old comment described. The global `ValidationPipe`
    (`backend/src/main.ts:18-20`, `whitelist: true, transform: true`) now 400s before either
    field reaches `CredentialVerifierService`. Rebuilt the `nest-api` image and re-ran the
    reviewer's repro against the running container:
    `curl -X POST .../auth/login -d '{}'` -> `400 {"error":["username must be a string",
    "username should not be empty","password must be a string","password should not be
    empty"]}`; `curl ... -d '{"username":"nobody"}'` -> `400` with only the password
    messages; a bad-but-present username/password pair still reaches `verify()` and
    returns `401 {"error":"Unauthorized"}` as before. No stack trace in `docker logs
    nest-api` for any of the three requests.

- **F2** [advisory · correctness] `backend/src/auth/auth.controller.ts:60` - `body.rememberMe`
  is `@IsOptional()` and is never defaulted, so a login body that omits it signs
  `rememberMe: undefined`, which `JSON.stringify` drops from the JWT payload entirely. The
  shared contract declares it non-optional (`packages/shared/src/index.ts:10`,
  `rememberMe: boolean`), so a token issued this way violates `SessionClaims` for the Epic 6/7
  frontend consumers that read it. Session lifetime is unaffected (`undefined` falls to the 8h
  branch). Same DTO root cause as F1 - worth fixing in the same pass.
  - Status: Fixed
  - `backend/src/auth/auth.controller.ts:59` - `this.sessionService.issue(..., body.rememberMe
    ?? false)`. `rememberMe` stays `@IsOptional()` in the DTO (it is genuinely optional input,
    unlike username/password), so the default is applied at the one call site that turns it
    into a claim.

- **F3** [advisory · reuse/simplification] `backend/src/auth/auth.controller.ts:69` -
  `return toSessionResponse(this.sessionService.verify(token));` re-verifies the token the line
  above just signed, purely to recover claims the handler already had. Story 4.5 AC D specifies
  `toSessionResponse(claims)`. It costs a second ECDSA operation per login, and if it ever did
  throw, the client would get a `401` after `res.cookie(...)` had already set a valid session.
  Having `issue()` return the claims alongside `token`/`maxAgeSeconds` removes both.
  - Status: Fixed
  - `backend/src/auth/session.service.ts:10-13,52` - `IssuedSession` gained a `claims:
    SessionClaims` field, populated from the same `claims` object `issue()` already builds
    before signing. `backend/src/auth/auth.controller.ts:57,70` - destructures `claims` off
    `issue()`'s return and calls `toSessionResponse(claims)` directly; the second
    `sessionService.verify(token)` call is gone.

- **F4** [advisory · conventions] `frontend/package.json:28` - `@portfolio/shared` is now a
  declared frontend dependency, but `frontend/Dockerfile` was never given the
  `packages/shared` copy/build wiring `backend/Dockerfile` got (story 4.8 reverted its temporary
  version). The result is a dangling symlink baked into the shipped image - in the running
  container, `/app/frontend/node_modules/@portfolio/shared -> ../../../packages/shared` while
  `/app/packages` does not exist. Inert today because nothing under `frontend/src` imports it,
  and story 4.8 explicitly forbade permanent `frontend/` changes beyond the manifest, so this is
  flagged as a known landmine for whichever Epic 6 story first imports the package rather than
  as something to fix here.
  - Status: Declined
  - Agreeing with the reviewer's own framing rather than disputing the facts: this is
    deliberately out of scope for this epic, not a gap in it. Story 4.8's Dev Notes
    (`docs/bmad/nestjs-migration/stories/4-8-nextjs-session-read-demonstration.md:169-177,
    229-231`) record that `frontend/Dockerfile`'s `packages/shared` wiring was added only to
    run one diagnostic and was deliberately reverted afterward, leaving `frontend/package.json`
    as the story's only permanent frontend footprint - "not part of this story's permanent
    footprint, since nothing in `frontend/` imports it yet." Wiring the Dockerfile back now,
    ahead of any real import, would be scope this epic never asked for and would ship
    unexercised. The first Epic 6 story that imports `@portfolio/shared` from `frontend/src`
    needs the Dockerfile change and the import landed together to be verifiable at all, so
    that is where this belongs.

- **F5** [advisory · scope] `backend/src/main.ts:28` - the Swagger description was changed from
  `'Backend API for the portfolio tracker, migrated from Next.js API routes.'` to
  `'Backend API for the portfolio tracker.'`. No story in this epic asks for it and no story's
  Changed Files records it. The edit itself looks fine; it is the undocumented drive-by that is
  worth noting.
  - Status: Fixed
  - `backend/src/main.ts:28` - reverted to the original description string; no story in this
    epic changes it.

- **F6** [advisory · conventions] `packages/shared/package.json:19` - the new workspace member
  ships only a `build` script, with no `typecheck`/`lint` scripts and no eslint config, so it
  sits outside the per-workspace enforcement story 1.6 established. Type errors are still caught
  (its `tsc` build runs in `backend/Dockerfile`'s `common-build` stage), but lint and Prettier
  never run over it.
  - Status: Fixed
  - `packages/shared/package.json` - added `typecheck` (`tsc --noEmit`) and `lint`
    (`eslint "src/**/*.ts"`) scripts and the matching eslint/prettier devDependencies.
    `packages/shared/eslint.config.mjs` - new, mirrors `backend/eslint.config.mjs` minus the
    stub-specific rule overrides that don't apply here. `packages/shared/.prettierrc.json` -
    new, matches `backend/.prettierrc.json`. `backend/Dockerfile` - added
    `RUN pnpm --filter @portfolio/shared lint` in the `common-build` stage, alongside the
    existing `build`, so it runs on every image build the same way the backend's own lint
    does. Ran `pnpm --filter @portfolio/shared typecheck && pnpm --filter @portfolio/shared
    lint` locally - both pass with no errors or warnings - and rebuilt the `nest-api` Docker
    image (`docker compose build nest-api`), confirming the new lint stage runs and passes
    as part of the build.

- **F7** [advisory · conventions] `backend/package.json:24` - `cookie-parser` was inserted
  between `class-transformer` and `class-validator`, breaking the alphabetical ordering the rest
  of the block keeps.
  - Status: Fixed
  - `backend/package.json` - moved `cookie-parser` after `class-validator`, restoring
    alphabetical order.

### Round 2

Depth: re-review only - adjudicated F1-F7 against the current working tree, then re-read the
files the fixes touched (`backend/src/auth/dto/login-request.dto.ts`,
`backend/src/auth/auth.controller.ts`, `backend/src/auth/session.service.ts`,
`backend/src/main.ts`, `backend/package.json`, `packages/shared/**`, `backend/Dockerfile`) at the
depth their Round 1 group carried. No other part of the diff was re-read.

Round 1 adjudication:

- **F1** - Verified. `backend/src/auth/dto/login-request.dto.ts:10-17` now carries
  `@IsNotEmpty()` on `username`/`password`, and `backend/src/main.ts:18-20`'s global
  `ValidationPipe` runs before the handler, so neither field can reach
  `CredentialVerifierService.verify()` as `undefined`. `rememberMe` correctly keeps
  `@IsOptional()`.
  - Status: Resolved

- **F2** - Verified. `backend/src/auth/auth.controller.ts:59` - `body.rememberMe ?? false`. The
  signed payload now always carries a boolean `rememberMe`, satisfying `SessionClaims`.
  - Status: Resolved

- **F3** - Verified. `backend/src/auth/session.service.ts:12,53` - `IssuedSession.claims` is the
  same object passed to `sign()`, and `auth.controller.ts:57,70` destructures it and calls
  `toSessionResponse(claims)`. No second ECDSA verify on the login path, and no post-`res.cookie`
  throw is reachable.
  - Status: Resolved

- **F4** - Withdrawn. Dev is right, and it is consistent with how I framed the finding myself:
  the dangling symlink is inert until something under `frontend/src` imports `@portfolio/shared`,
  and the Dockerfile wiring is only verifiable in the same change as that first import. Nothing
  is gained by landing unexercised build wiring an epic ahead of its consumer. The landmine is
  recorded here in Round 1 for whichever Epic 6 story lands the import.
  - Status: Withdrawn

- **F5** - Verified. `backend/src/main.ts:28` matches the base commit's description string
  exactly.
  - Status: Resolved

- **F6** - Verified, including the parts that could have silently not worked. Ran
  `pnpm --filter @portfolio/shared typecheck && pnpm --filter @portfolio/shared lint` - both pass.
  `packages/shared/eslint.config.mjs` ignores `dist/**`, which matters because
  `backend/Dockerfile:40-41` runs the new `lint` after `build`, so `dist/` exists at lint time.
  The devDependencies needed by that stage are installed: `backend/Dockerfile:20` names
  `@portfolio/shared` directly rather than relying on the `...` production-only pull-in, and
  `packages/shared/eslint.config.mjs` / `.prettierrc.json` reach the image via
  `COPY packages/shared ./packages/shared`, whose `node_modules` clobber is prevented by the root
  `.dockerignore`'s `**/node_modules`.
  - Status: Resolved

- **F7** - Verified. `backend/package.json:28-30` - `cookie-parser` now sits after
  `class-validator`; the whole dependency block is alphabetical.
  - Status: Resolved

Regression check on the fixes: `pnpm --filter @portfolio/backend typecheck && lint` pass (the one
`no-floating-promises` warning on `main.ts:53` predates this epic's base commit). No new defect
was introduced by any of the six fixes.

New this round:

- **F8** [advisory · conventions] `backend/src/auth/dto/login-request.dto.ts:6` - planning-document
  identifiers appear in three code comments this epic adds, against the standing instruction in
  `CLAUDE.md` to keep story/epic/FR references out of code comments and put the reasoning itself
  there instead. One of the three is newly introduced by the F1 fix, which is why it surfaces now:
  ```ts
  // instead of producing FR-5's 400/401 shape.
  ```
  The other two are `backend/src/auth/session-response.mapper.ts:4-5` (`// The FR-9 whitelist:
  ... Story 4.6's session endpoint reuses this exact function ...`) and
  `backend/src/auth/auth.controller.ts:72-74` (`// Unconditional: FR-10 scopes invalidation ...
  Corrects story 2.4's provisional @ApiCookieAuth()`). Each reads fine with the identifier and the
  cross-story bookkeeping simply dropped - the substance of all three is self-contained. Kept
  advisory rather than blocking because one such comment
  (`backend/src/db/entities/ouath-token.entity.ts:4`, `out of scope under FR-13`) already shipped
  in an approved earlier epic, so this is a standing call for the owner rather than a defect in
  this diff; it is a comment-text-only change whenever it is made.
  - Status: Fixed
  - Owner pressed this in Round 3 - see Owner Feedback below. All four comments rewritten to
    drop the planning-document identifiers and keep only the reasoning:
    `backend/src/auth/dto/login-request.dto.ts:4-6`,
    `backend/src/auth/session-response.mapper.ts:4-5`,
    `backend/src/auth/auth.controller.ts:77-78`, `backend/src/db/entities/ouath-token.entity.ts:3-4`.

### Round 3

Depth: re-review only - adjudicated F8 against the current working tree and re-read the four
files the fix touched (`backend/src/auth/dto/login-request.dto.ts`,
`backend/src/auth/session-response.mapper.ts`, `backend/src/auth/auth.controller.ts`,
`backend/src/db/entities/ouath-token.entity.ts`) at standard depth. The change is comment text
only - confirmed by diffing all four against the base commit: no executable line differs from
what Round 2 verified. No other part of the diff was re-read.

Round 2 adjudication:

- **F8** - Verified, all four comments. None of the reworded comments names a planning document
  and each keeps the knowledge that earned it: `login-request.dto.ts:4-6` states the crash the
  validators prevent; `session-response.mapper.ts:4-5` names the four claims that are withheld
  (`rememberMe`, `jti`, `iat`, `exp` - checked against `packages/shared/src/index.ts:4-13`, which
  is exactly the set `toSessionResponse()` drops) and why the function is shared;
  `auth.controller.ts:77-78` states why logout is unguarded and carries no `@ApiCookieAuth()`,
  which matches the decorators actually present; `ouath-token.entity.ts:3-4` keeps the
  misspelling-is-intentional rationale. A scan of every added line across `backend/`,
  `frontend/`, `packages/` and `defaults.env` for `FR-n`, `GR-n`, "story", "epic" and "AC x"
  returns nothing, so no fifth instance was missed.
  - Status: Resolved

Regression check on the fix: all four files stay under the repo's 100-column Prettier width, so
the rewording introduces no formatting drift. The Round 1 fixes the same two files carry are
still intact in the current tree - `login-request.dto.ts:10,15` keeps `@IsNotEmpty()` (F1),
`auth.controller.ts:59` keeps `body.rememberMe ?? false` (F2), `auth.controller.ts:57,70` still
destructures `claims` off `issue()` with no second verify (F3), and `main.ts:28` still holds the
restored description string (F5). Nothing was disturbed by the comment pass.

New this round:

- **F9** [advisory · conventions] `backend/src/auth/dto/login-request.dto.ts:4-6` - the reworded
  comment runs to three lines, against `CLAUDE.md`'s "two lines at most" limit for a comment that
  survives the necessity test:
  ```ts
  // username/password are enforced here, not deferred to handler logic: this is the real
  // login handler, and letting either through as undefined crashes CredentialVerifierService
  // instead of producing a clean 400/401 response.
  ```
  The substance fits in two - the crash it prevents is the part a reader cannot get from the
  code; "this is the real login handler" is context for the removed stub comment rather than for
  the reader. The other three comments in this round are two lines each. Raised because it lands
  in the same comment-convention rule the owner just pressed, not as a bar to shipping.
  - Status: Fixed
  - `backend/src/auth/dto/login-request.dto.ts:4-5` - trimmed to two lines, keeping the
    crash the validators prevent and dropping the "this is the real login handler" framing
    that only made sense next to the stub comment it replaced.

### Round 4

Depth: re-review after owner feedback - `frontend/src/server/session.ts` and
`packages/shared/**` deep (the moved file is the frontend's JWT verification path, a trust
boundary; the `exports` map change can silently break every consumer of the root export) ·
`backend/src/auth/dto/login-request.dto.ts` and `frontend/package.json` standard ·
`pnpm-lock.yaml` skim, limited to the `jose` and `packages/shared` entries. No other part of
the diff was re-read; `git diff` against the index confirms nothing else moved since Round 3.

Round 3 adjudication:

- **F9** - Verified. `backend/src/auth/dto/login-request.dto.ts:4-5` is two lines, keeps the
  crash the validators prevent, and drops the "this is the real login handler" framing. No
  executable line changed.
  - Status: Resolved

Owner Round 4 item 1 - the `verify.ts` move. Checked the four things that could have silently
broken, all pass:

- **Algorithm pin intact.** `frontend/src/server/session.ts:10` still passes
  `algorithms: [SESSION_ALGORITHM]`, and `packages/shared/src/index.ts:1` still pins
  `SESSION_ALGORITHM = 'ES256' as const`, so verification is never left open to the token's own
  `alg` header. Diffed the new file against the pre-move `packages/shared/src/verify.ts`
  (`git show :packages/shared/src/verify.ts`): the only differing line is the import, `./index`
  -> `@portfolio/shared`. Implementation byte-identical.
- **Claim contract resolves from the root export.** `require.resolve('@portfolio/shared')` from
  `frontend/` resolves to `packages/shared/dist/index.js` through the surviving `.` condition,
  and `jose` is installed under `frontend/node_modules`.
- **No dangling `./verify` reference anywhere.** Grepped `shared/verify`, `from './verify'` and
  `dist/verify` across the repo excluding `node_modules`/`dist`/`.next` - nothing. All 15
  backend imports of `@portfolio/shared` (`session.service.ts`, `session.guard.ts`,
  `auth.module.ts`, `auth.controller.ts`, the nine guarded controllers,
  `current-user.decorator.ts`, `express-request.d.ts`, `session-response.mapper.ts`) name the
  bare root specifier, so the `exports` map narrowing cannot reach them.
  `packages/shared/dist/` holds only `index.js`/`index.d.ts` - no stale `verify.*` artifact.
- **`packages/shared` has no runtime dependencies.** `packages/shared/package.json` has no
  `dependencies` block at all, and `pnpm-lock.yaml:323-347` lists the workspace under
  `devDependencies` only. `jose@6.2.9` now appears once as a direct dependency, in the
  `frontend` importer (`pnpm-lock.yaml:218-220`); the separate `jose@4.15.9` entries are the
  pre-existing `next-auth`/`openid-client` transitives, untouched.

Placement matches the flat `frontend/src/server` convention (`auth.ts`, `logger.ts`,
`metrics.ts`, `redisClient.ts`). No new defect introduced by either owner-feedback change.

New this round:

- **F10** [advisory · conventions] `frontend/src/server/session.ts:2` - the withdrawn F4
  landmine now has one foot over the line: a file under `frontend/src` imports
  `@portfolio/shared`, while `frontend/Dockerfile` still has no `packages/shared` copy or build
  (`frontend/Dockerfile:14-16, 24-38` - the `deps` stage copies only `frontend/package.json`,
  and `common-build` copies no `packages/` path), so in the image the symlink
  `frontend/node_modules/@portfolio/shared` dangles and `dist/index.js` does not exist.
  Verified still inert, for two independent reasons: nothing imports `server/session`, so the
  bundler never resolves the module in either the `dev` or `prod` target; and
  `frontend/next.config.js:6-11` sets `typescript.ignoreBuildErrors: true`, so the missing
  types cannot fail `next build` either. Recording it only because the trigger condition F4 was
  withdrawn on has partially fired - the Epic 7 story that first imports `verifySessionToken`
  needs the Dockerfile wiring and a `pnpm --filter @portfolio/shared build` step landed in the
  same change, or the frontend image breaks the moment the import goes live. Not a defect in
  this diff and not a bar to shipping it.
  - Status: Open

## Owner Feedback

### Round 3 - owner feedback

Owner pressed F8 rather than accepting it as advisory. Planning-document identifiers in
code comments are a standing rule in `CLAUDE.md`, and leaving them here would spread the
inconsistency through Epics 5-7.

Fix the three comments this epic adds - `backend/src/auth/dto/login-request.dto.ts:6`,
`backend/src/auth/session-response.mapper.ts:4-5`, `backend/src/auth/auth.controller.ts:72-74`
- by putting the reasoning itself in the comment, or deleting the comment where the code
already says it. Also fix the equivalent comment that shipped in an earlier epic at
`backend/src/db/entities/ouath-token.entity.ts:4`, which the owner explicitly included in
scope; that pulls one already-committed file into this epic's diff.

**Applied.** Reworded all four comments to drop the planning-document identifiers (`FR-5`,
`FR-9`, "Story 4.6's", `FR-10`, "story 2.4's", `FR-13`) while keeping the substantive
reasoning each comment existed for:

- `backend/src/auth/dto/login-request.dto.ts:4-6` - now explains the crash this validation
  prevents without naming the FR.
- `backend/src/auth/session-response.mapper.ts:4-5` - now explains what's whitelisted and why
  the function is shared, without the story cross-reference.
- `backend/src/auth/auth.controller.ts:77-78` - now states the unconditional-logout design
  reasoning directly, without referencing the story it corrects.
- `backend/src/db/entities/ouath-token.entity.ts:3-4` - now states the misspelling is
  intentional and that this file doesn't change the schema, without the FR reference.

Comment text only in all four files; no behavior change. Re-ran `pnpm --filter @portfolio/backend
typecheck && pnpm --filter @portfolio/backend lint` - both pass (the pre-existing
`no-floating-promises` warning on `main.ts:53` is unchanged from Round 2, not touched by this
round).

### Round 4 - owner feedback

Two items.

**Move `verify.ts` out of `packages/shared` into the frontend.** The owner questioned why
it lives in a shared package at all. It has exactly one consumer: the backend verifies
through `SessionService` with `@nestjs/jwt` and never imports the `./verify` subpath.
`packages/shared` keeps the session claim contract - `SessionClaims`, `SESSION_ALGORITHM`,
`SESSION_COOKIE_NAME` - which two workspaces genuinely read. The verifier is behavior with
a single caller, so it belongs next to the runtime that calls it. This reverses part of
story 4.8's AC A while keeping its interop proof intact.

**F9.** Trim the `login-request.dto.ts` comment to the two-line limit.

**Architecture doc - resolved.** `architecture.md` described `packages/shared` as holding
"session claim contract + verify helper" in several places, which this change made stale.
`bmad-architect` corrected them and amended D25 in place, and found one further spot that
credited `@nestjs/jwt` as the choice "on the signing side" - an understatement now that the
backend verifies there too.

**Applied.** `packages/shared/src/verify.ts` moved to `frontend/src/server/session.ts`
(next to `auth.ts`, `logger.ts`, `metrics.ts`, `redisClient.ts` - the existing flat
convention for `frontend/src/server`'s top-level concerns; this is where Epic 7's real
consumer will reach for it once it flips the auth seam). Its only import changed - from
`./index` to `@portfolio/shared`'s root - the implementation and the algorithm pin
(`algorithms: [SESSION_ALGORITHM]`, i.e. `['ES256']`, never left open) are byte-identical.
`jose@6.2.9` moved from `packages/shared/package.json` to `frontend/package.json`.
`packages/shared/package.json`'s `exports` map lost the `./verify` subpath - the root
export (`SessionClaims`, `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME`) is unchanged, and
`packages/shared` now has no runtime dependencies. Confirmed no other file references the
old `./verify` subpath (`grep -rn "shared/verify"` across `backend`, `frontend`,
`packages`, excluding `node_modules`/`dist`, returns nothing) - the backend never imported
it, confirming the owner's premise. Story 4.8's AC A is annotated with this reversal and a
pointer to the new location; its interop-proof Dev Notes (the Edge-middleware and
Node-runtime transcripts) are untouched, since the file's contents and behavior did not
change. `backend/src/auth/dto/login-request.dto.ts`'s comment (F9) was trimmed to two
lines - see Review Notes F9.

Re-ran `pnpm install` (lockfile updated), `pnpm --filter @portfolio/shared build` (clean
rebuild after removing `dist/verify.*`), `pnpm --filter @portfolio/shared typecheck && pnpm
--filter @portfolio/shared lint`, and `pnpm --filter @portfolio/backend typecheck && pnpm
--filter @portfolio/backend lint` - all pass, no new errors or warnings (backend keeps the
one pre-existing `no-floating-promises` warning on `main.ts:53`). `cd frontend && pnpm
lint` and `npx tsc --noEmit -p tsconfig.json` both show only pre-existing warnings/errors
in files unrelated to this change; `src/server/session.ts` appears in neither. Did not
touch `architecture.md`, per this round's note.
