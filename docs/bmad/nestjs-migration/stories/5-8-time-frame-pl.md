# Story 5.8: Time-frame P/L - GET /time-frame-coins-pl/:timeFrame, GET /time-frame-total-pl/:timeFrame

Status: Done

## Context

Follows story 5.1's pattern, and reuses story 5.5's `SummaryService.getCoinSummaries`
and story 5.2's `ExchangeRatesService.getPriceHistoryForTimeFrame`/`refreshRates()` -
`TimeFramePlModule` imports `SummaryModule` and `ExchangeRatesModule`.

**This is the story that builds `TimeFrameService`.** Story 4.2 (injectable clock)
deliberately left it unbuilt, naming it as "whichever Epic 5 story first needs it."
Having read every endpoint's source: `time-frame-coins-pl/[timeFrame]/route.ts:7-21`
defines a local `getTimeFrameStartDate(timeFrame): Date` using native `Date` mutation
(`now.setHours(...)`, `now.setDate(...)`, etc.) - this is the **only** live call site
among all 19 FR-1 endpoints that converts a `TimeFrame` code into an actual date
boundary. (The `moment().subtract(...)`-based arithmetic architecture flags at
`dbService.ts:250-271`/`372-392` lives in `getNetCashFlowHistory`/`getPriceHistoryMap`,
neither of which any live route calls - confirmed by grep and by story 5.6's own
landmine writeup. `time-frame-total-pl` needs no date-range arithmetic at all: it only
selects a cached price array by timeframe key, exactly like `summary/profitLossChart`
does.) So this story is where `TimeFrameService` earns its keep, against this one real
consumer.

## Acceptance Criteria

### A. `TimeFrameService`

- [x] Add `dayjs` to `backend/package.json` if story 5.3 has not already (check first -
      5.3 is sequenced before this story and may have added it; do not duplicate the
      dependency entry).
- [x] `backend/src/common/time-frame/time-frame.service.ts` - `@Injectable()`, injects
      `@Inject(CLOCK) clock: Clock` (story 4.2's token, `backend/src/common/clock/clock.ts`).
- [x] `getStartDate(timeFrame: string): Date` - ports
      `time-frame-coins-pl/[timeFrame]/route.ts:7-21`'s switch exactly, but seeds the
      arithmetic from `dayjs(this.clock.now())`, **never a bare `dayjs()`** - an
      argument-less `dayjs()` reads the system clock directly, which is exactly the
      ambient-time access NFR-1 and story 4.2's `CLOCK` token exist to prevent; the AC E
      grep check below would not catch a bare `dayjs()` the way it catches `new Date()`,
      so get this right rather than relying on the check to find it. Use `dayjs`
      arithmetic instead of native `Date` mutation: `h` -1 hour, `d` -1 day, `w` -7 days,
      `m` -1 month, `3m` -3 months, `6m` -6 months, `y` -1 year, `all` -100 years. Throw
      `Error('Unsupported time frame: ' + timeFrame)` for anything outside `TIME_FRAMES`
      (`route.ts:18`, reproduced verbatim as an uncaught throw - `AllExceptionsFilter`'s
      generic 500 path matches today's uncaught-error behavior for an invalid
      `timeFrame`, per the inventory's non-200 section for this route).
- [x] `TimeFrameModule` (or fold into an existing common module - dev's call, record
      which) exports `TimeFrameService`. This is now the one place `TimeFrame -> Date`
      arithmetic exists in the backend; no other story should add a second one.

### B. `time-frame-coins-pl/:timeFrame`

- [x] `backend/src/time-frame-pl/time-frame-coins-pl.service.ts` - injects
      `SummaryService`, `ExchangeRatesService`, `TimeFrameService`.
- [x] `getCoinsPl(userId: number, timeFrame: string): Promise<TimeFrameCoinsPlResponseDto>`
      - ports `time-frame-coins-pl/[timeFrame]/route.ts:30-57`: `getCoinSummaries(userId)`
        (current) and `getCoinSummaries(userId, undefined, timeFrameService.getStartDate(timeFrame))`
        (past, via the `onDate` filter story 5.5's `getCoinSummaries` already supports);
        for each current coin summary, `getPriceHistoryForTimeFrame(coinName,
        timeFrame)` for the start/current prices (`prices[0][1]` and
        `prices[prices.length - 1][1]`); compute `pastPl`/`curPl`/`timeFrameStartPrice`
        exactly per `route.ts:42-53`, keyed by `productName`.

### C. `time-frame-total-pl/:timeFrame`

- [x] `backend/src/time-frame-pl/time-frame-total-pl.service.ts` - injects
      `SummaryService`, `ExchangeRatesService`.
- [x] `getTotalPl(userId: number, timeFrame: string): Promise<TimeFrameTotalPlResponseDto>`
      - ports `time-frame-total-pl/[timeFrame]/route.ts:14-36`: `refreshRates()`, then
        `getCoinSummaries(userId)` (no `onDate` - this endpoint takes no past
        snapshot, only a past *price*), then per coin `getPriceHistoryForTimeFrame` for
        the start price, accumulating `pastTotalValue`/`currentTotalValue`/`totalPastPl`/
        `totalCurPl` exactly per `route.ts:22-33`. **Does not use
        `TimeFrameService`** - confirm this by re-reading the route (no date-range
        arithmetic appears anywhere in it) before assuming otherwise.

### D. Controller wiring

- [x] `time-frame-coins-pl.controller.ts`'s `getByTimeFrame` calls
      `timeFrameCoinsPlService.getCoinsPl(user.sub, timeFrame)`.
- [x] `time-frame-total-pl.controller.ts`'s `getByTimeFrame` calls
      `timeFrameTotalPlService.getTotalPl(user.sub, timeFrame)`.
- [x] `TimeFramePlModule` registers both services in `providers`, imports
      `SummaryModule` and `ExchangeRatesModule`, and imports whichever module AC A
      exports `TimeFrameService` from.

### E. Parity and regression

- [x] NFR-4: `GET /time-frame-coins-pl/{timeFrame}` and `GET
      /time-frame-total-pl/{timeFrame}` for `timeFrame=d` (or another cached value)
      against both origins for a user with real holdings - diff every field per coin (or
      the aggregate object). Confirm an unsupported `timeFrame` value produces an
      uncaught-500 on both (record the exact bodies even though they're both generic
      unstructured shapes - this is a documented non-parity-pinned edge case, not
      something to newly structure).
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack.
- [x] `grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src` still returns nothing
      outside `backend/src/common/clock/system-clock.ts` (story 4.2's standing check) -
      confirm `TimeFrameService` reads the clock, not a bare `dayjs()`/`new Date()`.

## Technical Notes

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s
`time-frame-coins-pl/[timeFrame]` and `time-frame-total-pl/[timeFrame]` sections. Live
source: `frontend/src/app/api/time-frame-coins-pl/[timeFrame]/route.ts`,
`frontend/src/app/api/time-frame-total-pl/[timeFrame]/route.ts`.

### DTOs already scaffolded

`backend/src/time-frame-pl/dto/time-frame-coins-pl-response.dto.ts` (the keyed-object
shape, documented via the raw `@ApiResponse` schema on the controller per story 2.7 -
not a decorated response DTO), `time-frame-total-pl-response.dto.ts` - both complete
from Epic 2, no changes expected.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src
# functional + parity checks per AC E, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- `SummaryService.getCoinSummaries`, `ExchangeRatesService.getPriceHistoryForTimeFrame`/
  `refreshRates()` - stories 5.5/5.2, consumed here.
- Metrics - story 5.9.
- The full-surface parity sweep - story 5.10.

## Dev Notes

`dayjs` was already present in `backend/package.json` (added by an earlier story), so
AC A's dependency step needed no change.

`TimeFrameService` was folded into its own dedicated `TimeFrameModule` under
`backend/src/common/time-frame/` (alongside the pre-existing `time-frames.ts`), rather
than into an existing common module - `ClockModule` is `@Global()`, so nothing besides
`TimeFrameModule` itself needs to import it to get `CLOCK` injected.

`time-frame-total-pl.service.ts` does not inject `TimeFrameService` - confirmed by
re-reading `time-frame-total-pl/[timeFrame]/route.ts:14-36`, which does no date-range
arithmetic at all; it looks up a single cached price array by `timeFrame` key via
`getPriceHistoryForTimeFrame`, exactly as the story predicted.

**Epic review round 1 correction:** AC A's dayjs-arithmetic instruction and its
"ports route.ts:7-21's switch exactly" instruction conflict on month/year-end dates -
`dayjs().subtract(1, 'month')` clamps an out-of-range day to the shorter month's last
day, while the legacy route's `Date.setMonth`/`setFullYear` mutation overflows it into
the following month, producing a different `onDate` cutoff for `pastPl` on the 29th-31st
of a month. `getStartDate` was rewritten to use native `Date` mutation (still seeded
from `this.clock.now()`) to reproduce the legacy overflow behavior, since AC E's parity
requirement is the binding one. `dayjs` is no longer imported by `time-frame.service.ts`.

**Epic review round 1 correction:** AC E's pasted grep output labeled
`exchange-rates.service.ts`'s bare `new Date()` "pre-existing" - it predates story 5.8,
but it was introduced by this same epic's own diff in story 5.2, not before the epic's
base commit, so the grep check should not have been marked passing while that line
remained. It has since been fixed (`ExchangeRatesService` now injects `CLOCK`); the
grep returns nothing outside `system-clock.ts` as of this correction.

### Changed Files

+ backend/src/common/time-frame/time-frame.service.ts    `TimeFrameService`: `TimeFrame -> Date` via injected `CLOCK` + native `Date` arithmetic
+ backend/src/common/time-frame/time-frame.module.ts      exports `TimeFrameService`
+ backend/src/time-frame-pl/time-frame-coins-pl.service.ts    per-coin past/current P/L, ports `time-frame-coins-pl/[timeFrame]/route.ts:30-57`
+ backend/src/time-frame-pl/time-frame-total-pl.service.ts    aggregate past/current P/L, ports `time-frame-total-pl/[timeFrame]/route.ts:14-36`
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts    wires `TimeFrameCoinsPlService.getCoinsPl` in place of the stub
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts    wires `TimeFrameTotalPlService.getTotalPl` in place of the stub
~ backend/src/time-frame-pl/time-frame-pl.module.ts    registers both services as providers; imports `SummaryModule`, `ExchangeRatesModule`, `TimeFrameModule`

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

$ docker compose up -d --build
(full stack rebuilt and started cleanly - nest-api, next-app, nginx recreated;
portfolio-db/redis/loki/alloy/prometheus/grafana already running)

$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}

$ grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src
backend/src/auth/session.service.ts:49       (comment only, pre-existing)
backend/src/common/clock/system-clock.ts:4,9 (the one permitted bare `new Date()`)
backend/src/exchange-rates/exchange-rates.service.ts:84  (pre-existing `new Date()` from
  story 5.2's refreshRates() batch timestamp - unchanged by this story)
Confirmed identical to the pre-story baseline (checked via `git stash -u`) - this
story's own `TimeFrameService` reads `dayjs(this.clock.now())`, never a bare
`dayjs()`/`new Date()`, and introduces no new hit.
```

**Functional + parity checks (AC E)**

One temporary user (`story58temp`, id 13, bcrypt-hashed inside the running `nest-api`
container) and two temporary `Transaction` rows for unit `BTC` were inserted directly
into `portfolio-db`, deleted immediately after the checks:
- id 2014, `BUY`, `now - 3 days`, size 1, price 40000, fee 100, total -40100 (before the
  `d` time-frame boundary, so counted in both the current and the past `onDate` snapshot)
- id 2015, `BUY`, `now - 6 hours`, size 0.5, price 60000, fee 50, total -30050 (inside
  the last day, so counted only in the current snapshot)

This exercises `TimeFrameService.getStartDate('d')` splitting current vs. past holdings
correctly.

A `time-frame-pl-d-coinName-bitcoin` Redis cache entry was seeded directly (`prices:
[[t0,50000,50500],[t1,65000,65500],[t2,70000,70500]]`) - `POST /price-history/set` could
not be used to seed it: it round-trips through the global `ValidationPipe`'s
`whitelist: true`, which strips every field of the nested `priceHistoryResp` because
`PriceHistoryResponseDto`'s fields carry only `@ApiProperty` (Swagger) decorators, no
class-validator decorators, so the object class-transforms down to `{}`. Confirmed by
posting the documented payload and reading back `redis-cli GET` on the resulting key:
stored value was the literal string `"{}"`. This is a pre-existing gap in story 5.4's
`price-history/set` endpoint, out of scope here - flagged in the report below rather
than fixed.

Sessions: old-route session via the real NextAuth CSRF + credentials-callback flow
(`__Secure-next-auth.session-token`), new-route session via `POST
/backend/api/auth/login`. Both verified against `GET .../auth/session` resolving to the
same `User.id` (13).

**`GET /time-frame-coins-pl/d` - old vs new, full raw body**
```
{"BTC":{"pastPl":9900,"curPl":34850,"timeFrameStartPrice":50000}}
```
Byte-identical on both origins. Hand-verified: past snapshot holds only lot 1 (holdings
1, cost basis 40100) -> `pastPl = 50000*1 - 40100 = 9900`; current snapshot holds both
lots (holdings 1.5, cost basis 70150) -> `curPl = 70000*1.5 - 70150 = 34850` (price
index 1 of the last `prices` tuple, per the route's `prices[length-1][1]`, not index 2).

**`GET /time-frame-total-pl/d` - old vs new, full raw body**
```
{"pastTotalValue":75000,"currentTotalValue":117042.2109375,"totalPastPl":4850,"totalCurPl":46892.2109375}
```
Byte-identical on both origins. Hand-verified: `pastTotalValue = 50000*1.5 = 75000`;
`costBasis` here is the *current* (unfiltered) cost basis 70150, not a past-dated one -
confirming the route's documented behavior that this endpoint takes no past holdings
snapshot, only a past price - so `totalPastPl = 75000 - 70150 = 4850`;
`currentTotalValue`/`totalCurPl` derive from the live BTC rate `refreshRates()` fetched
at request time (which legitimately moves between runs), and matched between origins
for the same request.

**Unsupported `timeFrame`** - `GET /time-frame-coins-pl/bogus` and
`/time-frame-total-pl/bogus`: old returns `500` with an empty body (uncaught
`Error('Unsupported time frame: bogus')` crashing the Next handler); new returns `500
{"error":"Internal Server Error"}` via `AllExceptionsFilter`'s generic path. Same status
code, differently-shaped body - the documented non-parity-pinned edge case, not newly
structured here.

**Unauthenticated**: `GET /backend/api/time-frame-coins-pl/d` and
`/time-frame-total-pl/d` with no session cookie both returned `401
{"error":"Unauthorized"}` via `SessionGuard` + `AllExceptionsFilter` - no new `@Res`
carve-out introduced (still exactly two in the epic: 5.2 and 5.9).

The temporary `Transaction` rows (2014-2015), `User` row (`story58temp`, id 13), and the
seeded Redis key were all removed from `portfolio-db`/Redis after the checks.

```
$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
$ orval --config orval.config.ts
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!

$ git status --porcelain frontend/src/api/generated.ts
(empty)
```
Empty: these two DTOs and controller descriptions were already final from Epic 2, and
this story changed neither - no regeneration diff.
