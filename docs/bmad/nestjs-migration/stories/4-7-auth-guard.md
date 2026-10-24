# Story 4.7: Auth guard and current-user injection for protected endpoints

Status: Done

## Context

Builds the reusable mechanism story 4.6 anticipated, refactors 4.6 onto it (so there is
exactly one place a session token gets verified in an HTTP request path, not two), and
then applies it - per the per-route FR-2 decisions the inventory in
`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md` already recorded - to every
Epic 2 scaffold endpoint that decision marks `authenticated`. This pre-wires the auth
boundary across the whole API surface before Epic 5 writes any real handler body, so no
Epic 5 story has to remember to add it on top of its own domain logic.

## Acceptance Criteria

### A. `SessionGuard`

- [x] `backend/src/auth/session.guard.ts` exports `class SessionGuard implements
      CanActivate`, constructor-injecting `SessionService` (story 4.5). `canActivate`
      reads the `portfolio_session` cookie from the request the same way story 4.6 does
      (`req.cookies[SESSION_COOKIE_NAME]`), throws `new UnauthorizedException()` if
      absent, otherwise calls `sessionService.verify(token)` (throws `UnauthorizedException`
      itself on any failure - 4.3's filter shapes both cases identically), attaches the
      verified `SessionClaims` to the request (`request.user = claims`), and returns
      `true`.

### B. `@CurrentUser()` parameter decorator

- [x] `backend/src/auth/current-user.decorator.ts` exports `CurrentUser =
      createParamDecorator((_, ctx: ExecutionContext): SessionClaims => {
      ctx.switchToHttp().getRequest().user })`, typed against `SessionClaims` from
      `@portfolio/shared`. Usable as `@CurrentUser() user: SessionClaims` in any handler
      guarded by `SessionGuard` - relies on section A having already populated
      `request.user`, so it is only meaningful paired with `@UseGuards(SessionGuard)`.

### C. Refactor story 4.6's session handler

- [x] `auth.controller.ts`'s `session` handler drops its inline cookie-read/
      `sessionService.verify()` call (story 4.6) and instead uses
      `@UseGuards(SessionGuard)` plus `@CurrentUser() claims: SessionClaims`, calling
      `toSessionResponse(claims)` directly. This is the only change to that handler's
      *logic*; its Swagger annotations and response shape are unchanged. After this
      story, `SessionService.verify()` is called from exactly two places: `SessionGuard`
      and nowhere else in `auth.controller.ts`.

### D. Apply the guard per the recorded FR-2 decisions

Every endpoint below is a **stub** from Epic 2 - its body still throws
`NotImplementedException`. This story adds `@UseGuards(SessionGuard)` at the method (or,
where every method in a controller is protected, controller) level, plus an unused
`@CurrentUser() user: SessionClaims` parameter so Epic 5 can start using it immediately
without also having to remember to add the guard. **Endpoints not listed here get no
guard - do not add one.**

- [x] `backend/src/transactions/transactions.controller.ts` - `add`, `delete`
- [x] `backend/src/summary/summary.controller.ts` - `getCoins`, `getPortfolio`,
      `getProfitLossChartByQuery`, `getProfitLossChartByParam`, `getByUnit`
- [x] `backend/src/stats/stats.controller.ts` - `getByUnit`
- [x] `backend/src/product/product.controller.ts` - `getByProduct`
- [x] `backend/src/time-frame-pl/time-frame-coins-pl.controller.ts` - `getByTimeFrame`
- [x] `backend/src/time-frame-pl/time-frame-total-pl.controller.ts` - `getByTimeFrame`
- [x] `backend/src/price-history/price-history.controller.ts` - `check` only (**not**
      `set` - deliberately public per the inventory's FR-2 table)
- [x] `backend/src/token-info/token-info.controller.ts` - `sync` (the `:userId` route)
      only (**not** `search` - deliberately public). Note the inventory records this one
      as "authenticated, scoped to caller" - the scoping (comparing `:userId` against
      `claims.sub`) is real business logic and is **not** this story's job; it belongs to
      whichever Epic 5 story implements `token-info` for real. This story only wires the
      guard and makes `claims` available to that future handler.

**Deliberately left unguarded, confirmed by re-checking the inventory rather than
assumed:** `exchange-rates.controller.ts` (`getPriceHistory`, `getByUnit`),
`price-history.controller.ts`'s `set`, `token-info.controller.ts`'s `search`. **Also
unguarded, but for a different reason:** `metrics.controller.ts`'s `getMetrics` -
authenticated, but by the `METRICS_SECRET` bearer token, not a session cookie
(`SessionGuard` does not apply here at all); its own guard is story 5.9's job.

### E. Verification

- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, `lint` all pass.
- [x] Each of the ten guarded methods in section D, called with no cookie, returns `401
      { "error": "Unauthorized" }` - the guard runs before the stub body, so this
      confirms the guard is wired without needing the real handler to exist.
- [x] Each of the same ten, called **with** a valid cookie from story 4.5's login flow,
      returns `501` (`NotImplementedException` from the still-stubbed body) - confirms the
      guard passes a valid session through to the (not yet implemented) handler, rather
      than the `401` masking whether the guard's happy path works.
- [x] Each of the four deliberately-public endpoints named in section D, called with
      **no** cookie, still returns `501` (not `401`) - confirms they were correctly left
      unguarded.
- [x] `curl -s localhost:3001/backend/docs-json | jq '.paths."/backend/api/transaction/add".post.security'`
      (and similarly for one deliberately-public route) - confirms Swagger's rendered
      auth posture still matches 2.3/2.4's documentation-only `@ApiCookieAuth()`
      decorators, now backed by a real mechanism.
- [x] `docker compose up -d --build` brings up the full stack; `GET /backend/api/health`
      still `200`.

## Technical Notes

### Current state

Ten controller files exist from Epic 2, each with stub methods throwing
`NotImplementedException`, some already carrying documentation-only `@ApiCookieAuth()`
decorators from 2.4-2.8 (those decorators do not change in this story - they already say
the right thing; this story is what makes them true).

## Out of Scope

- Any real handler body, anywhere - Epic 5.
- `token-info/:userId`'s scoped-to-caller check, or any other business logic that reads
  `@CurrentUser()`'s value - Epic 5.
- The `METRICS_SECRET` bearer guard - story 5.9.
- `packages/shared`'s `./verify` subpath, the frontend, Edge middleware - story 4.8.

## Dev Notes

`SessionGuard` and its `express-request.d.ts` global augmentation live under
`backend/src/auth`, exported from `AuthModule` alongside `SessionService` so every
consuming feature module only needs `imports: [AuthModule]` to use `@UseGuards(SessionGuard)`.
`SummaryController` gets the guard at the controller level (every method is protected);
the other seven controllers get it per-method, matching the FR-2 table exactly.

### Changed Files

+ backend/src/auth/session.guard.ts             CanActivate reading the session cookie, verifying it, attaching request.user
+ backend/src/auth/current-user.decorator.ts     @CurrentUser() param decorator reading request.user
+ backend/src/auth/express-request.d.ts          augments Express.Request with an optional SessionClaims `user` field
~ backend/src/auth/auth.module.ts                registers SessionGuard, exports it and SessionService for other modules
~ backend/src/auth/auth.controller.ts            `session` handler now uses @UseGuards(SessionGuard) + @CurrentUser() instead of its own cookie-read/verify call
~ backend/src/transactions/transactions.controller.ts   guards `add`, `delete` with SessionGuard + unused @CurrentUser()
~ backend/src/transactions/transactions.module.ts        imports AuthModule
~ backend/src/summary/summary.controller.ts     guards the whole controller (all five methods) with SessionGuard + unused @CurrentUser()
~ backend/src/summary/summary.module.ts         imports AuthModule
~ backend/src/stats/stats.controller.ts         guards `getByUnit` with SessionGuard + unused @CurrentUser()
~ backend/src/stats/stats.module.ts             imports AuthModule
~ backend/src/product/product.controller.ts     guards `getByProduct` with SessionGuard + unused @CurrentUser()
~ backend/src/product/product.module.ts         imports AuthModule
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts   guards `getByTimeFrame` with SessionGuard + unused @CurrentUser()
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts   guards `getByTimeFrame` with SessionGuard + unused @CurrentUser()
~ backend/src/time-frame-pl/time-frame-pl.module.ts             imports AuthModule (shared by both controllers)
~ backend/src/price-history/price-history.controller.ts   guards `check` only with SessionGuard + unused @CurrentUser(); `set` untouched, stays public
~ backend/src/price-history/price-history.module.ts        imports AuthModule
~ backend/src/token-info/token-info.controller.ts   guards `sync` only with SessionGuard + unused @CurrentUser(); `search` untouched, stays public
~ backend/src/token-info/token-info.module.ts       imports AuthModule

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed with one pre-existing warning in
  `main.ts` (`no-floating-promises`), unrelated to this story's changes.
- `pnpm --filter @portfolio/backend build` - `nest build` succeeded.
- `docker compose up -d --build` - full stack (`nest-api`, `next-app`, `nginx`, `portfolio-db`,
  `redis`, plus the existing observability containers) came up; Nest's route log confirmed
  all guarded and public routes mapped as expected.
- Inserted a temporary user (`diagtemp47` / `TestPass123!`, bcrypt-hashed inside the
  `nest-api` container) directly into `portfolio-db`'s `User` table for the duration of
  the check, deleted immediately after (`DELETE FROM User WHERE username='diagtemp47'`).
- With **no** cookie, all ten guarded endpoints (`POST transaction/add`,
  `DELETE transaction/:id`, `GET summary/coins`, `GET summary/portfolio`,
  `GET summary/profitLossChart`, `GET summary/profitLossChart/:timeFrame`,
  `GET summary/:unit`, `GET stats/:unit`, `GET product/:product`,
  `GET time-frame-coins-pl/:timeFrame`, `GET time-frame-total-pl/:timeFrame`,
  `GET price-history/check`, `GET token-info/:userId`) returned `401` with body
  `{"error":"Unauthorized"}`.
- Logged in via `POST /backend/api/auth/login`, got a `portfolio_session` cookie back.
  With that cookie, `GET /backend/api/auth/session` returned `200`, and every one of the
  same ten guarded endpoints returned `501` (`NotImplementedException` from the still-
  stubbed body), confirming the guard passes a valid session through.
- With no cookie, the four deliberately-public endpoints (`GET exchange-rates/:timeFrame/:coinName`,
  `GET exchange-rates/unit/:unit`, `POST price-history/set`, `GET token-info/search/:searchTerm`)
  all returned `501`, not `401`, confirming they were correctly left unguarded.
- `curl -sk https://localhost/backend/docs-json` parsed with Python's `json`:
  `paths."/backend/api/transaction/add".post.security` is `[{"cookie": []}]`; the
  deliberately-public `paths."/backend/api/token-info/search/{searchTerm}".get.security`
  is absent (`None`) - Swagger's rendered auth posture matches the FR-2 table.
- `docker compose up -d --build` (full rebuild) then `curl -sk https://localhost/backend/api/health`
  returned `200 {"status":"ok"}`. (Note: plain HTTP on port 80 for `/backend/...` 404s at
  the nginx layer in this environment regardless of this story's changes - a pre-existing
  nginx routing quirk unrelated to the guard; HTTPS on 443, the path used by every other
  verification step above, works correctly.)
