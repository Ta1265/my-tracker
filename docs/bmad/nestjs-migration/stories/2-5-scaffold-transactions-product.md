# Story 2.5: Scaffold - transactions and product modules

Status: Done

## Context

Builds the remaining endpoint in the `transactions` module and the whole `product`
module, per 2.2's map. **`POST /transaction/add` is already fully scaffolded by story
2.3 as its worked example - this story does not recreate it**; it adds
`DELETE /transaction/:id` to the existing `transactions` module and creates `product`
from scratch. Follow every convention from 2.3.

## Acceptance Criteria

- [x] `DELETE /backend/api/transaction/:id` added to the existing
      `backend/src/transactions/transactions.controller.ts` (2.3 already created the
      module and controller for `POST /transaction/add` - add to it, don't duplicate).
      No request DTO (path param only). `204` empty response on success (matches 2.1's
      recorded behavior). Document `400` `{ error: string }` for a missing `id` and
      `500` `{ error: string }` for a delete failure (2.1 records no existence check
      happens today - carry that forward as the documented contract, since FR-3 pins
      behavior as-is). `@ApiCookieAuth()` (authenticated per FR-1).
- [x] `backend/src/product/product.module.ts`, `product.controller.ts` created,
      registered in `AppModule`. `@Controller('product')`, tagged `Product`.
- [x] `GET /backend/api/product/:product` - response DTO `ProductTransactionResponseDto`
      as an array element type (endpoint returns `ProductTransactionResponseDto[]`).
      Fields per 2.1's Technical Notes: `price`, `fee`, `total`, `runningCostBasis` -
      `@FormattedValue`, formatted via the **local** `formatUSD` copy in
      `frontend/src/app/api/product/[product]/route.ts:7` (plain `toLocaleString`, no
      threshold - e.g. example `"$1,234.56"`, **not** `"$1,235"` - do not use the
      shared helper's output as the example here, they diverge per architecture
      D18/F2); `size`, `runningBalance` - `@FormattedValue`, fixed-decimal strings
      (`.toFixed(4)`-style, e.g. `"12.3400"`); `date` - `@FormattedValue`, a
      `.toLocaleString()` string, not ISO (e.g. example `"1/15/2026, 3:04:00 PM"`);
      `realizedGains: { total: number, short: number, long: number }` - plain
      `@ApiProperty`, unformatted numbers, nested object type. Document `200` with an
      empty-`product`-param case returning `[]` (2.1 records this does not 400).
      `@ApiCookieAuth()` (authenticated per FR-1).
- [x] Both handlers throw `NotImplementedException` per 2.3 section F with a one-line
      comment: delete - "Delete the transaction row by id (no existence check today,
      per FR-3 parity)."; product - "Return the product's transaction history with
      running cost basis and realized gains, formatted via the route-local formatUSD
      copy (see architecture F2/D18 - do not reconcile with the shared helper here)."

## Technical Notes

### Current state

`backend/src/transactions/` exists after 2.3 with `POST /transaction/add` fully
scaffolded - read that controller directly for the established shape (DTO suffixing,
decorator ordering, stub-body comment style) rather than re-deriving conventions from
this story. `backend/src/product/` does not exist yet.

### The two-`formatUSD` landmine (architecture F2/D18)

`stats/:unit` (2.3's worked example) formats via the **shared** `formatUSD` in
`frontend/src/server/helpers/format-usd.ts` (thresholded: `<10` gets 2 decimals, `>=10`
gets 0). `product/:product` formats via a **separate, different** local copy in
`frontend/src/app/api/product/[product]/route.ts:7` (plain `toLocaleString`, always 2
decimals, no threshold). For `1234.56` the shared helper yields `"$1,235"`; the local
copy yields `"$1,234.56"`. Getting the example values right on each DTO in this story
matters - swapping them would silently misdocument the Epic 2 gate's artifact.
Reconciling them into one formatter is explicitly **not** this story's job; it's story
5.7 (architecture D18).

### Verification

- `pnpm --filter @portfolio/backend build` succeeds.
- App boots; `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` lists
  `/backend/api/transaction/{id}` and `/backend/api/product/{product}`.
- `curl -s -X DELETE localhost:3001/backend/api/transaction/1` returns `501`.
- `curl -s localhost:3001/backend/api/product/BTC` returns `501`.

## Out of Scope

- `POST /transaction/add` - already scaffolded by story 2.3.
- Reconciling the two `formatUSD` implementations - story 5.7.
- Any real database access, entity, or query logic - Epic 3 and Epic 5.
- The functioning auth guard - story 4.7.

## Dev Notes

### Changed Files

~ backend/src/transactions/transactions.controller.ts   added DELETE :id (204, NotImplementedException stub)
+ backend/src/product/product.module.ts                 new Product module
+ backend/src/product/product.controller.ts              GET :product, NotImplementedException stub
+ backend/src/product/dto/product-transaction-response.dto.ts   ProductTransactionResponseDto (local formatUSD examples per F2/D18)
~ backend/src/app.module.ts                              registers ProductModule

### Verification

- `pnpm --filter @portfolio/backend lint` - pass (one pre-existing `no-floating-promises`
  warning on `bootstrap()` in `main.ts`, unrelated to this story).
- `pnpm --filter @portfolio/backend typecheck` - pass, no errors.
- `pnpm --filter @portfolio/backend build` - pass (`nest build`, no errors).
- Booted with `node --env-file-if-exists=../defaults.env dist/main.js`:
  - `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` ->
    includes `/backend/api/transaction/{id}` and `/backend/api/product/{product}`
    (full list: `/backend/api/auth/login`, `/backend/api/auth/logout`,
    `/backend/api/auth/session`, `/backend/api/health`, `/backend/api/product/{product}`,
    `/backend/api/stats/{unit}`, `/backend/api/transaction/add`,
    `/backend/api/transaction/{id}`).
  - `curl -s -X DELETE localhost:3001/backend/api/transaction/1` -> `501`.
  - `curl -s localhost:3001/backend/api/product/BTC` -> `501`.
  - `curl -s localhost:3001/backend/docs-json | jq '.components.schemas.ProductTransactionResponseDto'`
    shows `price`/`fee`/`total`/`runningCostBasis` with example `"$1,234.56"` (local
    formatUSD copy, not the shared helper's `"$1,235"`), `size`/`runningBalance` with
    example `"12.3400"`, `date` with example `"1/15/2026, 3:04:00 PM"`, and
    `realizedGains` referencing a nested `RealizedGainsDto` schema.
