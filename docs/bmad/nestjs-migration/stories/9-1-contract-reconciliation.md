# Story 9.1: Contract reconciliation

Status: Done

## Context

First story of Epic 9 (PRD execution graph: Epic 9 depends on 4; runs before 5 and 6).
Epic 2 delivered seventeen DTO classes, signed off at the GR-2 Swagger gate; this story
diffs each of the eight `frontend/types/global.d.ts` response shapes (FR-20) against the
DTO that produces it, field by field, and records what's wrong (architecture "Epic 9 -
the contract pipeline": "Story 9.1 is reconciliation ... before anything is generated
from them, so the first committed snapshot is already correct"). This story is analysis
only - it produces findings, it does not act on them. Story 9.1a fixes the two DTO
defects this story finds; story 9.1b implements `TimeFrame` as a generated enum per D42,
which this story's table records as a verdict but does not implement. No generation
happens here either - that's 9.2/9.3.

## Acceptance Criteria

### A. Reconciliation table

- [x] Produce a table in Dev Notes, one row per `global.d.ts` shape, each with a verdict:
  - `PortfolioSummary` -> `PortfolioSummaryResponseDto`
    (`backend/src/summary/dto/portfolio-summary-response.dto.ts`)
  - `CoinSummaryResp` -> `CoinSummaryResponseDto`
    (`backend/src/summary/dto/coin-summary-response.dto.ts`)
  - `PriceHistoryResp` -> `PriceHistoryResponseDto`
    (`backend/src/exchange-rates/dto/price-history-response.dto.ts`)
  - `TimeFramePlByUnitResp` -> `TimeFrameCoinsPlResponseDto` / `TimeFrameCoinsPlEntryDto`
    (`backend/src/time-frame-pl/dto/time-frame-coins-pl-response.dto.ts`) - a raw
    `additionalProperties` map, not a named component schema (D43); this is expected and
    is not itself a defect.
  - `TimeFrameTotalPlResp` -> `TimeFrameTotalPlResponseDto`
    (`backend/src/time-frame-pl/dto/time-frame-total-pl-response.dto.ts`)
  - `ProductTransaction` -> `ProductTransactionResponseDto`
    (`backend/src/product/dto/product-transaction-response.dto.ts`) - verdict: DTO is
    wrong. It's missing six fields the route actually returns, and its `size` field's
    description makes a false claim about formatting. Full defect detail and the fix
    itself belong to story 9.1a; this story's job is to record that the defect exists
    and point at it, not to correct it.
  - `ProfitLossChartResp` -> `ProfitLossChartResponseDto`
    (`backend/src/summary/dto/profit-loss-chart-response.dto.ts`)
  - `TimeFrame` -> verdict: becomes a generated enum (architecture D42), not a 1:1 DTO
    mapping - the PRD's Known Input Details section names four of the seven sites that
    need it; story 9.1b finds and implements all seven. Not a defect and not fixed here.
  - Each row's verdict is one of: DTO is wrong (fixed in story 9.1a), hand-declared type
    was wrong (recorded, not fixed - `global.d.ts` is edited only in story 9.6), not
    generatable (name it and say why), or generated-enum-pending (the `TimeFrame` row,
    fixed in story 9.1b).
- [x] No DTO, controller, or `global.d.ts` file is edited in this story. If reconciliation
  turns up anything beyond the two defects already known (see Technical Notes), record it
  as a new table row with a verdict and leave the fix to a follow-up - do not fix it
  inline, since an undiscovered third defect widening this story's diff is exactly the
  failure mode this story-boundary exists to prevent.

## Technical Notes

- Two defects are already known empirically, from comparing the live route to the DTO -
  this story confirms and records them as the reconciliation table's two "DTO is wrong"
  rows for `ProductTransaction`; it does not fix them (story 9.1a does):
  `frontend/src/app/api/product/[product]/route.ts:56-71` builds every transaction with
  fourteen fields, and `ProductTransactionResponseDto` documents only eight - see story
  9.1a for the exact missing-field list. Separately, the DTO's `size` field description
  claims `.toFixed(4)` formatting that `route.ts:62`'s `transaction.size.toString()` does
  not perform.
- `global.d.ts` itself is not edited here. FR-23 keeps it alive for the GR-1-protected
  files that import it; stories 9.5/9.6 remove the client-side imports, and 9.6 trims the
  file to exactly what FR-23 requires.

## Out of Scope

- Fixing either of the two `ProductTransactionResponseDto` defects this story finds -
  story 9.1a.
- Implementing `TimeFrame` as a generated enum - story 9.1b.
- Generating `backend/openapi.json` or `frontend/types/api.d.ts` - stories 9.2/9.3.
- Building `TimeFrameService` or any date-range arithmetic - whichever Epic 5 story first
  needs it (per story 4.2's Out of Scope, unchanged by this story).
- Editing `frontend/types/global.d.ts` or any frontend consumer - stories 9.5/9.6.
- Any change to `packages/shared` - story 9.7.

## Dev Notes

### Reconciliation table

Field-by-field diff of each `frontend/types/global.d.ts` shape against the DTO that
produces it, cross-checked against the live Next.js route that actually builds the
response body.

| `global.d.ts` shape | DTO | Verdict | Notes |
| --- | --- | --- | --- |
| `PortfolioSummary` | `PortfolioSummaryResponseDto` | Hand-declared type was wrong | Fields match 1:1 (`purchases`, `sales`, `costBasis`, `valueOfHoldings`, `totalPLatCurrentPrice`, `netCashHoldings`, `netContributions`, `accountValue`, `realizedReturn`, `roi`, `inGreen`). The DTO types `roi!: number \| null` with a documented reason: `frontend/src/app/api/summary/portfolio/route.ts:33` computes `roi = (summary.profitLoss / netContributions) * 100`, which is `NaN` when `netContributions` is `0`, and `JSON.stringify(NaN)` serializes to `null`. `global.d.ts:10` types `roi: number` with no `\| null`, so the hand-declared type is wrong for that edge case. Not fixed here per FR-23/9.6. |
| `CoinSummaryResp` | `CoinSummaryResponseDto` | Matches | All 15 fields line up 1:1 in both name and shape against `frontend/src/app/api/summary/coins/route.ts:42-59`'s literal. No defect. |
| `PriceHistoryResp` | `PriceHistoryResponseDto` | Matches | `prices` / `price_change` / `usd_price_change` match `frontend/src/server/helpers/get-exchange-rates.ts:108`'s `getPriceHistoryForTimeFrame` return, verified via the Redis cache-hit path (`JSON.parse(cacheValue)`) that both `/exchange-rates/:timeFrame/:coinName` and the time-frame-pl routes consume. No defect. |
| `TimeFramePlByUnitResp` | `TimeFrameCoinsPlResponseDto` / `TimeFrameCoinsPlEntryDto` | Not generatable (as raw `additionalProperties` map, per D43) | Entry fields (`pastPl`, `curPl`, `timeFrameStartPrice`) match `frontend/src/app/api/time-frame-coins-pl/[timeFrame]/route.ts:49-53` exactly. The map itself has no component schema to alias - `@ApiExtraModels` + `additionalProperties` is the correct OpenAPI expression, not a defect. |
| `TimeFrameTotalPlResp` | `TimeFrameTotalPlResponseDto` | Matches | All 4 fields (`totalPastPl`, `totalCurPl`, `pastTotalValue`, `currentTotalValue`) match `frontend/src/app/api/time-frame-total-pl/[timeFrame]/route.ts:36`'s literal. No defect. |
| `ProductTransaction` | `ProductTransactionResponseDto` | DTO is wrong (fixed in 9.1a) | `frontend/src/app/api/product/[product]/route.ts:56-71` builds 14 fields (`id`, `fullName`, `product`, `date`, `side`, `size`, `unit`, `price`, `fee`, `total`, `notes`, `runningBalance`, `runningCostBasis`, `realizedGains`); the DTO documents only 8 (`price`, `fee`, `total`, `runningCostBasis`, `size`, `runningBalance`, `date`, `realizedGains`), missing `id`, `fullName`, `product`, `side`, `unit`, `notes`. Separately, the DTO's `size` field (`product-transaction-response.dto.ts:54`) claims `.toFixed(4)`-formatting, but `route.ts:62` does `transaction.size.toString()`, which is unformatted. Confirmed, not fixed here - see story 9.1a. |
| `ProfitLossChartResp` | `ProfitLossChartResponseDto` | Matches | `netRows` (with `date`/`valueOfHoldings`/`profitLoss`/`roi`), `lowestPointIndex`, `highestPointIndex` match the shape returned by both `/summary/profitLossChart` routes, including the documented `{ netRows: [], lowestPointIndex: 0, highestPointIndex: 0 }` fallback for a user with no transaction history. No defect. |
| `TimeFrame` | (no DTO - becomes a generated enum) | Generated-enum-pending (fixed in 9.1b) | Per architecture D42, becomes a `TIME_FRAMES` const applied via `enum` + `enumName: 'TimeFrame'`. Not a 1:1 DTO mapping and not implemented here. |

### Findings beyond the two known defects

One additional finding turned up during reconciliation, beyond the two `ProductTransaction`
defects named in Technical Notes: `PortfolioSummary.roi` in `global.d.ts` is typed
`number` but the DTO (correctly) types it `number | null`, because
`frontend/src/app/api/summary/portfolio/route.ts:33`'s `roi` computation produces `NaN`
when `netContributions` is `0`, which serializes to `null` over the wire. This is a
"hand-declared type was wrong" verdict, recorded per the reconciliation table above and
left unfixed - `global.d.ts` is edited only in story 9.6.

No other discrepancies were found. Every other shape's fields match 1:1 between the live
route's response body, the DTO, and `global.d.ts`.

### Changed Files

(Analysis only - no source files were edited. This story's only output is the
reconciliation table above, recorded in this story file.)

### Verification

This story is analysis only; there is no build or test command to run. Verification
consisted of reading each of the eight `global.d.ts` shapes side by side with its DTO
and its live Next.js route (`frontend/src/app/api/**/route.ts` and
`frontend/src/server/helpers/get-exchange-rates.ts`), and confirming each DTO's
`@ApiOkResponse`/`@ApiExtraModels` wiring in its controller. No commands were run because
no code changed.
