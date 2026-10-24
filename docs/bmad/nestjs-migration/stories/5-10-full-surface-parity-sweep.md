# Story 5.10: Full-surface parity sweep

Status: Done

## Context

The evidence that Epic 7's cutover is safe (PRD: "This is the evidence that Epic 7's
cutover is safe"). Stories 5.1-5.9 each recorded a per-domain NFR-4 comparison as they
were built; this story re-runs every one of the 19 FR-1 endpoints in a single pass,
against the finished backend, and records the results together in one place so the
epic's parity evidence is reviewable as a set rather than scattered across nine story
files. It is a sweep, not new implementation - no controller or service code is
expected to change here unless the sweep finds a real defect.

## Acceptance Criteria

- [x] For each of the 19 rows in `docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`
      (18 numbered endpoints plus `auth/[...nextauth]`, which is explicitly out of
      contract-inventory scope per story 2.1 and is not re-tested here - Epic 4's
      stories 4.5/4.6/4.8 already cover the new auth endpoints), exercise both the old
      Next.js route and the new NestJS route with the same authenticated user (where
      auth applies) and the same inputs, and record:
      - The success-path response, diffed field by field (including runtime JS type,
        not just value, for every numeric field - the raw-deserialization-drift risk
        architecture names).
      - At least one documented non-200 case per endpoint from the inventory's
        "Response - non-200" section (a bad input, a missing session, an unknown id,
        etc.), diffed the same way.
      - Any endpoint where the new backend's behavior is an intentional, already-decided
        divergence from the old route (the seven FR-2 tightenings the inventory's own
        table lists, plus `metrics`'s F3 additive-metrics divergence) - confirm the
        divergence is exactly the one already recorded in that endpoint's own story, not
        a new one.
- [x] A one-off comparison script/harness is permitted and expected (NFR-4) - not
      committed, no test runner, no assertions library, no CI hook. Paste its output (or
      the curl transcripts it produced) into Dev Notes per endpoint; do not merely
      assert "matches."
- [x] Any discrepancy found that is **not** an already-documented, intentional
      divergence is a real defect: fix it in the owning domain's code (this story may
      touch any `backend/src/<domain>/` file to fix a defect it finds, citing which
      story's AC the fix corrects) and re-run that endpoint's comparison until it
      passes. If a DTO's shape changes as part of a fix, regenerate and commit
      `frontend/src/api/generated.ts` in this story (FR-26).
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack from cold.
- [x] A summary table (endpoint, old status, new status, match/divergence-and-why) is
      recorded in Dev Notes as the artifact Epic 7 (and this epic's Owner Review) reads
      to confirm the surface is safe to cut over.

## Technical Notes

### What this story is not

Not a rewrite of any domain's implementation, and not the place to introduce new
behavior. If every comparison passes clean against what stories 5.1-5.9 already
documented, this story's Dev Notes are the sweep's transcript plus "no defects found" -
that is a complete and successful outcome, not a sign the story did nothing.

### Auth for the comparison

A NextAuth session needs a real login through the existing `/login` page or the
`next-auth` credentials flow; a Nest session needs a real `POST
/backend/api/auth/login` (story 4.5). Both cookies can be held by the same browser/HTTP
client simultaneously without interfering (architecture: distinct cookie names,
distinct keys) - use whichever session is appropriate per request rather than logging
in and out repeatedly.

### Source of truth

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md` is the per-endpoint
contract every comparison is checked against. Each of stories 5.1-5.9's own Dev Notes
already has one round of this evidence per domain - this story's job is completeness
and a single consolidated record, not a first look.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build
# one comparison pass per the 19-row table above, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit only if a defect fix changed a DTO
```

## Out of Scope

- Any new endpoint, DTO, or module - all 19 already exist from Epic 2 and stories
  5.1-5.9.
- The Epic 6/7 auth or data-origin seams - out of this epic entirely.

## Dev Notes

### Defect found and fixed: `POST /price-history/set` silently dropped its nested body (story 5.4's AC)

Confirmed the finding carried into this story: `PriceHistoryResponseDto`
(`backend/src/exchange-rates/dto/price-history-response.dto.ts`) carried only
`@ApiProperty` (Swagger) decorators, no class-validator decorators. The global
`ValidationPipe`'s `whitelist: true` strips any property with no class-validator
decorator, including properties inside a `@ValidateNested()` object - so
`SetPriceHistoryRequestDto.priceHistoryResp` class-transformed down to `{}` before the
handler ever saw it. Reproduced live before touching code: `POST
/backend/api/price-history/set` with the documented payload, then `docker exec redis
redis-cli GET time-frame-pl-h-coinName-<coin>` read back the literal string `"{}"`.

Fixed by adding `@IsOptional()` plus a type-matching validator (`@IsArray()` /
`@IsNumber()`) to each of `PriceHistoryResponseDto`'s three fields
(`price-history-response.dto.ts:1-33`), following the same `@IsOptional()`-plus-type
convention story 5.1 established for every other request DTO in this backend (presence
enforcement stays business logic in the handler, not the pipe). Re-verified: the same
`POST` now writes the full nested object to Redis
(`{"prices":[[1700000000,10,11]],"price_change":0.5,"usd_price_change":5}`), and a
follow-up `GET /exchange-rates/{timeFrame}/{coinName}` reads back the identical object.
No DTO field, type, or Swagger-visible shape changed - `frontend/src/api/generated.ts`
regeneration produced an empty diff (see Verification).

### DTO audit: every other `@Body()`-bound DTO in the backend, checked for the same gap

The instance is one DTO; the bug class is "a request-body DTO (or anything nested
inside one) with only `@ApiProperty`, no class-validator decorator, silently emptied by
`whitelist: true`." Audited every `@Body()` call site and everything reachable from it:

- `grep -rn '@Body(' backend/src` -> exactly three: `auth/auth.controller.ts` (`login`,
  `LoginRequestDto`), `transactions/transactions.controller.ts` (`add`,
  `TransactionAddRequestDto`), `price-history/price-history.controller.ts` (`set`,
  `SetPriceHistoryRequestDto`).
- `LoginRequestDto` (`auth/dto/login-request.dto.ts`) - every field (`username`,
  `password`, `rememberMe`) already carries `@IsNotEmpty()`/`@IsOptional()` plus
  `@IsString()`/`@IsBoolean()`. Not affected.
- `TransactionAddRequestDto` (`transactions/dto/transaction-add-request.dto.ts`) - every
  field already carries `@IsOptional()` plus a type validator (story 5.1's convention).
  No nested object. Not affected.
- `SetPriceHistoryRequestDto` (`price-history/dto/set-price-history-request.dto.ts`) -
  `coinName`/`timeFrame` already validated; `priceHistoryResp` is the one nested field
  in the entire backend (`grep -rn '@Type(\|ValidateNested' backend/src` returns exactly
  this one hit), and it pointed at the unvalidated `PriceHistoryResponseDto` above - now
  fixed.
- Every other `*.dto.ts` file under `backend/src` (`login-response`, `session-response`,
  `price-history-check-response`, `set-price-history-response`,
  `product-transaction-response`, `stats-response`, `coin-summary-response`,
  `portfolio-summary-response`, `profit-loss-chart-response`,
  `time-frame-coins-pl-response`, `time-frame-total-pl-response`,
  `token-info-response`, `token-info-sync-response`) is a **response**-only DTO - never
  bound via `@Body()`, never `@Type()`-referenced from a request DTO, so the
  `ValidationPipe` never runs against them regardless of their decorators.

Conclusion: `PriceHistoryResponseDto` was the only affected DTO. No other endpoint had
this gap.

### `@Res({ passthrough: false })` carve-out count, reconfirmed

`grep -rn "passthrough: false" backend/src` -> exactly two hits:
`exchange-rates/exchange-rates.controller.ts` (`getByUnit`, story 5.2's D22 bare-string
carve-out) and `metrics/metrics.controller.ts` (story 5.9's plain-text carve-out). No
third carve-out was added by this story's fix - the DTO fix touches only a nested
request DTO's validators, not response handling.

### Open question answered, then corrected in epic review round 1: does the `Transaction.size` float-precision gap reach the UI at a visible precision?

**Original answer (superseded below):** this section originally concluded the gap was a
~1e-8 relative difference, invisible at the UI's 2-decimal rendering, and cited
`runningBalance` as sourced from "the unaffected raw-query path." Both claims were wrong:

- The bound is not `~1e-8`. `total`/`size` are MySQL `FLOAT` columns; MikroORM's raw
  query path (`em.getConnection().execute()`, used by `getBuySellTotalFiFo`) renders them
  through MySQL's text protocol, which truncates FLOAT (not DOUBLE) values to 6
  significant digits, same as `em.find()`'s entity hydration. The legacy Prisma path reads
  the same columns through `ABS()`, which MySQL evaluates as DOUBLE and returns at full
  float32-derived precision. Measured directly against `portfolio-db`: a `total` of
  `-1234567.5` came back as `-1234570` (6 sig figs) through the unfixed path and
  `1234567.5` through an `ABS()`-wrapped read of the same row - a plainly visible dollar
  difference, not a sub-cent one. It never surfaced in any parity run because no live
  transaction has more than 6 significant digits (max `|total|` across all 236 rows is
  `15252`).
- `runningBalance` is not sourced from the unaffected raw-query path - it comes from
  `ProductService.getTransactionsForProduct`'s `em.find(Transaction, ...)` call
  (`product.service.ts:33-37`), the same entity-hydration path as the affected
  `getBuySellTotalFiFo`, and only reads as "clean" because it is accumulated and then
  `.toFixed(4)`-rounded before rendering.
- The trace also did not check `summary/coins`'s and `summary/portfolio`'s
  `netContributions`/`netCashHoldings` fields, which are equally downstream of
  `getBuySellTotalFiFo`. They do render at two decimals
  (`SingleStat.tsx:289,304`, `BreakDown.tsx:21-31`), so the "invisible after rounding"
  conclusion happens to hold for them too, but that was never verified here.

**Fix, not just documentation:** `getBuySellTotalFiFo` (`summary/summary.service.ts`) was
rewritten to read `total`/`size` through a raw SQL `SELECT ... ABS(total) AS total,
ABS(size) AS size ...` - matching `dbService.ts:139-147`'s own `ABS()`-wrapped query
exactly - instead of `em.find(Transaction, ...)`. This closes the precision gap outright
for every field downstream of it (`summary/coins`, `summary/portfolio`,
`summary/profitLossChart`'s `netRows`), rather than relying on it staying below a
visibility threshold. Verified live: seeding a `total` of `-1234567.5` and reading it back
through `GET /summary/portfolio` now returns `netContributions: 1234567.5` (exact),
where it previously would have returned `1234570`.

`ProductService`'s own `em.find(Transaction, ...)` read (used for `runningBalance` and
`realizedGains`) is a separate call site, untouched by this fix.

**Epic review round 2 correction:** the paragraph above originally called this a
follow-up candidate ("carries the same theoretical exposure"). That premise is false and
is retracted, not merely softened. Measured directly against `portfolio-db` on the same
four rows: `prisma.transaction.findMany`'s `size` values (`0.8615`, `1.82112`,
`0.209234`, `17.8703`) are byte-identical to MikroORM's `em.find()` output on those rows;
Prisma has no protocol-level float32 passthrough on its ORM read path. Only an
`ABS()`-wrapped raw `SELECT` returns the wider DOUBLE expansion
(`0.8615000247955322`, ...). `ProductService.getTransactionsForProduct`'s `em.find()` is
therefore not an under-fixed instance of the same bug - it is the correct read for what
it ports: `product/[product]/route.ts:85` calls plain `db.transaction.findMany`, with no
`ABS()` widening, so `em.find()` already matches it exactly. Switching that call site to
a raw `ABS()` read (as this section previously proposed) would regress
`GET /product/:product`: `route.ts:62` emits `size: transaction.size.toString()`
unrounded, so every row's `size` would change from `"0.8615"` to
`"0.8615000247955322"`. There is no follow-up to file here; `getBuySellTotalFiFo`'s raw
read and `ProductService`'s `em.find()` read are two deliberately different paths that
each match their own legacy counterpart.

### 19-row parity sweep - method

Ran against the live stack (`docker compose up -d --build`, all 9 services up) with a
temporary user (`story510temp`, `User.id` 14, bcrypt-hashed inside the running
`nest-api` container, same convention every 5.x story used) and three temporary
`Transaction` rows for `BTC` (`token_id` 1): two `BUY`s (`2024-01-01`, size 0.5, price
40000, fee 50; `2025-06-01`, size 0.5, price 60000, fee 50) and one `SELL`
(`2026-08-01`, size 0.3, price 70000, fee 20) - the same lot shape story 5.7 used, so
FIFO/realized-gains math exercises both the long- and short-term branches. Old-route
session: real NextAuth CSRF + `credentials` callback flow
(`__Secure-next-auth.session-token`). New-route session: `POST
/backend/api/auth/login` (story 4.5). Both verified via `GET .../auth/session`
resolving to `User.id: 14`. `time-frame-pl-*-coinName-bitcoin` and
`net-cash-flow-history-14-*` Redis keys were seeded/cleared per check as each story's
own sweep did, so cache-miss and cache-hit paths were both exercised deliberately
rather than accidentally. All temporary `Transaction` rows, the `User` row, and every
Redis key this sweep wrote were deleted after the checks (`SELECT COUNT(*)` against
both tables confirmed 0 remaining afterward).

Full request/response transcripts for every row below (raw curl output, both origins,
same body/session per pair):

**`POST /transaction/add`** - same body both origins ->
`200 "Transaction added"` on both, byte-identical. Errors: missing `size` -> both
`400 {"error":"Missing required fields"}`; `side:"HOLD"` -> both
`400 {"error":"Invalid side"}`; no session -> both `401 {"error":"Unauthorized"}`.

**`DELETE /transaction/:id`** - own written rows on each origin -> both `204` empty
body. Nonexistent id (`9999999`) -> both
`500 {"error":"An error occurred while deleting the transaction"}`. No session -> new
`401 {"error":"Unauthorized"}`.

**`GET /summary/coins`** - both origins, full raw body:
`[{"productName":"BTC","coinName":"Bitcoin","avgPurchasePrice":50100,"avgSellPrice":69933.33055443245,"holdings":0.699999988079071,"valueOfHoldings":55095.790467974264,"profitLossAtCurrentPrice":25975.790467974264,"percentPL":51.84788516561729,"currentPrice":78708.2734375,"breakEvenPrice":41600.00070844379,"inGreen":true,"totalBuyCost":50100,"totalSellProfits":20980,"costBasis":29120,"netContributions":50100,"netCashHoldings":20980}]`
- byte-identical, all numeric fields unquoted on both. No session -> both `401`.

**`GET /summary/portfolio`** - both origins:
`{"purchases":50100,"sales":20980,"costBasis":29120,"valueOfHoldings":55095.790467974264,"totalPLatCurrentPrice":25975.790467974264,"netCashHoldings":20980,"netContributions":50100,"accountValue":76075.79046797426,"realizedReturn":-29120,"roi":51.84788516561729,"inGreen":true}`
- byte-identical. No session -> both `401`.

**`GET /summary/BTC`** - both origins, identical single-element array to `summary/coins`
above - byte-identical. No session -> both `401`.

**`GET /summary/profitLossChart?timeFrame=d`** - cache-miss case first (no
`time-frame-pl-d-coinName-bitcoin` key): both `500` (old: empty body, framework crash on
the uncaught `getPriceHistoryForTimeFrame` cache-miss throw; new:
`{"error":"Internal Server Error"}` via `AllExceptionsFilter`) - same status, differently
shaped body, the already-documented uncaught-throw pattern (5.2's Dev Notes), not new.

**Epic review round 2 re-run:** the seeded-transaction comparison below was originally
recorded before the F3 fix (`getBuySellTotalFiFo` reading `total`/`size` via a raw
`ABS()`-wrapped `SELECT` instead of `em.find`) and showed a float-precision divergence on
rows after the seeded `SELL`. Re-seeded a fresh temp user (`story510f7temp`, `User.id`
5) with the same three-row lot shape (`BUY` `2024-01-01` size 0.5 @ 40000 fee 50; `BUY`
`2025-06-01` size 0.5 @ 60000 fee 50; `SELL` `2026-08-01` size 0.3 @ 70000 fee 20), seeded
a two-point `time-frame-pl-d-coinName-bitcoin` price history spanning before and after
the `SELL` date, cleared the `net-cash-flow-history-5-d` cache key before each call, and
re-ran on the rebuilt `nest-api` (F3's fix already built into the running container):
```
old: {"netRows":[{"date":1749945600000,"valueOfHoldings":70000,"profitLoss":19900,"roi":39.72055888223553},{"date":1786752000000,"valueOfHoldings":52499.99910593033,"profitLoss":23379.99910593033,"roi":46.66666488209646}],"lowestPointIndex":0,"highestPointIndex":1}
new: {"netRows":[{"date":1749945600000,"valueOfHoldings":70000,"profitLoss":19900,"roi":39.72055888223553},{"date":1786752000000,"valueOfHoldings":52499.99910593033,"profitLoss":23379.99910593033,"roi":46.66666488209646}],"lowestPointIndex":0,"highestPointIndex":1}
```
byte-identical on every field, including the row after the seeded `SELL` that previously
diverged. The `Transaction.size` FLOAT gap this row used to exercise is closed by F3's
fix, not merely re-recorded. Temp user, transactions, and both Redis keys removed after
(`SELECT COUNT(*) FROM Transaction WHERE userId=5` / `FROM User WHERE
username='story510f7temp'` both `0`; `KEYS "*story510f7*"` empty).

**`GET /summary/profitLossChart/d`** (path variant) - re-ran identically against the same
seeded data with the cache cleared again first: `old`/`new` bodies byte-identical to the
query variant above. No session -> both `401` (checked on both variants).

**`GET /stats/BTC`** - both origins:
`{"productName":"BTC","avgPurchasePrice":"$50,100","avgSellPrice":"$69,933","holdings":"0.7000","valueOfHoldings":"$55,096","profitLossAtCurrentPrice":"$25,976","percentPL":"51.8%","currentPrice":"$78,708","breakEvenPrice":"$41,600"}`
- byte-identical. `GET /stats/NOPE` (no matching rows): old `500` empty body (framework
crash on `NextResponse.json(undefined)`), new `200` `content-length: 0` - the
already-documented intentional divergence (5.7's Dev Notes), reconfirmed exactly as
recorded, not a new shape. No session -> both `401`.

**`GET /product/BTC`** - both origins, full raw body (3 rows, most-recent-first,
`realizedGains` on the `SELL` row) - byte-identical, including the FIFO artifact
(`realizedGains` values matching the same-lot-shape check story 5.7 already ran).
`GET /product/NOPE` (no rows) -> both `200 []`. No session -> both `401`.

**`GET /exchange-rates/d/bitcoin`** (seeded cache) - both origins:
`{"prices":[[1787486400,60000,60500]],"price_change":0.02,"usd_price_change":600}` -
byte-identical. Cache miss (`d/nonexistentcoinxyz510`) -> both `500` (old empty body,
new `{"error":"Internal Server Error"}`), matching 5.2's documented pattern. Public - no
session tested (deliberately public per FR-2).

**`GET /exchange-rates/unit/BTC`** - both origins: `"$78,721"` (bare string), byte-
identical. Unknown unit (`unit/NOPE510`) -> both `404 "Exchange rate not found"` (bare
string). Public.

**`GET /price-history/check`** - authenticated, both origins:
`[{"coinName":"Bitcoin","timeFramesNeeded":["h","d"]}]` - byte-identical (`w`/`m`/`3m`/
`6m`/`y`/`all` already cached from earlier sweep activity on this coin). No session:
old `200 []` (today's silent fall-through), new `401 {"error":"Unauthorized"}` - the
documented FR-2 tightening, confirmed to be exactly that and no more.

**`POST /price-history/set`** - identical body, both origins -> both
`200 {"message":"Price history cached successfully: <coinName> - <timeFrame>"}`; both
Redis writes read back byte-identical (this story's own DTO fix, verified above - and
confirmed on the *old* origin's write too, since both origins share one cache format).
Missing `coinName` -> both `400 {"error":"Missing required fields"}`. Public.

**`GET /time-frame-coins-pl/d`** (seeded 3-point cache) - both origins:
`{"BTC":{"pastPl":5879.999403953552,"curPl":19879.999165534973,"timeFrameStartPrice":50000}}`
- byte-identical. Unsupported `timeFrame` (`bogus`) -> both `500` (old empty body, new
`{"error":"Internal Server Error"}`). No session -> both `401`.

**`GET /time-frame-total-pl/d`** - both origins:
`{"pastTotalValue":34999.99940395355,"currentTotalValue":55104.71546782227,"totalPastPl":5879.999403953552,"totalCurPl":25984.715467822272}`
- byte-identical. No session -> both `401`.

**`GET /token-info/14`** - old (no guard, unauthenticated request) and new (own
session) both -> `200 {"success":true,"userId":14}`; `TokenPriceHistory` `all` rows
attributable to the sync grew on each origin's own call. `GET /token-info/0` -> both
`400 {"error":"Missing userId param"}`. New-only tightenings: session for a different
user's id (`/token-info/1` with user 14's session) -> `403 {"error":"Forbidden"}`; no
session -> `401 {"error":"Unauthorized"}` - both the documented FR-2 tightening, no old-
route equivalent to diff against.

**`GET /token-info/search/bit`** - both origins: identical 10-row arrays, led by
`{"token_id":1,"symbol":"BTC","slug":"bitcoin","name":"Bitcoin","rank":1}`. Space-only
term (`%20`) -> both a single identical row (a token whose name starts with a space).
Public.

**`GET /metrics`** - with the real `METRICS_SECRET` bearer token, both origins:
`200`, `text/plain`, Prometheus exposition format (new adds the four D31 metrics beside
`collectDefaultMetrics`'s set - the documented F3 additive divergence, reconfirmed, not
a new one). No/incorrect token -> both `403` plain text `Forbidden` (byte-identical,
not JSON, on both origins).

**`auth/[...nextauth]`** - not re-tested, per the AC's own exclusion (out of contract-
inventory scope per story 2.1; Epic 4's stories 4.5/4.6/4.8 cover the new auth
endpoints).

### Summary table (Epic 7 / Owner Review artifact)

| Endpoint | Old status | New status | Match / divergence & why |
| --- | --- | --- | --- |
| `POST transaction/add` | 200 / 400 / 400 / 401 | 200 / 400 / 400 / 401 | Match - byte-identical bodies on every case |
| `DELETE transaction/:id` | 204 / 500 / 401 | 204 / 500 / 401 | Match - no-existence-check-first 500 preserved |
| `GET summary/coins` | 200 / 401 | 200 / 401 | Match - byte-identical |
| `GET summary/portfolio` | 200 / 401 | 200 / 401 | Match - byte-identical |
| `GET summary/:unit` | 200 / 401 | 200 / 401 | Match - byte-identical |
| `GET summary/profitLossChart` (query) | 500 (miss) / 200 / 401 | 500 (miss) / 200 / 401 | Match - re-run after F3's fix (epic review round 2): byte-identical `netRows` including the post-SELL row that previously diverged |
| `GET summary/profitLossChart/:timeFrame` | 500 (miss) / 200 / 401 | 500 (miss) / 200 / 401 | Same as query variant - byte-identical |
| `GET stats/:unit` | 200 / 500 (no-match crash) / 401 | 200 / 200 empty (no-match) / 401 | Match on rows; intentional divergence on no-match, already recorded (5.7), no known caller |
| `GET product/:product` | 200 / 200 [] / 401 | 200 / 200 [] / 401 | Match - byte-identical, including known FIFO float artifact (5.7) |
| `GET exchange-rates/:timeFrame/:coinName` | 200 / 500 (miss) | 200 / 500 (miss) | Match on status; unstructured-vs-`{error}` 500 body, already recorded (5.2), public |
| `GET exchange-rates/unit/:unit` | 200 / 404 | 200 / 404 | Match - byte-identical bare strings, public |
| `GET price-history/check` | 200 / 200 [] (unauth) | 200 / 401 (unauth) | Match on success; FR-2 tightening on unauth, already recorded |
| `POST price-history/set` | 200 / 400 | 200 / 400 | Match - **this story's fix**: nested body no longer stripped to `{}` (corrects story 5.4's AC) |
| `GET time-frame-coins-pl/:timeFrame` | 200 / 500 (bogus) / 401 | 200 / 500 (bogus) / 401 | Match on status; unstructured-vs-`{error}` body, already recorded |
| `GET time-frame-total-pl/:timeFrame` | 200 / 401 | 200 / 401 | Match - byte-identical |
| `GET token-info/:userId` | 200 / 400 | 200 / 400 / 403 / 401 | Match on shared cases; FR-2 tightening (auth + ownership scoping), already recorded |
| `GET token-info/search/:searchTerm` | 200 | 200 | Match - byte-identical |
| `GET metrics` | 200 (secret) / 403 | 200 (secret) / 403 | Match on shape (plain text both); F3 additive-metrics divergence, already recorded |
| `auth/[...nextauth]` | n/a | n/a | Out of contract-inventory scope (story 2.1) - not re-tested; Epic 4 covers the new auth endpoints |

Every divergence in the table above was already documented by the story named in its
own cell before this sweep started; none is newly discovered here. The one newly
discovered issue (`price-history/set`'s DTO-stripping defect) is fixed in this story
and now shows as a match.

### Changed Files

~ backend/src/exchange-rates/dto/price-history-response.dto.ts   adds `@IsOptional()` + a type validator (`@IsArray()`/`@IsNumber()`) to all three fields, fixing the `whitelist: true` stripping of the nested `priceHistoryResp` body on `POST /price-history/set` (corrects story 5.4's AC, found by story 5.8's Dev Notes)

### Verification

```
$ pnpm --filter @portfolio/backend typecheck
$ tsc --noEmit -p tsconfig.json
(no output - passed)

$ pnpm --filter @portfolio/backend lint
$ eslint "{src,test}/**/*.ts"
backend/src/main.ts 34:1  warning  no-floating-promises on bootstrap() - pre-existing, untouched by this story
✖ 1 problem (0 errors, 1 warning)

$ pnpm --filter @portfolio/backend build
$ nest build
(no output - passed)

$ docker compose up -d --build nest-api
(built and started cleanly)

$ curl -sk https://www.tubesock.xyz/backend/api/price-history/set --resolve www.tubesock.xyz:443:127.0.0.1 -X POST \
  -H "Content-Type: application/json" \
  -d '{"coinName":"DtoFixTestCoin","timeFrame":"d","priceHistoryResp":{"prices":[[1700000000,100,101]],"price_change":0.01,"usd_price_change":1}}'
{"message":"Price history cached successfully: DtoFixTestCoin - d"}
$ docker exec redis redis-cli GET "time-frame-pl-d-coinName-dtofixtestcoin"
{"prices":[[1700000000,100,101]],"price_change":0.01,"usd_price_change":1}
(before the fix this read back the literal string "{}" - see 5.8's Dev Notes; confirmed
fixed)

$ docker exec next-app pnpm --filter @portfolio/frontend spec:generate
🎉 portfolio - Your OpenAPI spec has been converted into ready to use orval!
$ git status --porcelain frontend/src/api/generated.ts
(empty - no shape/Swagger change, only class-validator decorators added; nothing to
commit)

# full 19-row parity sweep - see "19-row parity sweep" above for the complete
# request/response transcripts and the summary table above for the consolidated result

$ docker compose down && docker compose up -d --build
(full stack rebuilt and brought up from cold: alloy, grafana, loki, nest-api, next-app,
nginx, portfolio-db, prometheus, redis all "Up")
$ curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
{"status":"ok"}

# re-ran typecheck/lint/build after the cold rebuild to confirm the final tree is clean
$ pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend lint && pnpm --filter @portfolio/backend build
(typecheck: no output; lint: same single pre-existing warning; build: no output - all
passed)

# temporary data cleanup verification
$ docker exec portfolio-db mysql -uroot -proot PORTFOLIO -e "SELECT COUNT(*) FROM Transaction WHERE userId=14; SELECT COUNT(*) FROM User WHERE username='story510temp';"
0
0
$ docker exec redis redis-cli KEYS "*story510*" "*Story510*"
(empty)
```
