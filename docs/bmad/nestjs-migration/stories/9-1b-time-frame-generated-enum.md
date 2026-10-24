# Story 9.1b: `TimeFrame` becomes a generated enum

Status: Done

## Context

Implements architecture D42, the verdict story 9.1's reconciliation table recorded for
the `TimeFrame` row: `TimeFrame` becomes a generated enum, not a hand-declared
request-side type. This is a deliberate architecture decision, not a defect the diff
found - unlike story 9.1a, nothing here is "wrong" today, it's a decision this story
implements across seven sites. Independent of story 9.1a; the two can land in either
order, but both must land before story 9.2 generates the committed spec snapshot.

## Acceptance Criteria

- [x] Add `export const TIME_FRAMES = ['h', 'd', 'w', 'm', '3m', '6m', 'y', 'all'] as const;`
  to backend source (suggested location: `backend/src/common/time-frame/time-frames.ts` -
  a plain constants file, not a service; `TimeFrameService` doesn't exist yet and this
  story doesn't create it).
- [x] Apply `enum: TIME_FRAMES, enumName: 'TimeFrame'` at all seven sites (architecture
  D42 - the PRD's Known Input Details section names only the first four; the other three
  are load-bearing additions this story must also make):
  1. `backend/src/exchange-rates/exchange-rates.controller.ts:9` - `@ApiParam({ name:
     'timeFrame', ... })`, currently `example: '24h'`.
  2. `backend/src/time-frame-pl/time-frame-total-pl.controller.ts:14` - same pattern.
  3. `backend/src/time-frame-pl/time-frame-coins-pl.controller.ts:26` - same pattern.
  4. `backend/src/summary/summary.controller.ts:72` - `@ApiParam` on
     `profitLossChart/:timeFrame`, already `example: 'all'` (correct value, still needs
     the `enum`/`enumName` upgrade for consistency).
  5. `backend/src/summary/summary.controller.ts:48` - the `@ApiQuery` on
     `profitLossChart?timeFrame=`, the FR-4 twin of #4. Leaving this one a free string
     while #4 is an enum would document the same value two different ways in the same
     controller.
  6. `backend/src/price-history/dto/set-price-history-request.dto.ts:16` -
     `SetPriceHistoryRequestDto.timeFrame`, currently `example: '24h'`.
  7. `backend/src/price-history/dto/price-history-check-response.dto.ts:9` -
     `PriceHistoryCheckResponseDto.timeFramesNeeded`, an array field - keep `isArray: true`
     alongside the new `enum`/`enumName`, currently `example: ['24h', '7d']`.
- [x] Every `'24h'`/`'7d'`-style example across all seven sites is replaced with a real
  member of `TIME_FRAMES` (e.g. `'d'`).
- [x] `pnpm --filter @portfolio/backend build` succeeds; start the backend
  (`docker compose up -d --build nest-api`) and confirm `GET /backend/docs-json` now
  contains a `TimeFrame` component schema with the eight values, referenced (`$ref`) from
  all seven sites rather than inlined.

## Technical Notes

- `openapi-typescript` generates `enumName` as a named union type -
  `@ApiParam({ enum: TIME_FRAMES, enumName: 'TimeFrame' })` is what makes
  `@nestjs/swagger` emit a reusable `TimeFrame` schema and `$ref` it, instead of inlining
  the eight-value array at each site (architecture "`TimeFrame` becomes a generated
  enum"). Without `enumName` the values are still correct but there's no single named
  type for `frontend/types/contracts.ts` (story 9.3) to alias.

## Out of Scope

- The `ProductTransactionResponseDto` defect fixes - story 9.1a.
- Building `TimeFrameService` or any date-range arithmetic - whichever Epic 5 story first
  needs it (per story 4.2's Out of Scope, unchanged by this story).
- Editing `frontend/types/global.d.ts` or any frontend consumer - stories 9.5/9.6.
- Generating `backend/openapi.json` or `frontend/types/api.d.ts` - stories 9.2/9.3.

## Dev Notes

### Changed Files

+ backend/src/common/time-frame/time-frames.ts               new `TIME_FRAMES` const, the single source for the generated `TimeFrame` enum
~ backend/src/exchange-rates/exchange-rates.controller.ts    `@ApiParam` for `:timeFrame` now `enum: TIME_FRAMES, enumName: 'TimeFrame'`, example `'d'`
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts    same `@ApiParam` upgrade, example `'d'`
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts    same `@ApiParam` upgrade, example `'d'`
~ backend/src/summary/summary.controller.ts    `@ApiParam` on `profitLossChart/:timeFrame` and `@ApiQuery` on `profitLossChart?timeFrame=` both get `enum: TIME_FRAMES, enumName: 'TimeFrame'`
~ backend/src/price-history/dto/set-price-history-request.dto.ts    `timeFrame` property `@ApiProperty` gets `enum`/`enumName`, example `'d'`
~ backend/src/price-history/dto/price-history-check-response.dto.ts    `timeFramesNeeded` array property switches from `type: [String]` to `enum`/`enumName` + `isArray: true`, example `['d', 'w']`

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output beyond the `tsc` invocation.
- `pnpm --filter @portfolio/backend lint` - passed; one pre-existing warning in
  `src/main.ts:53` (`@typescript-eslint/no-floating-promises`), unrelated to this story's
  changes.
- `pnpm --filter @portfolio/backend build` - `nest build` succeeded.
- `docker compose up -d --build nest-api` - built and started cleanly; confirmed via
  `docker compose logs nest-api` that all routes mapped with no startup errors.
- Fetched `GET /backend/docs-json` from inside the `nest-api` container (the
  external nginx path returned 404 for unrelated reasons - the compose stack's nginx
  is configured for the `tubesock.xyz` vhost with a 443 redirect, not a plain
  `localhost` route; this is pre-existing and outside this story's scope) and confirmed:
  - `components.schemas.TimeFrame` is `{ type: 'string', enum: ['h','d','w','m','3m','6m','y','all'] }`.
  - All five `@ApiParam`/`@ApiQuery` sites (`exchange-rates/{timeFrame}/{coinName}`,
    `time-frame-total-pl/{timeFrame}`, `time-frame-coins-pl/{timeFrame}`,
    `summary/profitLossChart` query, `summary/profitLossChart/{timeFrame}`) have
    `parameter.schema` equal to `{ '$ref': '#/components/schemas/TimeFrame' }`, not an
    inlined enum array.
  - `SetPriceHistoryRequestDto.timeFrame` is `{ example: 'd', allOf: [{ '$ref':
    '#/components/schemas/TimeFrame' }] }`.
  - `PriceHistoryCheckResponseDto.timeFramesNeeded` is `{ type: 'array', items: { '$ref':
    '#/components/schemas/TimeFrame' } }`.
