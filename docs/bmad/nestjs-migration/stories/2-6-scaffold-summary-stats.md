# Story 2.6: Scaffold - summary and stats modules

Status: Done

## Context

Builds the `summary` module (all four `summary/*` endpoints, FR-4's two
`profitLossChart` variants included) and the rest of the `stats` module, per 2.2's map.
**`GET /stats/:unit` is already fully scaffolded by story 2.3 as its worked example -
this story does not recreate it**; `stats` has no other endpoint, so this story's
`stats` work is limited to confirming nothing else belongs there. Follow every
convention from 2.3.

## Acceptance Criteria

- [x] `backend/src/summary/summary.module.ts`, `summary.controller.ts` created,
      registered in `AppModule`. `@Controller('summary')`, tagged `Summary`.
      **Route declaration order matters and is a real bug risk, not just style**: Nest
      matches routes in declaration order, so the literal-path routes
      (`coins`, `portfolio`, `profitLossChart`, `profitLossChart/:timeFrame`) must be
      declared **before** the param route (`:unit`), or `:unit` will swallow requests
      meant for the literal paths. Declare `:unit` last in the controller.
- [x] `GET /backend/api/summary/coins` - response DTO `CoinSummaryResponseDto` as an
      array element (`CoinSummaryResponseDto[]`). Includes the derived fields
      `inGreen: boolean` and `costBasis: number` (2.1 records these are computed in the
      route, not SQL) as plain `@ApiProperty` (unformatted numbers/booleans, not
      `@FormattedValue`). `@ApiCookieAuth()`.
- [x] `GET /backend/api/summary/portfolio` - response DTO `PortfolioSummaryResponseDto`,
      single object, includes `inGreen: boolean`, all numeric fields unformatted.
      `@ApiCookieAuth()`.
- [x] `GET /backend/api/summary/:unit` - same response shape as `summary/coins`
      (`CoinSummaryResponseDto[]`, per FR-1's table listing it as a distinct route with
      no known frontend caller - document it in full per 2.1's "nothing dropped for
      being unused" rule). `@ApiCookieAuth()`.
- [x] `GET /backend/api/summary/profitLossChart` (`?timeFrame=` query param, default
      `'all'`, documented via `@ApiQuery`) and `GET
      /backend/api/summary/profitLossChart/:timeFrame` (path param) - both return the
      **identical** response DTO `ProfitLossChartResponseDto`: `{ netRows: { date:
      number (epoch ms), valueOfHoldings: number, profitLoss: number, roi: number }[],
      lowestPointIndex: number, highestPointIndex: number }` (2.1's Technical Notes).
      Document that an empty-history user gets the fallback shape (`{ netRows: [],
      lowestPointIndex: 0, highestPointIndex: 0 }`), not an error. Both
      `@ApiCookieAuth()`.
- [x] All four summary handlers throw `NotImplementedException` per 2.3 section F,
      each with a one-line comment naming the `dbService.ts`/`update-price-history.ts`
      function it will eventually call (per 2.2's module map: `getCoinSummaries`,
      `getPortfolioSummary`, and the `update-price-history.ts` `getNetCashFlowHistory`
      for the two chart variants - **not** the different, same-named function in
      `dbService.ts`; 2.1's landmine on this applies here verbatim).
- [x] Confirm (comment or brief note in this story's Dev Notes, not new code) that
      `stats` has no additional endpoint beyond 2.3's `GET /stats/:unit` - no
      `stats.controller.ts` changes needed in this story.

## Technical Notes

### Current state

`backend/src/stats/` exists after 2.3 with `GET /stats/:unit` fully scaffolded - read
that controller directly for the established `@FormattedValue` and stub-comment style.
`backend/src/summary/` does not exist yet.

### Route-ordering gotcha, restated because it is easy to get backwards

Given `@Controller('summary')`, declaring `@Get(':unit')` before `@Get('coins')` means
a request to `/backend/api/summary/coins` matches `:unit` with `unit = 'coins'` and
never reaches the `coins` handler. This has no compile-time signal - it fails only at
request time. Declare all literal-segment routes first.

## Out of Scope

- `GET /stats/:unit` - already scaffolded by story 2.3.
- Any real database, Redis, or query logic - Epic 3 and Epic 5.
- The functioning auth guard - story 4.7.
- Reconciling `dbService.ts`'s unused `getNetCashFlowHistory` - not called by any
  current route per 2.1/2.2; not part of this story's scope either.

## Dev Notes

`stats` module confirmed to have no additional endpoint: `backend/src/stats/` contains
only `stats.controller.ts` with the single `GET /stats/:unit` handler scaffolded by
2.3, plus its module/DTO files. Per 2.1/2.2's inventory, `stats/[unit]` is the only
route the `stats` module owns; no other `stats/*` route exists in the legacy app. No
`stats.controller.ts` changes were made in this story.

### Changed Files

+ backend/src/summary/summary.module.ts             Summary module, registers SummaryController
+ backend/src/summary/summary.controller.ts          All four summary/* routes, :unit declared last per the routing gotcha
+ backend/src/summary/dto/coin-summary-response.dto.ts   CoinSummaryResponseDto (summary/coins and summary/:unit)
+ backend/src/summary/dto/portfolio-summary-response.dto.ts   PortfolioSummaryResponseDto (summary/portfolio)
+ backend/src/summary/dto/profit-loss-chart-response.dto.ts   ProfitLossChartResponseDto (both profitLossChart variants)
~ backend/src/app.module.ts                          registers SummaryModule

### Verification

- `pnpm --filter @portfolio/backend build` - succeeds (`nest build`, no errors).
- `pnpm --filter @portfolio/backend typecheck` - succeeds (`tsc --noEmit`, no errors).
- `pnpm --filter @portfolio/backend lint` - succeeds after `eslint --fix` for
  formatting-only prettier violations; the one remaining warning
  (`main.ts:47` floating promise on `bootstrap()`) is pre-existing and unrelated to
  this story's changes.
- Booted the built app (`node dist/main.js`, `SWAGGER_ENABLED=true PORT=3001`) and
  confirmed the Nest startup log maps routes in this order under
  `SummaryController {/backend/api/summary}`: `coins`, `portfolio`, `profitLossChart`,
  `profitLossChart/:timeFrame`, `:unit` - `:unit` declared and registered last.
- `curl -s localhost:3001/backend/docs-json | python3 -c "..."` on the `summary` paths
  returned exactly `['/backend/api/summary/coins', '/backend/api/summary/portfolio',
  '/backend/api/summary/profitLossChart', '/backend/api/summary/profitLossChart/{timeFrame}',
  '/backend/api/summary/{unit}']`.
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/backend/api/summary/coins`
  returned `501` (not swallowed by `:unit`).
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/backend/api/summary/anything`
  returned `501` (the `:unit` route itself, confirming it still matches unmapped
  segments).
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/backend/api/summary/portfolio`
  returned `501`.
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/backend/api/summary/profitLossChart`
  returned `501`.
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/backend/api/summary/profitLossChart/w`
  returned `501`.
