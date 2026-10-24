# Story 2.7: Scaffold - exchange rates, price history, and time-frame P/L modules

Status: Done

## Context

Builds the `exchange-rates`, `price-history`, and `time-frame-pl` modules per 2.2's
map - five endpoints across three modules, none scaffolded by an earlier story. This is
the batch's densest concentration of FR-2 auth decisions to get right: four of these
five routes are unauthenticated or half-authenticated today (FR-1's table), and FR-2
requires each to carry a deliberate, documented decision rather than a reflexive
carry-forward of today's behavior. Follow every convention from 2.3.

## Acceptance Criteria

### `exchange-rates` module

- [x] `backend/src/exchange-rates/exchange-rates.module.ts`, `.controller.ts` created,
      registered in `AppModule`. `@Controller('exchange-rates')`, tagged
      `Exchange Rates`.
- [x] `GET /backend/api/exchange-rates/:timeFrame/:coinName` - response DTO
      `PriceHistoryResponseDto`: `{ prices: [unixTimestamp: number, openPrice: number,
      closePrice: number][], price_change: number, usd_price_change: number }` (2.1's
      Technical Notes - this is `getPriceHistoryForTimeFrame`'s return shape, returned
      verbatim, unformatted). No auth today; record the FR-2 decision explicitly in
      this story's PR/comment either way (public today - keeping it public is
      permitted, tightening it is also permitted, loosening an authenticated route is
      not; this route has nothing to loosen). Decorate per the decision made.
- [x] `GET /backend/api/exchange-rates/unit/:unit` - **bare JSON string response, not
      an object** (2.1's landmine, FR-3). Document via `@ApiResponse({ status: 200,
      schema: { type: 'string' }, example: '"$1,235"' })` and a `404` also returning a
      bare string (`@ApiResponse({ status: 404, schema: { type: 'string' }, example:
      '"Exchange rate not found"' })`) - **do not** model this endpoint's response as a
      DTO class; a bare string has no object shape to model. No auth today.

### `price-history` module

- [x] `backend/src/price-history/price-history.module.ts`, `.controller.ts` created,
      registered in `AppModule`. `@Controller('price-history')`, tagged
      `Price History`.
- [x] `GET /backend/api/price-history/check` - response DTO
      `PriceHistoryCheckResponseDto[]`: `{ coinName: string, timeFramesNeeded: string[]
      }[]`. **This is the FR-2 half-auth case named explicitly in the PRD**: today's
      route reads `session?.user?.id` and queries with it without ever checking it was
      present (2.1's landmine, FR-2's own worked example). This story's job is to make
      an explicit choice for the new backend and document it - either `@ApiCookieAuth()`
      with a `401` documented (tightening a route that leaks unauthenticated data
      today, which FR-2 explicitly permits) or an `@ApiOperation` description stating
      the deliberate-public reasoning if the decision goes the other way. Do not leave
      it undecorated - an absence of any auth annotation is not itself a decision under
      FR-2.
- [x] `POST /backend/api/price-history/set` - request DTO `SetPriceHistoryRequestDto`:
      `{ coinName: string, timeFrame: string, priceHistoryResp: PriceHistoryResponseDto
      }` (reuse `PriceHistoryResponseDto` from the `exchange-rates` module for the
      nested field - do not redefine an identical shape under a new name). Response DTO
      `SetPriceHistoryResponseDto`: `{ message: string }` (2.1 notes the message is
      interpolated, not fixed - example `"Price history updated for BTC (24h)"` rather
      than a literal string constant). Document `400` `{ error: string }` for any
      missing field. No auth today - make and document the explicit FR-2 decision.

### `time-frame-pl` module

- [x] `backend/src/time-frame-pl/time-frame-pl.module.ts` created, registering **two**
      controllers (2.2's map notes these two endpoints share no path prefix):
      `time-frame-coins-pl.controller.ts` (`@Controller('time-frame-coins-pl')`) and
      `time-frame-total-pl.controller.ts` (`@Controller('time-frame-total-pl')`). Both
      tagged `Time-Frame P&L`.
- [x] `GET /backend/api/time-frame-coins-pl/:timeFrame` - response DTO
      `TimeFrameCoinsPlResponseDto`. **Object keyed by product name, not an array**
      (2.1's Technical Notes): `{ [productName: string]: { pastPl: number, curPl:
      number, timeFrameStartPrice: number } }`. Nest/Swagger cannot express an
      arbitrary-key map with `@ApiProperty` directly - use `@ApiExtraModels` plus
      `additionalProperties: { $ref: getSchemaPath(TimeFrameCoinsPlEntryDto) }` on a
      raw `@ApiResponse({ schema: {...} })`, with `TimeFrameCoinsPlEntryDto` as a small
      nested DTO for the `{ pastPl, curPl, timeFrameStartPrice }` value shape.
      `@ApiCookieAuth()` (authenticated per FR-1).
- [x] `GET /backend/api/time-frame-total-pl/:timeFrame` - response DTO
      `TimeFrameTotalPlResponseDto`: `{ pastTotalValue: number, currentTotalValue:
      number, totalPastPl: number, totalCurPl: number }`, all unformatted numbers.
      `@ApiCookieAuth()` (authenticated per FR-1).
- [x] All five handlers throw `NotImplementedException` per 2.3 section F, each with a
      one-line comment naming the helper it will call (`get-exchange-rates.ts`'s
      `getPriceHistoryForTimeFrame` for both `exchange-rates` endpoints and reused for
      `price-history/set`'s nested shape; Redis `EXISTS` checks under
      `time-frame-pl-{timeFrame}-coinName-{coin}` for `price-history/check`, per FR-18 -
      no Redis client exists yet, story 5.2 adds it; `update-price-history.ts`'s
      `syncPriceHistoryToDbForUserId` for `price-history/set`).

## Technical Notes

### FR-2 auth decisions - this story documents, Epic 5 enforces

Nothing in this story adds a functioning guard (that's 4.7) - `@ApiCookieAuth()` here
is purely documentation of the intended posture, checked against actual behavior only
once 4.7's guard exists and Epic 5 wires it per-endpoint. What matters for the Epic 2
gate is that every one of these five endpoints has a **visible, deliberate** posture in
Swagger, not a default.

### Response shapes needing non-trivial Swagger modeling

Two of this story's five DTOs need attention beyond the "one class per shape" pattern
2.3 established: the exchange-rates-unit bare string (no DTO class at all - a raw
`@ApiResponse` schema) and the time-frame-coins-pl keyed-by-product-name object (needs
`additionalProperties`, not a fixed-field class). Both are named explicitly above so
neither gets modeled as a generic `object` with no shape, which would fail the Epic 2
gate's "realistic examples rather than placeholder types" bar.

## Out of Scope

- The Redis client itself - story 5.2. This story documents the intended cache
  behavior in stub comments only.
- Any real database, entity, or query logic - Epic 3 and Epic 5.
- The functioning auth guard - story 4.7.
- Finalizing the FR-2 decision as a cross-endpoint policy document - that's 2.1's job;
  this story applies 2.1's per-endpoint decisions (or, until 2.1's document exists,
  makes and records the same decision directly in each endpoint's Swagger annotation).

## Dev Notes

### Changed Files

+ backend/src/exchange-rates/dto/price-history-response.dto.ts  PriceHistoryResponseDto (prices tuple array, price_change, usd_price_change) shared with price-history/set
+ backend/src/exchange-rates/exchange-rates.controller.ts  GET :timeFrame/:coinName (public) and GET unit/:unit (public, bare-string 200/404) stubs
+ backend/src/exchange-rates/exchange-rates.module.ts  registers ExchangeRatesController
+ backend/src/price-history/dto/price-history-check-response.dto.ts  PriceHistoryCheckResponseDto
+ backend/src/price-history/dto/set-price-history-request.dto.ts  SetPriceHistoryRequestDto, reuses PriceHistoryResponseDto for the nested field
+ backend/src/price-history/dto/set-price-history-response.dto.ts  SetPriceHistoryResponseDto (interpolated message)
+ backend/src/price-history/price-history.controller.ts  GET check (tightened to @ApiCookieAuth + 401, FR-2 worked case) and POST set (public) stubs
+ backend/src/price-history/price-history.module.ts  registers PriceHistoryController
+ backend/src/time-frame-pl/dto/time-frame-coins-pl-response.dto.ts  TimeFrameCoinsPlEntryDto (decorated) plus TimeFrameCoinsPlResponseDto as a Record<string, ...> type alias for the keyed-by-product-name shape
+ backend/src/time-frame-pl/dto/time-frame-total-pl-response.dto.ts  TimeFrameTotalPlResponseDto
+ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts  GET :timeFrame stub, @ApiCookieAuth, raw @ApiResponse schema with additionalProperties $ref for the keyed-object shape
+ backend/src/time-frame-pl/time-frame-total-pl.controller.ts  GET :timeFrame stub, @ApiCookieAuth, plain DTO response
+ backend/src/time-frame-pl/time-frame-pl.module.ts  registers both time-frame-pl controllers
~ backend/src/app.module.ts  imports ExchangeRatesModule, PriceHistoryModule, TimeFramePlModule

### Verification

- `pnpm --filter @portfolio/backend build` succeeds (nest build, no errors).
- `pnpm --filter @portfolio/backend typecheck` succeeds (tsc --noEmit, no errors).
- `pnpm --filter @portfolio/backend lint` succeeds after `--fix` for prettier
  formatting on the new files; the one remaining warning
  (`main.ts:47` floating-promise on `bootstrap()`) is pre-existing and untouched by
  this story.
- App boots (`node dist/main.js` with `defaults.env`/`override.env`);
  `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` lists all six new
  paths: `/backend/api/exchange-rates/{timeFrame}/{coinName}`,
  `/backend/api/exchange-rates/unit/{unit}`, `/backend/api/price-history/check`,
  `/backend/api/price-history/set`, `/backend/api/time-frame-coins-pl/{timeFrame}`,
  `/backend/api/time-frame-total-pl/{timeFrame}`.
- `curl -s localhost:3001/backend/docs-json | jq
  '.paths["/backend/api/exchange-rates/unit/{unit}"].get.responses."200".content["application/json"].schema'`
  shows `{"type":"string"}`, not an object schema (this Nest/Swagger version emits
  OpenAPI 3, which nests the schema under `content["application/json"].schema` rather
  than directly under `responses."200".schema` as the story's jq snippet assumed - the
  underlying schema value matches exactly what the AC requires).
- `curl -s localhost:3001/backend/docs-json | jq
  '.paths["/backend/api/time-frame-coins-pl/{timeFrame}"].get.responses."200".content["application/json"].schema'`
  shows `{"type":"object","additionalProperties":{"$ref":"#/components/schemas/TimeFrameCoinsPlEntryDto"}}`.
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/backend/api/time-frame-coins-pl/7d`
  returns `501`.
