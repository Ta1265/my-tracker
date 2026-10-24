# Story 5.3: Token info - GET /token-info/:userId, GET /token-info/search/:searchTerm

Status: Done

## Context

Follows story 5.1's pattern (`TokenInfoService`, `EntityManager` from
`@mikro-orm/core`, explicit params). Depends on story 5.2's `ExchangeRatesService`:
`token-info/:userId`'s sync triggers `getPriceHistoryForTimeFrame` for every coin the
user holds, exactly the method 5.2 built - `TokenInfoModule` imports
`ExchangeRatesModule` to inject it rather than re-implementing the cache read.

`token-info/:userId` is the FR-2 tightening case the inventory calls out: today it is
unauthenticated and triggers a write (a price-history sync) for an arbitrary `userId`
taken from the URL with no ownership check. The new backend requires a session **and**
rejects an id/session mismatch - this is the first story where "authenticated" means
more than copying today's guard, so get the mismatch check right rather than only
adding `@UseGuards(SessionGuard)` (which the stub already has).

## Acceptance Criteria

### A. `TokenInfoService`

- [x] `backend/src/token-info/token-info.service.ts` - `@Injectable()`, injects
      `EntityManager` and `ExchangeRatesService` (import `ExchangeRatesModule` in
      `TokenInfoModule`).
- [x] `getTokensForUserId(userId: number): Promise<{ coinName: string; unit: string;
      tokenInfoId: number }[]>` - **a public method, not a private helper** - ports
      `dbService.ts:292-303`'s distinct `(coinName, unit, token_id)` join of
      `Transaction` and `TokenInfo` on `Transaction.unit = TokenInfo.symbol`. A plain
      `em.getConnection().execute()` join or two `em.find()` calls joined in code both
      satisfy D16 here - this is a simple lookup, not an aggregate rollup; pick
      whichever reads more clearly and say which in Dev Notes. **Story 5.6 injects
      `TokenInfoService` and calls this method directly for its own per-coin price
      lookup** - `TokenInfoModule` must `export` `TokenInfoService` for that to work.
- [x] `syncPriceHistoryForUser(userId: number): Promise<void>` - ports
      `frontend/src/server/helpers/update-price-history.ts`'s `syncPriceHistoryToDbForUserId`
      (default `timeFrame = 'all'`, no per-call param today - no route ever passes one):
      - Calls `this.getTokensForUserId(userId)` (above).
      - For each token, call `exchangeRatesService.getPriceHistoryForTimeFrame(coinName,
        'all')`; on success, bulk-insert into `TokenPriceHistory` with `INSERT IGNORE`
        semantics (composite PK on `(token_info_id, date, close_price, timeFrame)` -
        `backend/src/db/entities/token-price-history.entity.ts:8-37` - a duplicate row
        is expected and must be silently skipped, not rejected). Use
        `em.getConnection().execute()` for this multi-row insert-ignore (D16 - a plain
        ORM `persist` would throw on the primary-key collision this depends on
        tolerating). Reproduce `update-price-history.ts:250-255`'s field mapping:
        `close_price` from `closePrice.toFixed(2)`, `date` from
        `moment.unix(unixTimestamp).utc().format('YYYY-MM-DD HH:mm:ss')` - use `dayjs`
        instead of `moment` for this formatting (architecture D30 - `dayjs`, not
        `moment`, in the backend; `dayjs().unix(...).utc().format(...)` is the
        equivalent chain, `dayjs/plugin/utc` needed).
      - On a per-token failure (a cache miss throws, per 5.2's `getPriceHistoryForTimeFrame`),
        log and rethrow (`update-price-history.ts:257-259` logs then rethrows) - do not
        swallow it, since the controller's success response depends on this completing.

### B. Controller wiring

- [x] `token-info.controller.ts`'s `sync` method: parse `userId` from the path param; if
      falsy/unparseable, throw `BadRequestException('Missing userId param')` (matches
      `token-info/[userId]/route.ts:5-6`). **New behavior beyond today's route**: if the
      parsed `userId` does not equal `user.sub`, throw `ForbiddenException()` (403) -
      the FR-2 tightening the inventory records ("scoped to the authenticated caller's
      own id"). Add an `@ApiResponse({ status: 403, ... })` to the stub's Swagger
      annotations, since the stub only documents 400/401 today. On a match, call
      `tokenInfoService.syncPriceHistoryForUser(userId)` and return `{ success: true,
      userId }`.
- [x] `search` method: if `searchTerm` is empty/falsy, throw
      `BadRequestException('Missing search query')`
      (`token-info/search/[searchTerm]/route.ts:6-8`). Otherwise
      `em.getRepository(TokenInfo).find({ $or: [{ name: { $like: \`${searchTerm}%\` } },
      { symbol: { $like: \`${searchTerm}%\` } }] }, { limit: 10 })` (mirrors the Prisma
      `startsWith`/`OR`/`take: 10` at `route.ts:11-19`). Let a query failure propagate
      uncaught - `AllExceptionsFilter`'s generic non-`HttpException` path already
      produces exactly `500 { error: 'Internal Server Error' }`
      (`route.ts:21-23`'s catch), so no explicit try/catch is needed to match FR-3.
- [x] `TokenInfoModule` registers `TokenInfoService` in `providers`, adds it to
      `exports` (story 5.6 imports `TokenInfoModule` to reuse `getTokensForUserId`), and
      imports `ExchangeRatesModule`.

### C. Parity and regression

- [x] NFR-4: `GET /token-info/{userId}` (own id, valid session) against both origins for
      a user with at least one transaction - confirm both trigger a sync (check
      `TokenPriceHistory` row counts before/after, or the Redis cache populated by a
      prior 5.2/5.4 write) and both return `{ success: true, userId }`. Confirm the new
      backend's id/session-mismatch case returns `403` (no old-route equivalent to
      diff against, since today's route has no such check - record this as an
      intentional divergence, not a parity gap). `GET /token-info/search/{searchTerm}`
      for a known prefix against both origins - confirm identical row arrays.
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.

## Technical Notes

### Entities

`backend/src/db/entities/token-info.entity.ts`, `token-price-history.entity.ts`,
`transaction.entity.ts`.

### `dayjs` is added to the backend in this story

No prior Epic 5 story has needed date formatting yet - this is the first
`backend/package.json` dependency on `dayjs` (`^1.11.10`, matching the frontend). Story
5.8 is the other consumer (via `TimeFrameService`) and takes this dependency as already
present.

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `token-info/[userId]`
and `token-info/search/[searchTerm]` sections, including the FR-2 tightening rationale.
Live source: `frontend/src/app/api/token-info/[userId]/route.ts`,
`frontend/src/app/api/token-info/search/[searchTerm]/route.ts`,
`frontend/src/server/helpers/update-price-history.ts`.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
# functional + parity checks per AC C, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- `getPriceHistoryForTimeFrame` itself - story 5.2, consumed here as-is.
- `updateNetCashFlowTableData` and any `NetCashFlow` table write - not called by any of
  the 19 FR-1 endpoints (only by the dead `refreshData` function inside the
  `summary/profitLossChart` route files, which is defined but never invoked - verified
  by reading both route files in full). Not ported.
- The price-history `check`/`set` endpoints - story 5.4.

## Dev Notes

### `getTokensForUserId` implementation choice

Implemented as a raw `em.getConnection().execute()` join (D16's "plain join, either form
satisfies it" carve-out), mirroring `dbService.ts`'s `$queryRaw` verbatim rather than two
`em.find()` calls stitched together in code - MikroORM has no first-class way to join
`Transaction` to `TokenInfo` on `Transaction.unit = TokenInfo.symbol` (not a modeled
`@ManyToOne`, matching story 5.1's decision not to add one), so a hand-composed two-query
join would need its own manual matching logic anyway. The raw query reads as a single
unit and is the same shape as `ExchangeRatesService.doUpdateExchangeRates`'s existing
`SELECT DISTINCT unit FROM ... Transaction` pattern.

### Deliberately reproduced bug: `closePrice` in `syncPriceHistoryForUser` is actually `openPrice`

`getPriceHistoryForTimeFrame`'s `prices` are `[unixTimestamp, openPrice, closePrice]`
triples (`PriceHistoryResponseDto`, confirmed against `frontend/types/global.d.ts:38`),
but `update-price-history.ts:250-255` destructures only `[unixTimestamp, closePrice]` -
grabbing index 1 (`openPrice`), not index 2 (the real `closePrice`), and inserting that
value into `TokenPriceHistory.close_price`. The story's own instruction is to reproduce
this field mapping, not fix it, so `token-info.service.ts`'s `syncPriceHistoryForUser`
destructures the same two elements the same way. Confirmed live rather than assumed: for
`storj`, the cached Redis triple `[1502323200, 0.73, 0]` (openPrice `0.73`, real
closePrice `0.00`) produced a `TokenPriceHistory` row `{ date: '2017-08-10 00:00:00',
close_price: 0.73 }` after a real sync through the new route - the stored value is the
open price, not zero, matching the old code's own mislabeling exactly.

### `TokenInfoResponseDto` vs. the `TokenInfo` entity's nullable columns

`TokenInfoResponseDto`'s fields are all required (it documents the shape every real row
has), but the `TokenInfo` entity's `symbol`/`slug`/`name`/`rank` are annotated
`nullable: true` as a schema-safety measure. `searchTokenInfo`'s `TokenInfo[]` return is
cast to `TokenInfoResponseDto[]` at the controller boundary rather than mapped
field-by-field, since the two are the same shape by name and type once nullability is
set aside - a manual property-by-property copy would be pure repetition of the DTO's own
field list for no behavioral difference.

### `dayjs` added to `backend/package.json`

`dayjs@^1.11.10` (matching the frontend's pin) was added as a `backend/package.json`
dependency and installed via `pnpm install --filter @portfolio/backend`; `pnpm-lock.yaml`
already carried a resolved `dayjs@1.11.23` from the frontend workspace, so no new
resolution was needed - only the `backend` importer entry changed.

### Verification evidence (AC C)

Two temporary users (`story53temp` id 5, `story53temp2` id 6, bcrypt-hashed passwords,
same approach as story 5.1's `story51temp`) and three temporary `Transaction` rows were
inserted directly into `portfolio-db` for the duration of the check: user 5 held BTC
(`token_info_id` 1) and LTC (`token_info_id` 2), user 6 held STORJ (`token_info_id` 357).
All three coins had cached Redis `time-frame-pl-all-coinName-*` data but **zero existing
`TokenPriceHistory` rows for the `all` timeFrame** (confirmed via `GROUP BY timeFrame`
before touching anything - `h`/`d`/`w`/`m`/`6m`/`y` rows existed from earlier
`price-history/set` activity, `all` did not), so the sync's insert path could be observed
directly without needing to delete any pre-existing data.

Sessions: old-route session via the real NextAuth CSRF + credentials-callback flow
(`__Secure-next-auth.session-token`); new-route session via the documented `POST
/backend/api/auth/login`. Both verified against `GET .../auth/session` resolving to the
expected `User.id`.

**Sync - old origin, user 5 (BTC + LTC), unauthenticated (matches today's no-guard route)**
`GET /api/token-info/5` -> `200 {"success":true,"userId":5}`. `TokenPriceHistory` `all`
rows for `token_info_id` 1 and 2 went from 0 to 6376 and 6372 respectively.

**Sync - new origin, user 6 (STORJ), authenticated as user 6**
`GET /backend/api/token-info/6` (session cookie for id 6) -> `200
{"success":true,"userId":6}`. `TokenPriceHistory` `all` rows for `token_info_id` 357 went
from 0 to 5419. A second identical call returned the same `200` body and left the count
at 5419 (INSERT IGNORE deduping the composite-PK collision, no error).

**New-backend error paths, user 6's session unless noted**
- `GET /backend/api/token-info/0` -> `400 {"error":"Missing userId param"}` (old route,
  same path -> identical `400 {"error":"Missing userId param"}`).
- `GET /backend/api/token-info/5` (session is user 6, path asks for user 5) -> `403
  {"error":"Forbidden"}` - the FR-2 tightening; no old-route equivalent exists to diff
  against (today's route has no ownership check at all), recorded as an intentional
  divergence per the story's own framing, not a parity gap.
- `GET /backend/api/token-info/6` with no session cookie -> `401
  {"error":"Unauthorized"}`.

**Search - both origins, `GET .../token-info/search/{searchTerm}`**
- `bit` -> byte-identical 10-row arrays on both origins (led by `{"token_id":1,"symbol":
  "BTC","slug":"bitcoin","name":"Bitcoin","rank":1}`).
- `ET` (symbol-prefix match, not just name) -> byte-identical 10-row arrays on both
  origins (led by `ETH`/`ethereum`).
- A single-space search term (`%20`, non-empty so not rejected by the falsy check on
  either origin) -> identical single-row match on both origins (a token whose `name`
  genuinely starts with a space), confirming the `!searchTerm` check's truthiness
  semantics match `route.ts`'s `!searchTerm?.length` for this edge case.

All temporary `Transaction` rows (ids 2002-2004) and `User` rows (`story53temp`,
`story53temp2`) were deleted afterward. The `TokenPriceHistory` `all` rows the syncs
wrote for `token_info_id` 1, 2, and 357 were left in place deliberately - they are
correct, real synced price data (exactly what the feature is supposed to produce for any
user holding those coins), not test pollution, so there was nothing to clean up there.

### Changed Files

+ backend/src/token-info/token-info.service.ts   `TokenInfoService` - `getTokensForUserId` (public, raw join), `searchTokenInfo`, `syncPriceHistoryForUser` (per-token price-history fetch + `INSERT IGNORE` bulk write via `em.getConnection().execute()`, reproducing the `openPrice`-as-`closePrice` field-mapping bug verbatim)
~ backend/src/token-info/token-info.controller.ts   wires `TokenInfoService` into `sync` (userId parse/falsy 400, id/session-mismatch 403, success sync) and `search` (empty-term 400, delegates to `searchTokenInfo`); adds the 403 Swagger response to `sync`
~ backend/src/token-info/token-info.module.ts   imports `ExchangeRatesModule`, registers and exports `TokenInfoService`
~ backend/package.json   adds `dayjs@^1.11.10` (first backend consumer, per architecture D30)
~ pnpm-lock.yaml   backend importer picks up `dayjs`
~ frontend/src/api/generated.ts   regenerated - adds `TokenInfoSync403` to the `tokenInfoSync` hook's error union (new 403 Swagger response), no other change

### Verification

```
$ pnpm --filter @portfolio/backend typecheck
$ tsc --noEmit -p tsconfig.json
(no output - passed)

$ pnpm --filter @portfolio/backend lint
$ eslint "{src,test}/**/*.ts"
backend/src/main.ts 31:1  warning  no-floating-promises on bootstrap() - pre-existing since story 4.1, untouched by this story
✖ 1 problem (0 errors, 1 warning)

$ pnpm --filter @portfolio/backend build
$ nest build
(no output - passed)

$ docker compose up -d --build nest-api
(built and started cleanly)

$ docker compose up -d --build
(full stack rebuilt and started cleanly)
$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}

# functional + parity checks per AC C - see "Verification evidence (AC C)" above

$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
 M frontend/src/api/generated.ts   # non-empty - adds TokenInfoSync403 to the error union; committed

$ pnpm --filter @portfolio/frontend typecheck
# pre-existing failures only, all in untouched legacy GR-1 files (AddTransaction.tsx,
# ModalContextProvider.tsx, NumberFormatCustom.tsx, LineChart.tsx, ProductTable.tsx,
# SortArrow.tsx, TableComponent.tsx, TickerDisplay.tsx, storeTransactions.ts) - none
# reference generated.ts or any token-info hook
```
