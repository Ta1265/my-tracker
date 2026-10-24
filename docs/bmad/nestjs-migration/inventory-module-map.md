# Domain module map

Assigns each endpoint from 2.1's inventory
(`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`) to one of the 10 Nest
modules architecture's "Backend module map" section names as owning an HTTP endpoint:
`auth`, `transactions`, `summary`, `stats`, `product`, `exchange-rates`,
`price-history`, `time-frame-pl`, `token-info`, `metrics`. That list is authoritative
per this story's Context, not re-derived here.

Row numbers below refer to 2.1's inventory in document order (its `## ` sections carry
no explicit numbers, so "row N" means the Nth `## ` section top to bottom, counting
`auth/[...nextauth]` as row 1):

1. `auth/[...nextauth]` (out of contract-inventory scope)
2. `transaction/add`
3. `transaction/[id]`
4. `summary/coins`
5. `summary/portfolio`
6. `summary/[unit]`
7. `summary/profitLossChart` (query variant)
8. `summary/profitLossChart/[timeFrame]`
9. `stats/[unit]`
10. `product/[product]`
11. `exchange-rates/[timeFrame]/[coinName]`
12. `exchange-rates/unit/[unit]`
13. `price-history/check`
14. `price-history/set`
15. `time-frame-coins-pl/[timeFrame]`
16. `time-frame-total-pl/[timeFrame]`
17. `token-info/[userId]`
18. `token-info/search/[searchTerm]`
19. `metrics`

`redis/` and `entities/` also appear in architecture's module map, but neither serves
an HTTP endpoint - they are infrastructure modules and are out of scope for this story
and for Epic 2 generally. `redis/` lands in story 5.2; `entities/` lands in Epic 3.

---

## auth

### Endpoints

- `POST /auth/login` - **new**, not in 2.1's inventory. Per 2.1's decision (row 1,
  `auth/[...nextauth]`), the existing catch-all NextAuth route is out of
  contract-inventory scope because it is NextAuth's own internal handler, not a
  hand-written endpoint with its own request/response contract. `login`, `logout`,
  and `session` are new endpoints designed in Epic 4 from FR-6 through FR-11, not a
  port of an existing route.
- `POST /auth/logout` - new, same rationale.
- `GET /auth/session` - new, same rationale.

### `dbService.ts` absorption

None.

### `src/server/helpers/` absorption

None. This module will absorb `frontend/src/server/auth.ts`'s `authOptions` /
credential-validation logic **conceptually** (the credential lookup and password
check that today lives inside NextAuth's `CredentialsProvider.authorize`), not
`auth.ts`'s NextAuth-specific plumbing (its `NextAuthOptions` shape, session
callbacks, JWT callbacks) - that plumbing is replaced outright by Nest's own
session/JWT handling, not ported.

---

## transactions

### Endpoints

- Row 2: `POST /transaction/add`
- Row 3: `DELETE /transaction/[id]`

### `dbService.ts` absorption

None. Both routes write/delete through Prisma (`db.transaction.create` /
`db.transaction.delete`) directly, and `transaction/add` additionally reads
`TokenInfo` via Prisma directly - neither goes through `dbService.ts`.

### `src/server/helpers/` absorption

None.

---

## summary

### Endpoints

- Row 4: `GET /summary/coins`
- Row 5: `GET /summary/portfolio`
- Row 6: `GET /summary/[unit]`
- Row 7: `GET /summary/profitLossChart` (query variant)
- Row 8: `GET /summary/profitLossChart/[timeFrame]`

### `dbService.ts` absorption

- `getCoinSummaries` - used by `summary/coins` and `summary/[unit]`.
- `getPortfolioSummary` - used by `summary/portfolio`.
- `getBuySellTotalFiFo` - used directly by `summary/coins`, `summary/portfolio`, and
  `summary/[unit]`; feeds `summary`'s FIFO cost-basis logic (FR-5.5's future scope).
- `getNetCashFlowHistory` (the `dbService.ts` copy, distinct from the
  `update-price-history.ts` one used by `profitLossChart` - see 2.1's landmine) - not
  called by any of today's 19 routes. Recorded as unused-but-present in `dbService.ts`
  rather than assigned to a module.

### `src/server/helpers/` absorption

- `update-price-history.ts` (`getNetCashFlowHistory`, the helpers copy) - used by both
  `profitLossChart` routes.

---

## stats

### Endpoints

- Row 9: `GET /stats/[unit]`

### `dbService.ts` absorption

- `getCoinSummaries` - `stats/[unit]` calls `dbService.getCoinSummaries(userId, unit)`
  and formats the first row. (Also absorbed by `summary`, above - the same
  `dbService.ts` function backs both modules' routes, per today's route code.)

### `src/server/helpers/` absorption

- `format-usd.ts` (`formatUSD`) - `stats/[unit]/route.ts` imports and calls `formatUSD`
  directly on every numeric field in the response.

---

## product

### Endpoints

- Row 10: `GET /product/[product]`

### `dbService.ts` absorption

None. The route reads transactions via `db.transaction.findMany` (Prisma) directly.

### `src/server/helpers/` absorption

None from `src/server/helpers/`. The route's currency formatting uses its own local
`formatUSD` copy at `frontend/src/app/api/product/[product]/route.ts:7` - a distinct
function from `src/server/helpers/format-usd.ts`'s `formatUSD` (different rounding
behavior, no `< 10` threshold; see 2.1's landmine). Per architecture D18/F2 these stay
two distinct formatters, so the local copy is recorded here against `product` and is
**not** merged with `stats`/`exchange-rates`'s note on the shared `format-usd.ts`
helper above.

---

## exchange-rates

### Endpoints

- Row 11: `GET /exchange-rates/[timeFrame]/[coinName]`
- Row 12: `GET /exchange-rates/unit/[unit]`

### `dbService.ts` absorption

None.

### `src/server/helpers/` absorption

- `get-exchange-rates.ts` (`getExchangeRates`, `getPriceHistoryForTimeFrame`) -
  `getPriceHistoryForTimeFrame` is used by `exchange-rates/[timeFrame]/[coinName]`.
  `getExchangeRates` has no caller among today's 19 routes (it runs the coinbase
  refresh/upsert cycle, invoked elsewhere in the app outside this inventory's scope);
  recorded here as the file this module will absorb regardless.
- `format-usd.ts` (`formatUSD`) - `exchange-rates/unit/[unit]/route.ts` imports and
  calls `formatUSD` directly. (Also absorbed by `stats`, above - same shared helper,
  two independent direct imports; `exchange-rates/unit/[unit]/route.ts` does not go
  through `get-exchange-rates.ts` to reach it.)
- `unitToNameMap.ts` - inspected directly: this file has **no importers anywhere** in
  `frontend/src/` today (confirmed by repo-wide grep). `storeTransactions.ts`'s
  unit-to-coin-name lookup imports a different, unrelated file
  (`frontend/src/data/coinsUnitToNameMap.ts`), not this one. Recorded as
  unused-but-present in `src/server/helpers/`, not assigned to `exchange-rates` or
  `summary` despite either module's plausible future use of unit-to-name translation.

---

## price-history

### Endpoints

- Row 13: `GET /price-history/check`
- Row 14: `POST /price-history/set`

### `dbService.ts` absorption

- `getPriceHistoryMap` - the `dbService.ts` copy is called from
  `update-price-history.ts`'s `updateNetCashFlowTableData`, which is itself part of
  the `summary`/`token-info`-absorbed `update-price-history.ts` file (see below); it
  is not called directly by `price-history/check` or `price-history/set`. Recorded
  here per this module's ownership of price-history data, per Technical Notes.
- `getUsersCoins` - called directly by `price-history/check`
  (`db.getUsersCoins(userId)`).

### `src/server/helpers/` absorption

None. Neither `price-history/check` nor `price-history/set` calls into
`src/server/helpers/`; both read/write Redis and Prisma directly.

---

## time-frame-pl

### Endpoints

This module covers two endpoints with no shared path prefix, so it will need two
controllers rather than one:

- Row 15: `GET /time-frame-coins-pl/[timeFrame]`
- Row 16: `GET /time-frame-total-pl/[timeFrame]`

### `dbService.ts` absorption

- `getCoinSummaries` - both routes call `dbService.getCoinSummaries` (once per route
  for `time-frame-total-pl`, twice - current and past - for `time-frame-coins-pl`).
  (Also absorbed by `summary` and `stats`, above.)
- `getTimeFramePriceChange` - not called by any of today's 19 routes (both time-frame
  routes compute their past/current P/L from `getCoinSummaries` calls instead).
  Recorded as unused-but-present in `dbService.ts`, not assigned to a module, though
  its query shape (per-unit past/current P/L) is conceptually this module's domain.

### `src/server/helpers/` absorption

- `get-exchange-rates.ts` (`getPriceHistoryForTimeFrame`) - both routes call it to
  resolve time-frame start prices.

---

## token-info

### Endpoints

- Row 17: `GET /token-info/[userId]`
- Row 18: `GET /token-info/search/[searchTerm]`

### `dbService.ts` absorption

- `getTokensForUserId` - called from `update-price-history.ts`'s
  `syncPriceHistoryToDbForUserId`, which `token-info/[userId]` triggers (per 2.1's
  landmine, that route doesn't return token info - it triggers this sync).

### `src/server/helpers/` absorption

- `update-price-history.ts` (`syncPriceHistoryToDbForUserId`, and transitively
  `insertIntoTokenPriceHistory` on `dbService.ts` which it calls) - `token-info/[userId]`'s
  sync trigger. `token-info/search/[searchTerm]` absorbs no helper - it queries
  `TokenInfo` via Prisma directly.

---

## metrics

### Endpoints

- Row 19: `GET /metrics`

### `dbService.ts` absorption

None.

### `src/server/helpers/` absorption

None. The route reads `register.metrics()` from `frontend/src/server/metrics.ts`
(outside `src/server/helpers/`) and compares the bearer token directly.

---

### `dbService.ts` functions left unassigned

Two further `dbService.ts` functions, beyond `getNetCashFlowHistory` and
`getTimeFramePriceChange` (both already noted above as unused-but-present under their
most relevant module), have no caller among today's 19 routes or the
`src/server/helpers/` files those routes use:

- `getTransactionsForUserOrdered` - unused.
- `insertIntoNetCashFlow` - used only by `update-price-history.ts`'s
  `updateNetCashFlowTableData`, which is part of the `summary`/`token-info`-absorbed
  `update-price-history.ts` file; not called directly by any route.
- `insertIntoTokenPriceHistory` - used only by `update-price-history.ts`'s
  `syncPriceHistoryToDbForUserId`, absorbed under `token-info` above.

Recorded here for completeness; no module assignment beyond what is already noted
above.
