# Story 2.8: Scaffold - token info and metrics modules

Status: Done

## Context

Final scaffold story - builds the `token-info` and `metrics` modules per 2.2's map,
closing out the batch that gates on GR-2. `metrics` is the one endpoint in the entire
inventory whose auth is neither session-based nor absent: it's a static bearer-token
check (`METRICS_SECRET`), unrelated to the `@ApiCookieAuth()` convention used
everywhere else in this epic. Follow every convention from 2.3.

## Acceptance Criteria

### `token-info` module

- [x] `backend/src/token-info/token-info.module.ts`, `.controller.ts` created,
      registered in `AppModule`. `@Controller('token-info')`, tagged `Token Info`.
- [x] `GET /backend/api/token-info/:userId` - response DTO
      `TokenInfoSyncResponseDto`: `{ success: boolean, userId: number }`. **This route
      name is misleading - it does not return token info, it triggers a price-history
      sync** (2.1's landmine). The DTO name and the stub comment must reflect the real
      behavior, not the route's name, so a future reader isn't misled twice. Document
      `400` `{ error: string }` for a missing/falsy `userId`. No auth today - make and
      document the explicit FR-2 decision (same pattern as 2.7's price-history/check).
- [x] `GET /backend/api/token-info/search/:searchTerm` - response DTO
      `TokenInfoResponseDto[]`, raw `TokenInfo` row shape (2.1's Technical Notes: array
      of raw Prisma-shaped rows, `take: 10`, matched via `OR` on `name`/`symbol`
      `startsWith`) - name, symbol, and whatever other columns 2.1's inventory records
      for the `TokenInfo` table; if 2.1's document isn't available yet, use the field
      set FR-12 names for `TokenInfo` in `frontend/src/server/db/schema.prisma`.
      Document `400` `{ error: string }` for an empty search term and `500` `{ error:
      string }` for a query failure. No auth today - explicit FR-2 decision required.
- [x] Both handlers throw `NotImplementedException` per 2.3 section F. The
      `:userId` handler's comment states plainly: "Triggers `syncPriceHistoryToDbForUserId`
      (per 2.2's module map) - does not return token info despite the route name."

### `metrics` module

- [x] `backend/src/metrics/metrics.module.ts`, `.controller.ts` created, registered in
      `AppModule`. `@Controller('metrics')`, tagged `Metrics`.
- [x] `GET /backend/api/metrics` - **plain text response, not JSON, on both paths**
      (2.1's landmine, FR-5/FR-16). Success: `@ApiResponse({ status: 200, description:
      'Prometheus text exposition format', content: { 'text/plain': { schema: { type:
      'string' } } } })`. Failure: `403` plain text body `Forbidden`, same
      `content: { 'text/plain': ... }` pattern - **not** `{ error: 'Forbidden' }`; this
      is one of architecture's two named carve-outs from the eventual global error
      filter (4.3), so it must not be modeled as a JSON error body here or 4.3 will
      "fix" it into one.
- [x] This endpoint's auth is a static bearer-token check
      (`Authorization: Bearer {METRICS_SECRET}`), not a session - do **not** use
      `@ApiCookieAuth()`. Instead register a second Swagger security scheme in this
      story: in `backend/src/main.ts`'s `DocumentBuilder` (extending 2.3's setup), add
      `.addBearerAuth({ type: 'http', scheme: 'bearer' }, 'metrics-secret')`, and
      decorate this endpoint with `@ApiSecurity('metrics-secret')`. This keeps the
      cookie-vs-bearer distinction visible in the rendered doc rather than reusing
      `@ApiCookieAuth()` for a mechanism that isn't a cookie at all.
- [x] The handler throws `NotImplementedException` per 2.3 section F with the comment:
      "Check `Authorization: Bearer {METRICS_SECRET}` exactly (FR-16); on match, return
      `register.metrics()`'s Prometheus exposition text; on mismatch, `403` plain-text
      `Forbidden`."

## Technical Notes

### Current state

Neither `backend/src/token-info/` nor `backend/src/metrics/` exists yet. This is the
last of the eight Epic 2 stories - after this story, every endpoint in 2.1's inventory
(18 ported + 3 new auth endpoints from 2.4) has a scaffolded controller.

### Why `metrics` gets its own security scheme rather than reusing the cookie one

Every other authenticated endpoint in this epic uses the `portfolio_session` cookie
scheme 2.3 registered. `metrics` is authenticated by a completely different mechanism
(a static shared secret, not a per-user session), and FR-16/architecture treat it as
permanently distinct - it is never going to gain a session-based auth path. Modeling it
with `@ApiCookieAuth()` would misrepresent the actual mechanism a caller needs to use
Try-It-Out successfully.

## Out of Scope

- The actual `METRICS_SECRET` bearer check, the Prometheus registry, or any metric
  emission - story 5.9.
- Any real database, entity, or query logic for `token-info` - Epic 3 and Epic 5.
- The functioning session auth guard - story 4.7 (does not apply to `metrics` at all,
  see above).

## Dev Notes

The `:userId` handler's FR-2 decision follows the inventory's actual conclusion for
that route (not a literal "no auth" reading of this story's AC prose): the inventory
records `token-info/[userId]` as tightened to **authenticated, scoped to the caller's
own id** (an unscoped side-effect-triggering route today, gated behind a session in
the new backend), the same tightening shape as `price-history/check`. So the handler
carries `@ApiCookieAuth()` plus a documented `401`, matching 2.7's pattern precisely
rather than leaving the route undecorated. `token-info/search/:searchTerm` follows the
inventory's separate "deliberately public" decision for that route (generic token
metadata lookup) - no auth decorator, matching `exchange-rates`' pattern.

### Changed Files

+ backend/src/token-info/token-info.module.ts         registers TokenInfoController
+ backend/src/token-info/token-info.controller.ts      GET :userId (sync stub, cookie-auth) and GET search/:searchTerm (public) stubs
+ backend/src/token-info/dto/token-info-sync-response.dto.ts   { success, userId } response shape
+ backend/src/token-info/dto/token-info-response.dto.ts        raw TokenInfo row shape
+ backend/src/metrics/metrics.module.ts                registers MetricsController
+ backend/src/metrics/metrics.controller.ts             GET /metrics stub, plain-text 200/403, metrics-secret bearer scheme
~ backend/src/app.module.ts                             registers TokenInfoModule and MetricsModule
~ backend/src/main.ts                                   adds addBearerAuth('metrics-secret') security scheme to DocumentBuilder

### Verification

- `pnpm --filter @portfolio/backend build` - succeeds (`nest build`, no errors).
- `pnpm --filter @portfolio/backend typecheck` - succeeds, no output.
- `pnpm --filter @portfolio/backend lint` - 0 errors; the one remaining warning
  (`no-floating-promises` on `main.ts`'s `bootstrap()` call) is pre-existing, confirmed
  via `git diff backend/src/main.ts` to predate this story's change.
- Booted the app (`pnpm start`) and confirmed the Nest route-mapping log lists
  `TokenInfoController {/backend/api/token-info}` with both `GET /token-info/:userId`
  and `GET /token-info/search/:searchTerm`, and `MetricsController
  {/backend/api/metrics}` with `GET /metrics`.
- `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` lists
  `/backend/api/token-info/{userId}`, `/backend/api/token-info/search/{searchTerm}`,
  `/backend/api/metrics`, alongside every other Epic 2 endpoint.
- `curl -s localhost:3001/backend/docs-json | jq
  '.paths["/backend/api/metrics"].get.responses."200".content'` returns
  `{ "text/plain": { "schema": { "type": "string" } } }` - confirmed `text/plain`, not
  `application/json`.
- `curl -s -w "\nSTATUS:%{http_code}\n" localhost:3001/backend/api/token-info/1` and
  the same for `localhost:3001/backend/api/metrics` both return `STATUS:501`.
- `curl -s localhost:3001/backend/docs-json | jq '.paths | keys | length'` returns
  `22`, not the `21` this story's Technical Notes predicted. The extra path is
  `/backend/api/health`, a health-check controller registered directly on `AppModule`
  since story 1.4 (pre-existing, outside 2.1's 19-route inventory and therefore not
  counted in the "18 ported + 3 auth" arithmetic). Excluding `/backend/api/health`,
  the count is exactly 21, matching every endpoint in 2.1's inventory plus 2.4's three
  new auth endpoints - confirming no cross-story gap across the whole epic.
