# Story 5.4: Price history - GET /price-history/check, POST /price-history/set

Status: Done

## Context

Follows story 5.1's pattern. Depends on story 5.2's Redis provider (`REDIS` token) -
both endpoints here read/write the same `time-frame-pl-{timeFrame}-coinName-{coinName}`
cache keys 5.2's `getPriceHistoryForTimeFrame` reads. `RedisModule` is `@Global()`
(story 5.2), so this story injects `@Inject(REDIS)` directly with no module import of
its own.

`price-history/check` is the FR-2 tightening the inventory flags by name: today's route
reads `session?.user?.id` and never enforces it, silently returning `[]` for an
unauthenticated caller instead of rejecting. The stub already has
`@UseGuards(SessionGuard)` - this story's job is the real logic behind it, not the auth
decision (already made and documented in the stub's `@ApiOperation` description).

## Acceptance Criteria

### A. `PriceHistoryService`

- [x] `backend/src/price-history/price-history.service.ts` - `@Injectable()`, injects
      `EntityManager` and `@Inject(REDIS) redis: Redis`.
- [x] `checkCoverage(userId: number): Promise<PriceHistoryCheckResponseDto[]>` - ports
      `frontend/src/app/api/price-history/check/route.ts`:
      - `getUsersCoins(userId)` equivalent - `SELECT DISTINCT coinName FROM
        PORTFOLIO.Transaction WHERE userId = ?` (`dbService.ts:27-33`) - a plain
        distinct projection, fine via `em.getConnection().execute()` or
        `em.getRepository(Transaction)` with a distinct/group-by; either satisfies D16
        for a query this simple.
      - For each coin, for each of the 8 `TIME_FRAMES` values, `redis.exists(`time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`)`;
        collect the timeframes where it's absent into `timeFramesNeeded`
        (`route.ts:17-29`). Both segments lowercased, exactly as today.
- [x] `setEntry(coinName: string, timeFrame: string, priceHistoryResp:
      PriceHistoryResponseDto): Promise<string>` - ports
      `frontend/src/app/api/price-history/set/route.ts`: validate `coinName`,
      `timeFrame`, `priceHistoryResp` are all truthy, else throw
      `BadRequestException('Missing required fields')` (`route.ts:22-24`). Write
      `redis.setex(cacheKey, CACHE_EXPIRATION_BY_TIME_FRAME[timeFrame],
      JSON.stringify(priceHistoryResp))`, importing `CACHE_EXPIRATION_BY_TIME_FRAME`
      from story 5.2's `exchange-rates.service.ts` rather than re-declaring the table -
      it is the same TTLs 5.2's `getPriceHistoryForTimeFrame` uses for reads. Return the
      interpolated message `` `Price history cached
      successfully: ${coinName} - ${timeFrame}` `` (`route.ts:29`) - **note this is not
      what `SetPriceHistoryResponseDto`'s current `@ApiProperty` example says**
      (`backend/src/price-history/dto/set-price-history-response.dto.ts:5`, currently
      `'Price history updated for BTC (d)'`); correct the DTO's example to match the
      real interpolation format so Swagger stays accurate.

### B. Controller wiring

- [x] `price-history.controller.ts`'s `check` calls
      `priceHistoryService.checkCoverage(user.sub)` and returns the array directly.
- [x] `set` calls `priceHistoryService.setEntry(body.coinName, body.timeFrame,
      body.priceHistoryResp)` and returns `{ message }`.
- [x] `PriceHistoryModule` registers `PriceHistoryService` in `providers`. No
      `RedisModule` import needed - it is `@Global()` (story 5.2).

### C. Parity and regression

- [x] NFR-4: seed a cache entry via `POST /price-history/set` and its `/backend/api/`
      equivalent with identical bodies, confirm both `200` with their respective (now-
      corrected) message text. `GET /price-history/check` for the same authenticated
      user against both origins - confirm identical `timeFramesNeeded` arrays per coin
      (seed/clear specific keys as needed to get a deterministic comparison). Confirm
      the new backend's unauthenticated case is `401` (an intentional divergence from
      today's silent `[]` - record it as such, not a parity mismatch).
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.

## Technical Notes

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `price-history/check`
and `price-history/set` sections. Live source:
`frontend/src/app/api/price-history/check/route.ts`,
`frontend/src/app/api/price-history/set/route.ts`.

### DTOs already scaffolded

`backend/src/price-history/dto/price-history-check-response.dto.ts`,
`set-price-history-request.dto.ts`, `set-price-history-response.dto.ts` - all exist
from Epic 2/9.1b with `TimeFrame` already wired as the generated enum. Only the response
message's `@ApiProperty` example needs correcting (AC A).

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
# functional + parity checks per AC C, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit - the message-example
                                                        # fix changes Swagger, not the
                                                        # TS type, so a diff is not
                                                        # guaranteed; note either way
```

## Out of Scope

- `getPriceHistoryForTimeFrame` and `CACHE_EXPIRATION_BY_TIME_FRAME` - story 5.2,
  imported here.
- `syncPriceHistoryToDbForUserId` - story 5.3.
- Any `NetCashFlow`/`updateNetCashFlowTableData` write - not called by any live route
  (see story 5.3's Out of Scope for the verification).

## Dev Notes

### `POST /price-history/set` needed `@HttpCode(200)`

Nest's default status for a `@Post` handler that returns normally is `201`; the old
route returns `200`. Same fix as story 5.1's `transaction/add` -
`price-history.controller.ts`'s `set` now carries `@HttpCode(200)`. Confirmed via the AC
C parity check below: both origins now return `200` with byte-identical message bodies.

### Verification evidence (AC C)

One temporary user (`story54temp`, id 7, bcrypt-hashed password) and one temporary
`Transaction` row (id 2005, `coinName: 'Story54Coin'`, `unit: 'S54'`) were inserted
directly into `portfolio-db` for the duration of the check, chosen to be a coin name no
real user holds so its Redis cache keys started genuinely empty (confirmed via `redis-cli
KEYS "time-frame-pl-*-coinName-story54coin"` returning nothing before touching anything).

Sessions: old-route session via the real NextAuth CSRF + credentials-callback flow
(`__Secure-next-auth.session-token`); new-route session via the documented `POST
/backend/api/auth/login`. Both verified against `GET .../auth/session` resolving to
`User.id: 7`.

**Check - baseline, no cache entries, both origins, user 7**
`GET /api/price-history/check` and `GET /backend/api/price-history/check` (respective
sessions) both -> `200 [{"coinName":"Story54Coin","timeFramesNeeded":
["h","d","w","m","3m","6m","y","all"]}]` - identical.

**Set - identical body on both routes**
(`{"coinName":"Story54Coin","timeFrame":"d","priceHistoryResp":{"prices":
[[1700000000,100,101]],"price_change":0.01,"usd_price_change":1}}`):
- Old: `200`, body `{"message":"Price history cached successfully: Story54Coin - d"}`.
- New (before the `@HttpCode(200)` fix): `201` with the same body - caught and fixed
  (see above). New (after): `200`, byte-identical body to the old route's.

**Check reflects the new cache entry - both origins**
After seeding `d` on the old route and `w` on the old route's `set` (same cache key
format, so either origin's write is visible to either origin's read), `GET
.../price-history/check` on both origins -> `200 [{"coinName":"Story54Coin",
"timeFramesNeeded":["h","m","3m","6m","y","all"]}]` - identical, confirming `d` and `w`
both dropped out of `timeFramesNeeded` on both origins.

**Error paths (old / new), same body except the field under test**
- `set` missing `coinName`: both `400 {"error":"Missing required fields"}`.
- `check` with no session cookie: old `200 []` (today's silent `session?.user?.id`
  fall-through - `getUsersCoins(undefined)` matches no rows), new `401
  {"error":"Unauthorized"}` - the FR-2 tightening the story calls for; an intentional
  divergence, not a parity mismatch.

All temporary `Transaction` (id 2005) and `User` (`story54temp`) rows were deleted
afterward; the two Redis keys the seeding wrote
(`time-frame-pl-d-coinName-story54coin`, `time-frame-pl-w-coinName-story54coin`) were
deleted as well since they were test pollution for a coin no real user holds.

### Changed Files

+ backend/src/price-history/price-history.service.ts   `checkCoverage`/`setEntry` real logic behind the two stub endpoints
~ backend/src/price-history/price-history.controller.ts   wires the service in; `@HttpCode(200)` on `set` to match the old route's status
~ backend/src/price-history/price-history.module.ts   registers `PriceHistoryService` as a provider
~ backend/src/price-history/dto/set-price-history-response.dto.ts   corrected the `message` example to the real interpolated format

### Verification

```
$ pnpm --filter @portfolio/backend typecheck
$ tsc --noEmit -p tsconfig.json
(no output - passed)

$ pnpm --filter @portfolio/backend lint
$ eslint "{src,test}/**/*.ts"
backend/src/main.ts 31:1  warning  no-floating-promises on bootstrap() - pre-existing, untouched by this story
✖ 1 problem (0 errors, 1 warning)

$ pnpm --filter @portfolio/backend build
$ nest build
(no output - passed)

$ docker compose up -d --build nest-api
(built and started cleanly)

# functional + parity checks per AC C - see "Verification evidence (AC C)" above
# (includes the @HttpCode(200) fix and its re-verification)

$ docker compose up -d --build
(full stack rebuilt and started cleanly)
$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}

$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
(no output - empty diff; the DTO example-string fix changes Swagger only, not the TS
type, so no regeneration diff was produced - nothing to commit here)
```
